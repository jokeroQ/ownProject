const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const os = require('node:os');
const sharp = require('sharp');

test('数据库迁移、默认副本和用户数据隔离', async t => {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    socketPath: process.env.DB_SOCKET, multipleStatements: true,
  });
  let sequelize, server;
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ownproject-theme-test-'));
  process.env.THEME_UPLOAD_DIR = uploadDir;
  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.resolve(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    process.env.DB_NAME = database;
    const models = require('../models');
    sequelize = models.sequelize;
    const { User, Menu, MenuList, Session, BookmarkTemplate } = models;
    const migrate = require('../migrations/user-data');
    const password = 'integration-test-password';
    const bcrypt = require('bcryptjs');
    await t.test('缺少 cara 时不会改动表结构', async () => {
      await assert.rejects(migrate(), /找不到 cara/);
      assert.equal((await sequelize.getQueryInterface().describeTable('menus')).user_id, undefined);
    });
    const cara = await User.create({ username: 'cara', email: 'cara-test@example.test', password: await bcrypt.hash(password, 10) });
    await migrate();
    await require('../migrations/themes')();
    const snapshot = JSON.parse(JSON.stringify((await BookmarkTemplate.findByPk(1)).content));
    await t.test('旧记录归 cara，模板独立；重复迁移保持记录', async () => {
      const old = await Menu.findAll({ where: { user_id: cara.id }, order: [['id', 'ASC']] });
      assert.deepEqual(old.map(menu => menu.id), [1, 2, 3, 4, 5, 9]);
      assert.equal(await MenuList.count({ where: { menu_id: [1, 2, 3, 4, 5, 9] } }), 11);
      const count = await Menu.count();
      await migrate();
      assert.equal(await Menu.count(), count);
      assert.deepEqual((await BookmarkTemplate.findByPk(1)).content, snapshot);
    });
    const { app } = require('../app');
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (method, route, token, body) => {
      const response = await fetch(base + route, { method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const login = async username => {
      const result = await request('POST', '/users/login', null, { username, password });
      assert.equal(result.status, 200);
      assert.equal(result.body.user.password, undefined);
      return result.body.token;
    };
    const caraToken = await login('cara');
    let alice, bob, aliceMenus, bobMenus;
    await t.test('注册两用户，各获得默认模板副本，无密码哈希', async () => {
      for (const username of ['isolation-alice', 'isolation-bob']) {
        const result = await request('POST', '/users/register', null, { username, password, email: username + '@example.test' });
        assert.equal(result.status, 201);
        assert.equal(result.body.user.password, undefined);
      }
      alice = await login('isolation-alice'); bob = await login('isolation-bob');
      aliceMenus = (await request('GET', '/menu/getMenus', alice)).body.data;
      bobMenus = (await request('GET', '/menu/getMenus', bob)).body.data;
      assert.equal(aliceMenus.length, snapshot.length); assert.equal(bobMenus.length, snapshot.length);
      for (let i = 0; i < snapshot.length; i++) {
        assert.equal(aliceMenus[i].title, snapshot[i].title);
        assert.equal(aliceMenus[i].menuLists.length, snapshot[i].bookmarks.length);
        assert.notEqual(aliceMenus[i].id, bobMenus[i].id);
        assert.ok(aliceMenus[i].menuLists.every(bookmark => bookmark.menu_id === aliceMenus[i].id));
      }
      const duplicate = await request('POST', '/users/register', null, { username: 'isolation-alice', password, email: 'duplicate@example.test' });
      assert.equal(duplicate.status, 409);
    });
    await t.test('分类和书签的全部跨用户接口被拦截', async () => {
      const menuId = bobMenus[0].id, bookmarkId = bobMenus[0].menuLists[0].id;
      const routes = [
        ['GET', `/menu/getSubmenus/${menuId}`],
        ['PUT', `/menu/updateMenu/${menuId}`, { title: 'attack', user_id: cara.id }],
        ['DELETE', `/menu/deletMenu/${menuId}`],
        ['POST', `/menu/addSubmenus/${menuId}`, { title: 'attack', targetUrl: '/chat' }],
        ['PUT', `/menu/updateSubmenus/${bookmarkId}`, { title: 'attack', targetUrl: '/chat' }],
        ['DELETE', `/menu/deleteSubmenus/${bookmarkId}`],
        ['POST', '/menu/subMenus/swap', { firstId: aliceMenus[0].menuLists[0].id, secondId: bookmarkId }],
        ['POST', '/menu/subMenus/move', { subMenuId: bookmarkId, menuId: aliceMenus[0].id }],
        ['POST', '/menu/subMenus/move', { subMenuId: aliceMenus[0].menuLists[0].id, menuId }],
      ];
      for (const [method, route, body] of routes) assert.equal((await request(method, route, alice, body)).status, 404, route);
      assert.equal((await request('GET', '/menu/getMenus', bob)).body.data[0].title, bobMenus[0].title);
    });
    await t.test('个人分类和书签增改删、简介及同栏排序可用，伪造归属无效', async () => {
      const created = await request('POST', '/menu/addMenus', alice, { title: 'personal', user_id: cara.id });
      assert.equal(created.status, 201);
      const menuId = created.body.data.id;
      assert.equal(created.body.data.user_id, aliceMenus[0].user_id);
      assert.equal((await request('PUT', `/menu/updateMenu/${menuId}`, alice, { title: 'renamed', index: '9999' })).status, 200);
      const bookmark = await request('POST', `/menu/addSubmenus/${menuId}`, alice, {
        title: 'chat', targetUrl: '/chat', desc: '自己的内容', menu_id: bobMenus[0].id, order: 900,
      });
      assert.equal(bookmark.status, 201); assert.equal(bookmark.body.data.menu_id, menuId);
      assert.equal(bookmark.body.data.order, 1); assert.equal(bookmark.body.data.desc, '自己的内容');
      const second = await request('POST', `/menu/addSubmenus/${menuId}`, alice, { title: 'sign', targetUrl: '/signPad' });
      assert.equal(second.body.data.order, 2);
      assert.equal((await request('POST', '/menu/subMenus/swap', alice, { firstId: bookmark.body.data.id, secondId: second.body.data.id })).status, 200);
      assert.equal((await request('GET', `/menu/getSubmenus/${menuId}`, alice)).body.data[0].id, second.body.data.id);
      assert.equal((await request('PUT', `/menu/updateSubmenus/${bookmark.body.data.id}`, alice, { title: 'updated', targetUrl: 'https://example.com', desc: '修改内容' })).status, 200);
      assert.equal((await request('POST', `/menu/addSubmenus/${menuId}`, alice, { title: 'bad', targetUrl: 'javascript:alert(1)' })).status, 400);
      assert.equal((await request('DELETE', `/menu/deleteSubmenus/${bookmark.body.data.id}`, alice)).status, 200);
      assert.equal((await request('DELETE', `/menu/deletMenu/${menuId}`, alice)).status, 200);
      assert.equal(await MenuList.count({ where: { menu_id: menuId } }), 0);
    });
    await t.test('跨分类移动、插入排序、空分类及失败回滚', async () => {
      const create = async title => (await request('POST', '/menu/addMenus', alice, { title })).body.data.id;
      const source = await create('move-source'), target = await create('move-target');
      const add = async (menuId, title) => (await request('POST', `/menu/addSubmenus/${menuId}`, alice, { title, targetUrl: '/chat', desc: 'preserved' })).body.data.id;
      const first = await add(source, 'first'), second = await add(source, 'second'), third = await add(source, 'third');
      const list = async menuId => (await request('GET', `/menu/getSubmenus/${menuId}`, alice)).body.data;
      const move = (subMenuId, menuId, beforeId) => request('POST', '/menu/subMenus/move', alice, { subMenuId, menuId, beforeId });
      assert.equal((await move(second, target)).status, 200);
      assert.deepEqual((await list(source)).map(item => [item.id, item.order]), [[first, 1], [third, 2]]);
      assert.equal((await list(target))[0].desc, 'preserved');
      assert.equal((await move(first, target, second)).status, 200);
      assert.deepEqual((await list(target)).map(item => [item.id, item.order]), [[first, 1], [second, 2]]);
      assert.equal((await move(first, target)).status, 200);
      assert.deepEqual((await list(target)).map(item => [item.id, item.order]), [[second, 1], [first, 2]]);
      assert.equal((await move(first, target, third)).status, 404);
      assert.deepEqual((await list(target)).map(item => item.id), [second, first]);
      assert.equal((await move(first, target, first)).status, 200);
      assert.equal((await move(first, 'bad')).status, 400);
      const parallel = await Promise.all([move(second, source), move(first, source)]);
      assert.ok(parallel.every(result => result.status === 200));
      const concurrent = await list(source);
      assert.equal(concurrent.length, 3);
      assert.deepEqual(concurrent.map(item => item.order), [1, 2, 3]);
      assert.equal((await request('POST', '/menu/subMenus/move', null, { subMenuId: first, menuId: target })).status, 401);
      await request('DELETE', `/menu/deletMenu/${source}`, alice);
      await request('DELETE', `/menu/deletMenu/${target}`, alice);
    });
    await t.test('修改 cara 后新用户仍获得原始默认模板', async () => {
      await request('PUT', '/menu/updateMenu/1', caraToken, { title: 'cara-personal-change' });
      const result = await request('POST', '/users/register', null, { username: 'isolation-new', password, email: 'new@example.test' });
      assert.equal(result.status, 201);
      const token = await login('isolation-new');
      assert.equal((await request('GET', '/menu/getMenus', token)).body.data[0].title, snapshot[0].title);
      await migrate();
      assert.equal((await request('GET', '/menu/getMenus', caraToken)).body.data[0].title, 'cara-personal-change');
    });
    await t.test('模板复制失败回滚注册用户', async () => {
      await BookmarkTemplate.update({ id: 2 }, { where: { id: 1 } });
      try {
        assert.equal((await request('POST', '/users/register', null, { username: 'rollback-user', password, email: 'rollback@example.test' })).status, 500);
        assert.equal(await User.count({ where: { username: 'rollback-user' } }), 0);
      } finally { await BookmarkTemplate.update({ id: 1 }, { where: { id: 2 } }); }
    });
    await t.test('主题迁移可重跑、偏好按用户保存', async () => {
      assert.deepEqual((await request('GET', '/theme', alice)).body.data, {
        mode: 'light', primaryColor: '#409eff', overlay: 0.35, hasBackground: false,
      });
      assert.equal((await request('GET', '/theme')).status, 401);
      const updated = await request('PUT', '/theme', alice, { mode: 'dark', primaryColor: '#7c3aed', overlay: 0.65, user_id: cara.id });
      assert.equal(updated.status, 200);
      await require('../migrations/themes')();
      assert.deepEqual((await request('GET', '/theme', alice)).body.data, updated.body.data);
      assert.equal((await request('GET', '/theme', bob)).body.data.mode, 'light');
      for (const invalid of [{ mode: 'unknown' }, { primaryColor: 'red' }, { overlay: 1 }, { overlay: '0.4' }]) {
        assert.equal((await request('PUT', '/theme', alice, { mode: 'light', primaryColor: '#409eff', overlay: 0.4, ...invalid })).status, 400);
      }
    });
    const upload = async (token, buffer, type = 'image/png') => {
      const response = await fetch(base + '/theme/background', { method: 'PUT', headers: {
        'Content-Type': type, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }, body: buffer });
      return { status: response.status, body: await response.json() };
    };
    await t.test('个人图片解码重编码、限制大小和格式、阻止跨用户读取', async () => {
      const image = await sharp({ create: { width: 2800, height: 100, channels: 3, background: '#e11d48' } }).png().toBuffer();
      assert.equal((await upload(null, image)).status, 401);
      assert.equal((await upload(alice, image)).status, 200);
      const response = await fetch(base + '/theme/background', { headers: { Authorization: `Bearer ${alice}` } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 2560);
      assert.equal((await fetch(base + `/theme/background?user_id=${aliceMenus[0].user_id}`, { headers: { Authorization: `Bearer ${bob}` } })).status, 404);
      for (const [buffer, type] of [[Buffer.from('not an image'), 'image/png'], [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/png'], [image, 'text/plain']]) {
        assert.equal((await upload(alice, buffer, type)).status, 400);
      }
      assert.equal((await upload(alice, Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
      assert.equal((await request('GET', '/theme', alice)).body.data.hasBackground, true);
      assert.equal(fs.readdirSync(uploadDir).length, 1);
    });
    await t.test('并发替换不遗留图片，移除与恢复默认仅影响本人', async () => {
      const image = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#059669' } }).jpeg().toBuffer();
      const concurrent = await Promise.all([upload(alice, image, 'image/jpeg'), upload(alice, image, 'image/jpeg')]);
      assert.ok(concurrent.every(result => result.status === 200));
      assert.equal(fs.readdirSync(uploadDir).length, 1);
      await upload(bob, image, 'image/jpeg');
      assert.equal(fs.readdirSync(uploadDir).length, 2);
      assert.equal((await request('DELETE', '/theme/background', alice)).body.data.hasBackground, false);
      assert.equal((await request('GET', '/theme', alice)).body.data.mode, 'dark');
      assert.equal(fs.readdirSync(uploadDir).length, 1);
      await upload(alice, image, 'image/jpeg');
      const reset = await request('DELETE', '/theme', alice);
      assert.deepEqual(reset.body.data, { mode: 'light', primaryColor: '#409eff', overlay: 0.35, hasBackground: false });
      assert.equal((await request('GET', '/theme', bob)).body.data.hasBackground, true);
      assert.equal(fs.readdirSync(uploadDir).length, 1);
    });
    await t.test('未登录、伪造、过期、退出凭证均无法访问', async () => {
      assert.equal((await request('GET', '/menu/getMenus')).status, 401);
      assert.equal((await request('GET', '/menu/getMenus', crypto.randomBytes(32).toString('hex'))).status, 401);
      const { hashToken } = require('../middleware/auth');
      const expired = crypto.randomBytes(32).toString('hex');
      await Session.create({ token_hash: hashToken(expired), user_id: cara.id, expires_at: new Date(0) });
      assert.equal((await request('GET', '/menu/getMenus', expired)).status, 401);
      assert.equal((await request('GET', '/users/me', alice)).body.user.password, undefined);
      assert.equal((await request('POST', '/users/logout', alice, {})).status, 200);
      assert.equal((await request('GET', '/menu/getMenus', alice)).status, 401);
      assert.equal((await request('GET', '/menu/getMenus', bob)).status, 200);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (sequelize) await sequelize.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
});
