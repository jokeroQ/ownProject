require('../config/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { readWorkbook, sheetRows, readDocument } = require('./report-export-files.cjs');

test('工作报告：隔离 MySQL 迁移、登录归属、归档、筛选与完整导出', async t => {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const admin = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
  let sequelize, server;
  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    process.env.DB_NAME = database;
    const models = require('../models'); sequelize = models.sequelize;
    const { User, UserReport, Menu, MenuList, BookmarkTemplate } = models;
    const password = 'report-integration-password';
    await admin.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())', ['cara', 'reports@example.test', await require('bcryptjs').hash(password, 10)]);
    await require('../migrations/user-data')();
    const migration = require('../migrations/reports');
    const menusBefore = (await Menu.findAll()).map(row => row.get({ plain: true })), bookmarksBefore = (await MenuList.findAll()).map(row => row.get({ plain: true }));
    await t.test('迁移追加功能入口，重复运行不更改旧分类书签', async () => {
      assert.equal((await migration()).added, 1);
      assert.equal((await migration()).added, 0);
      assert.equal(await UserReport.count(), 0);
      for (const menu of menusBefore) assert.deepEqual((await Menu.findByPk(menu.id)).get({ plain: true }), menu);
      for (const bookmark of bookmarksBefore) assert.deepEqual((await MenuList.findByPk(bookmark.id)).get({ plain: true }), bookmark);
      assert.ok((await BookmarkTemplate.findByPk(1)).content.some(category => category.bookmarks.some(item => item.targetUrl === '/reports')));
    });
    server = await new Promise(resolve => { const started = require('../app').app.listen(0, '127.0.0.1', () => resolve(started)); });
    const api = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (method, route, token, body) => {
      const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    };
    const login = async username => (await request('POST', '/users/login', null, { username, password })).body.token;
    const caraToken = await login('cara');
    assert.ok(caraToken);
    assert.equal((await request('POST', '/users/register', null, { username: 'report-bob', password, email: 'report-bob@example.test' })).status, 201);
    const bobToken = await login('report-bob');
    const dailyInput = { type: 'daily', date: '2026-10-29', accomplishments: '完成100%_接口\n中文,"引号"', plans: '=SUM(1,2)', blockers: '无' };
    let daily, weekly;
    await t.test('匿名请求被拒绝，入口随新用户模板继承，字段验证失败无数据写入', async () => {
      assert.ok((await request('GET', '/menu/getMenus', bobToken)).body.data.some(menu => menu.menuLists.some(item => item.targetUrl === '/reports')));
      assert.equal((await request('GET', '/reports')).status, 401);
      assert.equal((await request('POST', '/reports', caraToken, { ...dailyInput, user_id: 2 })).status, 400);
      assert.equal((await request('POST', '/reports', caraToken, { ...dailyInput, date: '2026-02-29' })).status, 400);
      assert.equal(await UserReport.count(), 0);
    });
    await t.test('日报持久化、并发重复409、周报按周一归档，同日两种报告独立', async () => {
      const results = await Promise.all([request('POST', '/reports', caraToken, dailyInput), request('POST', '/reports', caraToken, dailyInput)]);
      assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
      daily = results.find(result => result.status === 201).body.data;
      const result = await request('POST', '/reports', caraToken, { ...dailyInput, type: 'weekly', date: '2026-11-01', accomplishments: '本周总结' });
      assert.equal(result.status, 201); weekly = result.body.data;
      assert.equal(weekly.startDate, '2026-10-26'); assert.equal(weekly.endDate, '2026-11-01');
      assert.equal((await request('POST', '/reports', caraToken, { ...dailyInput, type: 'weekly', date: '2026-10-28' })).status, 409);
      assert.equal((await request('GET', '/reports', caraToken)).body.data.total, 2);
      assert.equal((await request('GET', '/reports?keyword=100%25_', caraToken)).body.data.total, 1);
    });
    await t.test('账号隔离覆盖读取、修改、删除和导出，导出必须指定完整区间', async () => {
      assert.equal((await request('GET', '/reports', bobToken)).body.data.total, 0);
      assert.equal((await request('PUT', `/reports/${daily.id}`, bobToken, dailyInput)).status, 404);
      assert.equal((await request('DELETE', `/reports/${daily.id}`, bobToken)).status, 404);
      assert.equal((await request('GET', '/reports/export?from=2026-10-01&to=2026-11-01', bobToken)).status, 404);
      assert.equal((await request('GET', '/reports/export', caraToken)).status, 400);
      assert.equal((await request('GET', '/reports?from=2026-10-30&to=2026-10-29', caraToken)).status, 400);
    });
    await t.test('编辑后保留全文，归档冲突回滚，交集日期筛选包含周报', async () => {
      const result = await request('PUT', `/reports/${daily.id}`, caraToken, { ...dailyInput, plans: '后续验证' });
      assert.equal(result.status, 200); assert.equal(result.body.data.plans, '后续验证');
      assert.equal(result.body.data.accomplishments, dailyInput.accomplishments);
      assert.equal((await request('PUT', `/reports/${daily.id}`, caraToken, { ...dailyInput, type: 'weekly' })).status, 409);
      assert.equal((await UserReport.findByPk(daily.id)).type, 'daily');
      assert.equal((await request('GET', '/reports?from=2026-10-30&to=2026-10-30', caraToken)).body.data.total, 1);
      assert.equal((await request('GET', '/reports?type=daily&from=2026-10-30&to=2026-10-30', caraToken)).body.data.total, 0);
      assert.equal((await migration()).added, 0);
      assert.equal(await UserReport.count(), 2);
    });
    await t.test('分页不重复，表格不受分页影响且保留中文、多行、账号归属及附件标头', async () => {
      const cara = await User.findOne({ where: { username: 'cara' } });
      await UserReport.bulkCreate(Array.from({ length: 22 }, (_, index) => ({ user_id: cara.id, type: 'daily', period_start: `2026-09-${String(index + 1).padStart(2, '0')}`, period_end: `2026-09-${String(index + 1).padStart(2, '0')}`, accomplishments: `九月记录${index}`, plans: '', blockers: '' })));
      const first = (await request('GET', '/reports', caraToken)).body.data, second = (await request('GET', '/reports?page=2', caraToken)).body.data;
      assert.equal(first.total, 24); assert.equal(first.items.length, 20); assert.equal(second.items.length, 4);
      assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 24);
      const response = await fetch(api + '/reports/export?from=2026-09-01&to=2026-11-01&page=2', { headers: { Authorization: `Bearer ${caraToken}` } });
      assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/csv/); assert.match(response.headers.get('content-disposition'), /attachment/); assert.match(response.headers.get('cache-control'), /no-store/);
      const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
      const csv = bytes.toString('utf8');
      for (let index = 0; index < 22; index++) assert.ok(csv.includes(`"九月记录${index}"`));
      assert.ok(csv.includes('完成100%_接口\n中文,""引号""'));
      assert.ok(csv.includes('"\'=SUM(1,2)"')); // The weekly report retained its formula-like plan as text.
      const filtered = await fetch(api + '/reports/export?type=weekly&from=2026-10-30&to=2026-10-30', { headers: { Authorization: `Bearer ${caraToken}` } });
      assert.ok((await filtered.text()).includes('本周总结'));
    });
    await t.test('Excel与Word导出延续账号隔离、日期交集和格式校验，响应为真实文件', async () => {
      for (const [format, mime] of [['xlsx', 'spreadsheetml'], ['docx', 'wordprocessingml']]) {
        const route = `/reports/export?format=${format}&type=weekly&from=2026-10-30&to=2026-10-30`;
        assert.equal((await request('GET', route, bobToken)).status, 404);
        assert.equal((await request('GET', route)).status, 401);
        const response = await fetch(api + route, { headers: { Authorization: `Bearer ${caraToken}` } });
        assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').includes(mime)); assert.ok(response.headers.get('content-disposition').includes(`work-reports.${format}`)); assert.match(response.headers.get('cache-control'), /no-store/);
        const content = Buffer.from(await response.arrayBuffer());
        if (format === 'xlsx') {
          const values = sheetRows(await readWorkbook(content)); assert.equal(values.length, 2); assert.equal(values[1][0], '周报'); assert.equal(values[1][3], '本周总结'); assert.equal(values[1][4], '=SUM(1,2)');
        } else { const xml = await readDocument(content); assert.ok(xml.includes('本周总结')); assert.ok(!xml.includes('九月记录')); }
      }
      for (const format of ['pdf', 'constructor', 'xlsx&format=docx']) assert.equal((await request('GET', `/reports/export?from=2026-10-01&to=2026-11-01&format=${format}`, caraToken)).status, 400);
    });
    await t.test('分批导出不丢记录、不重复表头与BOM，搜索同样作用于导出', async () => {
      const cara = await User.findOne({ where: { username: 'cara' } });
      await UserReport.bulkCreate(Array.from({ length: 105 }, (_, index) => {
        const date = new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10);
        return { user_id: cara.id, type: 'daily', period_start: date, period_end: date, accomplishments: `批次记录${index}`, plans: '', blockers: '' };
      }));
      const response = await fetch(api + '/reports/export?type=daily&from=2025-01-01&to=2025-12-31&keyword=' + encodeURIComponent('批次记录'), { headers: { Authorization: `Bearer ${caraToken}` } });
      assert.equal(response.status, 200);
      const csv = Buffer.from(await response.arrayBuffer()).toString('utf8');
      assert.equal(csv.split('\uFEFF').length, 2); assert.equal(csv.split('"类型"').length, 2);
      assert.equal(csv.split('\r\n').length, 107);
      for (let index = 0; index < 105; index++) assert.ok(csv.includes(`"批次记录${index}"`));
      assert.ok(!csv.includes('九月记录'));
      for (const format of ['xlsx', 'docx']) {
        const exported = await fetch(api + `/reports/export?format=${format}&type=daily&from=2025-01-01&to=2025-12-31&keyword=` + encodeURIComponent('批次记录'), { headers: { Authorization: `Bearer ${caraToken}` } });
        assert.equal(exported.status, 200);
        const content = Buffer.from(await exported.arrayBuffer());
        if (format === 'xlsx') { const values = sheetRows(await readWorkbook(content)); assert.equal(values.length, 106); assert.equal(new Set(values.slice(1).map(item => item[3])).size, 105); }
        else { const xml = await readDocument(content); assert.equal((xml.match(/<w:tbl>/g) || []).length, 105); assert.ok(xml.includes('批次记录0')); assert.ok(xml.includes('批次记录104')); }
      }
    });
    await t.test('Word数量上限有明确提示，Excel仍可导出完整范围', async () => {
      const cara = await User.findOne({ where: { username: 'cara' } });
      await UserReport.bulkCreate(Array.from({ length: 501 }, (_, index) => {
        const date = new Date(Date.UTC(2000, 0, index + 1)).toISOString().slice(0, 10);
        return { user_id: cara.id, type: 'daily', period_start: date, period_end: date, accomplishments: `历史记录${index}`, plans: '', blockers: '' };
      }));
      const route = '/reports/export?from=2000-01-01&to=2002-01-01&format=';
      const limited = await request('GET', route + 'docx', caraToken); assert.equal(limited.status, 400); assert.match(limited.body.message, /500/);
      const response = await fetch(api + route + 'xlsx', { headers: { Authorization: `Bearer ${caraToken}` } });
      assert.equal(response.status, 200); assert.equal(sheetRows(await readWorkbook(Buffer.from(await response.arrayBuffer()))).length, 502);
    });
    await t.test('删除只影响目标报告，删除不存在的记录返回404', async () => {
      assert.equal((await request('DELETE', `/reports/${weekly.id}`, caraToken)).status, 200);
      assert.equal((await request('DELETE', `/reports/${weekly.id}`, caraToken)).status, 404);
      assert.ok(await UserReport.findByPk(daily.id));
    });
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
    if (sequelize) await sequelize.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
  }
});
