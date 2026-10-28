require('../config/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

test('地图入口增补保留现有数据、支持重复执行并覆盖新账号', async t => {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const connection = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
  let sequelize, created = false;
  try {
    await connection.query(`CREATE DATABASE \`${database}\``); created = true;
    await connection.query(`USE \`${database}\``);
    await connection.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    process.env.DB_NAME = database;
    const models = require('../models'); sequelize = models.sequelize;
    const { User, Menu, MenuList, BookmarkTemplate } = models;
    await connection.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())', ['cara', 'map-cara@example.test', 'fixture-hash']);
    await require('../migrations/user-data')();
    const { copyDefaults } = require('../services/defaultBookmarks');
    const alice = await User.create({ username: 'map-alice', password: 'fixture-hash', email: 'map-alice@example.test' });
    await sequelize.transaction(transaction => copyDefaults(alice.id, transaction));
    const original = (await MenuList.findAll({ order: [['id', 'ASC']] })).map(item => item.get({ plain: true }));
    const originalTemplate = structuredClone((await BookmarkTemplate.findByPk(1)).content);
    const migrate = require('../migrations/visual-map');
    const mapEntries = userId => MenuList.findAll({ where: { targetUrl: '/map' }, include: [{ model: Menu, as: 'menu', required: true, where: { user_id: userId } }] });
    await t.test('现有账号与默认模板各增加一个入口，已有书签完全保留', async () => {
      const result = await migrate(); assert.equal(result.added, 2);
      for (const id of [1, alice.id]) {
        const entries = await mapEntries(id); assert.equal(entries.length, 1);
        assert.equal(entries[0].title, '可视化地图'); assert.equal(entries[0].icon, '可');
        assert.ok(entries[0].menu.title.startsWith('有趣功能点')); assert.equal(entries[0].is_locked, true);
      }
      for (const before of original) assert.deepEqual((await MenuList.findByPk(before.id)).get({ plain: true }), before);
      const updated = (await BookmarkTemplate.findByPk(1)).content;
      assert.equal(updated.flatMap(category => category.bookmarks).filter(item => item.targetUrl === '/map').length, 1);
      for (let i = 0; i < originalTemplate.length; i++) {
        assert.equal(updated[i].title, originalTemplate[i].title);
        assert.deepEqual(updated[i].bookmarks.filter(item => item.targetUrl !== '/map'), originalTemplate[i].bookmarks);
      }
    });
    await t.test('重复执行及并发执行均不产生重复入口', async () => {
      const before = await MenuList.count();
      await Promise.all([migrate(), migrate()]);
      assert.equal(await MenuList.count(), before); assert.equal((await mapEntries(alice.id)).length, 1);
    });
    await t.test('移动到其他分类后不会重复添加或强制移动回来', async () => {
      const [entry] = await mapEntries(alice.id);
      const category = await Menu.create({ title: '个人地图收藏', user_id: alice.id });
      await category.update({ index: String(category.id) });
      await entry.update({ menu_id: category.id }); await migrate();
      const entries = await mapEntries(alice.id); assert.equal(entries.length, 1); assert.equal(entries[0].menu_id, category.id);
    });
    await t.test('仅升级旧版地图默认简介，保留个人修改与分类位置', async () => {
      const [caraEntry] = await mapEntries(1), [aliceEntry] = await mapEntries(alice.id);
      await caraEntry.update({ desc: '浏览地图、定位与查看坐标' });
      await aliceEntry.update({ desc: '我自己的地图说明' });
      const template = await BookmarkTemplate.findByPk(1), content = structuredClone(template.content);
      for (const category of content) for (const bookmark of category.bookmarks)
        if (bookmark.targetUrl === '/map') bookmark.desc = '浏览地图、定位与查看坐标';
      await template.update({ content });
      await migrate();
      assert.equal((await caraEntry.reload()).desc, '查看中国省级地图与区域信息');
      assert.equal((await aliceEntry.reload()).desc, '我自己的地图说明');
      assert.equal((await BookmarkTemplate.findByPk(1)).content.flatMap(category => category.bookmarks).find(bookmark => bookmark.targetUrl === '/map').desc, '查看中国省级地图与区域信息');
    });
    await t.test('新账号从默认模板获得入口', async () => {
      const bob = await User.create({ username: 'map-bob', password: 'fixture-hash', email: 'map-bob@example.test' });
      await sequelize.transaction(transaction => copyDefaults(bob.id, transaction));
      assert.equal((await mapEntries(bob.id)).length, 1);
      assert.equal((await migrate()).added, 0);
    });
  } finally {
    if (sequelize) await sequelize.close();
    if (created) { assert.match(database, /^ownproject_test_[a-f0-9]{16}$/); await connection.query(`DROP DATABASE IF EXISTS \`${database}\``); }
    await connection.end();
  }
});
