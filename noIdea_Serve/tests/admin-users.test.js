require('../config/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { io } = require('socket.io-client');

test('管理员用户管理：隔离 MySQL、角色保护、会话撤销与并发登录', { timeout: 60000 }, async t => {
  const database = `ownproject_admin_test_${crypto.randomBytes(8).toString('hex')}`;
  const originalDatabase = process.env.DB_NAME;
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    socketPath: process.env.DB_SOCKET, multipleStatements: true, connectTimeout: 5000,
  });
  let sequelize, server, createdDatabase = false;
  const clients = [];
  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    createdDatabase = true;
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    process.env.DB_NAME = database;
    const models = require('../models');
    sequelize = models.sequelize;
    const { User, Session } = models;
    const migrate = require('../migrations/permissions');
    const service = require('../services/adminUserService');
    const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);
    const initialPassword = 'initial-test-password';
    const initialHash = await bcrypt.hash(initialPassword, 4);

    await t.test('首次权限迁移仍要求 cara，失败不改结构；成功时仅初始化一次管理员', async () => {
      await assert.rejects(migrate(), /找不到 cara/);
      assert.equal((await sequelize.getQueryInterface().describeTable('users')).role, undefined);
      assert.equal((await sequelize.getQueryInterface().describeTable('menus')).is_locked, undefined);
      for (const username of ['cara', 'manager', 'member-one', 'member-two']) {
        await admin.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())', [username, `${username}@example.test`, initialHash]);
      }
      await migrate();
      assert.equal((await User.findByPk(1)).role, 'admin');
      assert.equal((await User.findByPk(2)).role, 'user');
      await require('../migrations/user-data')();
    });
    await t.test('已有role但零管理员时拒绝重跑并提示人工恢复，不自动提升cara', async () => {
      await User.update({ role: 'user' }, { where: {} });
      try {
        await assert.rejects(migrate(), /没有管理员.*迁移中断.*核实用户身份并手动恢复一位管理员/);
        assert.equal(await User.count({ where: { role: 'admin' } }), 0);
        assert.equal((await User.findOne({ where: { username: 'cara' } })).role, 'user');
      } finally {
        await User.update({ role: 'admin' }, { where: { id: 1 } });
      }
      await migrate();
      assert.equal((await User.findByPk(1)).role, 'admin');
      assert.equal((await User.findByPk(2)).role, 'user');
    });
    await User.update({ role: 'admin' }, { where: { id: 2 } });
    await Session.sync();
    const [owner, manager, member, other] = await User.findAll({ order: [['id', 'ASC']] });
    const { hashToken, requireAuth, requireAdmin } = require('../middleware/auth');
    const makeSession = async userId => {
      const token = crypto.randomBytes(32).toString('hex');
      await Session.create({ token_hash: hashToken(token), user_id: userId, expires_at: new Date(Date.now() + 3600000) });
      return token;
    };
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/api/users', require('../routes/userRoutes'));
    app.use('/api/admin/users', requireAuth, requireAdmin, require('../routes/adminUserRoutes'));
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message, status: error.status || 500 }));
    server = require('node:http').createServer(app);
    server.io = require('../realtime/chatSocket').attachChatSocket(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, route, token, body) => {
      const response = await fetch(origin + '/api' + route, { method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const content = await response.text();
      return { status: response.status, body: content.startsWith('{') ? JSON.parse(content) : {}, cache: response.headers.get('cache-control') };
    };
    const login = async (userId, password = initialPassword) => {
      const user = await User.findByPk(userId);
      return request('POST', '/users/login', null, { username: user.username, password });
    };
    const currentOwnerToken = () => makeSession(owner.id);
    const managedKeys = ['createdAt', 'email', 'id', 'role', 'username'];

    await t.test('仅管理员可查询修改，分页/搜索正确且不返回密码哈希，adminCount为全局', async () => {
      const ownerToken = await currentOwnerToken();
      const memberToken = await makeSession(member.id);
      assert.equal((await request('GET', '/admin/users')).status, 401);
      for (const [method, route, body] of [
        ['GET', '/admin/users'], ['PATCH', `/admin/users/${other.id}`, { username: 'attack' }],
        ['PUT', `/admin/users/${other.id}/password`, { password: 'attack' }],
      ]) assert.equal((await request(method, route, memberToken, body)).status, 403);
      const result = await request('GET', '/admin/users?page=2&pageSize=2', ownerToken);
      assert.equal(result.status, 200);
      assert.equal(result.cache, 'private, no-store');
      assert.equal(result.body.data.total, 4);
      assert.equal(result.body.data.adminCount, 2);
      assert.deepEqual(result.body.data.users.map(user => user.id), [member.id, other.id]);
      for (const user of result.body.data.users) {
        assert.deepEqual(Object.keys(user).sort(), managedKeys);
        assert.ok(Number.isFinite(Date.parse(user.createdAt)));
      }
      const searched = await request('GET', '/admin/users?keyword=member-one', ownerToken);
      assert.equal(searched.body.data.total, 1);
      assert.equal(searched.body.data.adminCount, 2);
      assert.equal((await request('GET', '/admin/users?keyword=member-two%40example.test', ownerToken)).body.data.total, 1);
      await User.create({ username: 'literal%_name', email: 'literal@example.test', password: initialHash });
      for (const keyword of ['%', '_']) {
        const found = await service.listUsers(owner.id, { keyword });
        assert.deepEqual(found.users.map(user => user.username), ['literal%_name']);
      }
      await rejects(service.listUsers(member.id), 403);
    });

    await t.test('拒绝参数类型、未知字段、无效邮箱、重复账号/邮箱及超长密码', async () => {
      const token = await currentOwnerToken();
      for (const query of [{ page: [] }, { page: {} }, { page: '1e1' }, { page: 0 }, { pageSize: 101 }, { pageSize: [] }, { keyword: [] }, { keyword: {} }, { keyword: null }, { keyword: 'x'.repeat(256) }]) {
        await rejects(service.listUsers(owner.id, query), 400);
      }
      for (const query of ['page[]=1', 'page[bad]=1', 'pageSize[]=2', 'keyword[bad]=x']) {
        assert.equal((await request('GET', `/admin/users?${query}`, token)).status, 400);
      }
      for (const body of [null, [], {}, { id: owner.id }, { username: 'x', password: 'not-allowed' }, { role: 'owner' }, { username: ' ' }, { username: 'x'.repeat(256) }, { email: 'bad' }, { email: `${'x'.repeat(250)}@a.test` }, { role: {} }]) {
        assert.equal((await request('PATCH', `/admin/users/${member.id}`, token, body)).status, 400);
      }
      assert.equal((await request('PATCH', `/admin/users/${member.id}`, token, { username: manager.username })).status, 409);
      assert.equal((await request('PATCH', `/admin/users/${member.id}`, token, { email: manager.email.toUpperCase() })).status, 409);
      assert.equal((await request('PATCH', '/admin/users/2147483647', token, { username: 'not-found' })).status, 404);
      assert.equal((await request('PATCH', '/admin/users/0', token, { username: 'bad-id' })).status, 400);
      for (const body of [null, {}, { password: '' }, { password: '界'.repeat(25) }, { password: 'x'.repeat(73) }, { password: 123 }, { password: 'valid', role: 'admin' }]) {
        assert.equal((await request('PUT', `/admin/users/${member.id}/password`, token, body)).status, 400);
      }
      assert.equal((await request('POST', '/admin/users', token, {})).status, 404);
      assert.equal((await request('DELETE', `/admin/users/${member.id}`, token)).status, 404);
      assert.equal((await User.findByPk(member.id)).username, member.username);
    });

    await t.test('账号修改trim并撤销目标全部会话，其他用户不受影响，无变化不撤销', async () => {
      const token = await currentOwnerToken();
      const first = await makeSession(member.id), second = await makeSession(member.id);
      const unrelated = await makeSession(other.id);
      const changed = await request('PATCH', `/admin/users/${member.id}`, token, { username: ' renamed-member ', email: ' renamed@example.test ', role: 'user' });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.requiresLogin, true);
      assert.equal(changed.body.data.username, 'renamed-member');
      assert.equal(changed.body.data.email, 'renamed@example.test');
      assert.deepEqual(Object.keys(changed.body.data).sort(), managedKeys);
      assert.equal(await Session.count({ where: { user_id: member.id } }), 0);
      for (const old of [first, second]) assert.equal((await request('GET', '/users/me', old)).status, 401);
      assert.equal((await request('GET', '/users/me', unrelated)).status, 200);
      const targetToken = await makeSession(member.id);
      const unchanged = await request('PATCH', `/admin/users/${member.id}`, token, { username: 'renamed-member', email: 'renamed@example.test', role: 'user' });
      assert.equal(unchanged.body.requiresLogin, false);
      assert.equal((await request('GET', '/users/me', targetToken)).status, 200);
      const oldNameLogin = await request('POST', '/users/login', null, { username: member.username, password: initialPassword });
      assert.equal(oldNameLogin.status, 401);
      assert.equal((await login(member.id)).status, 200);
    });

    await t.test('并发重复账号只成功一次，角色变更不允许最后管理员消失', async () => {
      const results = await Promise.allSettled([
        service.updateUser(owner.id, member.id, { username: 'concurrent-name' }),
        service.updateUser(owner.id, other.id, { username: 'concurrent-name' }),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
      const roles = await Promise.allSettled([
        service.updateUser(owner.id, owner.id, { role: 'user' }),
        service.updateUser(manager.id, manager.id, { role: 'user' }),
      ]);
      assert.equal(roles.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(roles.find(result => result.status === 'rejected').reason.status, 409);
      assert.equal(await User.count({ where: { role: 'admin' } }), 1);
      const remaining = await User.findOne({ where: { role: 'admin' } });
      await rejects(service.updateUser(remaining.id, remaining.id, { role: 'user' }), 409);
      await User.update({ role: 'admin' }, { where: { id: [owner.id, manager.id] } });
    });

    await t.test('请求排队后再次校验操作者当前角色，被降级管理员不能继续修改', async () => {
      let release, entered;
      const gate = new Promise(resolve => { release = resolve; });
      const paused = new Promise(resolve => { entered = resolve; });
      User.addHook('afterUpdate', 'pause-admin-demotion', async user => {
        if (user.id === manager.id && user.role === 'user') { entered(); await gate; }
      });
      let demote, stale;
      const before = (await User.findByPk(other.id)).email;
      try {
        demote = service.updateUser(owner.id, manager.id, { role: 'user' });
        await paused;
        stale = service.updateUser(manager.id, other.id, { email: 'should-not-change@example.test' });
        const checked = rejects(stale, 403);
        release();
        await demote;
        await checked;
      } finally {
        release();
        User.removeHook('afterUpdate', 'pause-admin-demotion');
        await Promise.allSettled([demote, stale]);
      }
      assert.equal((await User.findByPk(other.id)).email, before);
      await rejects(service.resetPassword(manager.id, other.id, { password: 'not-authorized' }), 403);
      await User.update({ role: 'admin' }, { where: { id: manager.id } });
    });

    await t.test('密码重置撤销全部会话并立即断开目标Socket，允许72字节且不trim密码', async () => {
      const oldToken = await makeSession(member.id);
      await makeSession(member.id);
      const untouched = await makeSession(other.id);
      const socket = io(origin, { auth: { token: oldToken }, forceNew: true, reconnection: false });
      clients.push(socket);
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      const unauthorized = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('重置后未收到断连通知')), 4000);
        socket.once('chat:unauthorized', value => { clearTimeout(timer); resolve(value); });
      });
      const disconnected = new Promise(resolve => socket.once('disconnect', resolve));
      const password = ` ${'界'.repeat(23)}  `;
      assert.equal(Buffer.byteLength(password), 72);
      const reset = await request('PUT', `/admin/users/${member.id}/password`, await currentOwnerToken(), { password });
      assert.equal(reset.status, 200);
      assert.deepEqual(reset.body.data, { userId: member.id, requiresLogin: true });
      await unauthorized;
      await disconnected;
      assert.equal(await Session.count({ where: { user_id: member.id } }), 0);
      assert.equal((await request('GET', '/users/me', oldToken)).status, 401);
      assert.equal((await request('GET', '/users/me', untouched)).status, 200);
      assert.equal((await login(member.id, initialPassword)).status, 401);
      assert.equal((await login(member.id, password.trim())).status, 401);
      assert.equal((await login(member.id, password)).status, 200);
    });

    await t.test('旧密码登录与重置串行，重置提交后不能写入旧密码有效会话', async () => {
      await User.update({ password: initialHash }, { where: { id: member.id } });
      await Session.destroy({ where: { user_id: member.id } });
      let release, entered;
      const gate = new Promise(resolve => { release = resolve; });
      const paused = new Promise(resolve => { entered = resolve; });
      User.addHook('afterUpdate', 'pause-password-reset', async user => {
        if (user.id === member.id && user.changed('password')) { entered(); await gate; }
      });
      let reset, oldLogin;
      try {
        reset = service.resetPassword(owner.id, member.id, { password: 'fresh-after-race' });
        await paused;
        oldLogin = login(member.id, initialPassword);
        await new Promise(resolve => setTimeout(resolve, 80));
        release();
        await reset;
        assert.equal((await oldLogin).status, 401);
      } finally {
        release();
        User.removeHook('afterUpdate', 'pause-password-reset');
        await Promise.allSettled([reset, oldLogin]);
      }
      assert.equal(await Session.count({ where: { user_id: member.id } }), 0);
      assert.equal((await login(member.id, 'fresh-after-race')).status, 200);
    });

    await t.test('管理员可修改自己且当前会话失效，迁移重跑不依赖旧名称或重授角色', async () => {
      const token = await currentOwnerToken();
      const changed = await request('PATCH', `/admin/users/${owner.id}`, token, { username: 'renamed-admin' });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.requiresLogin, true);
      assert.equal((await request('GET', '/admin/users', token)).status, 401);
      await admin.query("INSERT INTO menus (`index`,title,is_locked,user_id) VALUES ('new','new-unlocked',false,?)", [owner.id]);
      await migrate();
      assert.equal((await User.findByPk(owner.id)).role, 'admin');
      assert.equal(await User.count({ where: { username: 'cara' } }), 0);
      const [beforeOwners] = await admin.query('SELECT id,user_id FROM menus ORDER BY id');
      const templateBefore = (await models.BookmarkTemplate.findByPk(1)).content;
      await require('../migrations/user-data')();
      const [afterOwners] = await admin.query('SELECT id,user_id FROM menus ORDER BY id');
      assert.deepEqual(afterOwners, beforeOwners);
      assert.deepEqual((await models.BookmarkTemplate.findByPk(1)).content, templateBefore);
      await service.updateUser(manager.id, owner.id, { role: 'user' });
      await User.create({ username: 'cara', email: 'new-cara@example.test', password: initialHash });
      await migrate();
      assert.equal((await User.findByPk(owner.id)).role, 'user');
      assert.equal((await User.findOne({ where: { username: 'cara' } })).role, 'user');
      assert.equal((await User.findByPk(manager.id)).role, 'admin');
      const [menus] = await admin.query("SELECT is_locked FROM menus WHERE title='new-unlocked'");
      assert.equal(menus[0].is_locked, 0);
    });

    await t.test('已有模板但出现NULL归属时明确拒绝，不把孤儿分类归给新cara或管理员', async () => {
      const { DataTypes } = require('sequelize');
      const qi = sequelize.getQueryInterface();
      await qi.changeColumn('menus', 'user_id', { type: DataTypes.INTEGER, allowNull: true });
      const firstMenu = await models.Menu.findOne({ where: { user_id: owner.id }, order: [['id', 'ASC']] });
      await admin.query('UPDATE menus SET user_id=NULL WHERE id=?', [firstMenu.id]);
      await assert.rejects(require('../migrations/user-data')(), /用户模板已存在.*user_id 为 NULL/);
      assert.equal((await models.Menu.findByPk(firstMenu.id)).user_id, null);
      await models.Menu.update({ user_id: owner.id }, { where: { id: firstMenu.id } });
      await require('../migrations/user-data')();
      assert.equal((await models.Menu.findByPk(firstMenu.id)).user_id, owner.id);
      assert.equal((await qi.describeTable('menus')).user_id.allowNull, false);
    });
  } finally {
    for (const socket of clients) socket.disconnect();
    if (server) await new Promise(resolve => server.io.close(resolve));
    if (sequelize) await sequelize.close();
    if (createdDatabase && /^ownproject_admin_test_[a-f0-9]{16}$/.test(database)) await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
    if (originalDatabase === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = originalDatabase;
  }
});
