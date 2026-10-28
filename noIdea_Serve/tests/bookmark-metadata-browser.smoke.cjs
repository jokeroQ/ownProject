// Uses a disposable database; never writes the configured user database.
require('../config/env');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (await check()) return; await pause(100); }
  throw new Error(message);
}
async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}
async function main() {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-metadata-uploads-'));
  const artifacts = process.env.BOOKMARK_METADATA_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-metadata-artifacts-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const previous = Object.fromEntries(['DB_NAME', 'THEME_UPLOAD_DIR', 'PORT'].map(name => [name, process.env[name]]));
  Object.assign(process.env, { DB_NAME: database, THEME_UPLOAD_DIR: uploads, PORT: '0' });
  let admin, created = false, sequelize, server, vite, browser, page, viteOutput = '';
  const sockets = new Set(), results = [], diagnostics = [], cleanupErrors = [];
  const pass = check => { results.push({ check, passed: true }); console.log('PASS: ' + check); };
  const record = message => diagnostics.push(String(message).replace(/[a-f0-9]{64}/gi, '[redacted]').slice(0, 1500));
  try {
    admin = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
    assert.match(database, /^ownproject_test_[a-f0-9]{16}$/);
    await admin.query(`CREATE DATABASE \`${database}\``); created = true;
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    ({ sequelize } = require('../models'));
    const password = 'bookmark-metadata-password';
    await admin.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())',
      ['cara', 'cara@example.test', await require('bcryptjs').hash(password, 10)]);
    for (const migration of ['user-data', 'themes', 'flowcharts', 'chat']) await require(`../migrations/${migration}`)();
    server = await require('../app').start();
    server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const api = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (token, method, route, body, status = 200) => {
      const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.equal(response.status, status, `${method} ${route} should return ${status}`); return response.json();
    };
    const login = await request(null, 'POST', '/users/login', { username: 'cara', password });
    await request(null, 'POST', '/menu/metadata', { url: 'https://example.com' }, 401);
    const invalid = await request(login.token, 'POST', '/menu/metadata', { url: 'http://127.0.0.1' }, 400);
    assert.match(invalid.message, /公网/);
    pass('metadata endpoint requires authentication and rejects local addresses');
    const menu = (await request(login.token, 'POST', '/menu/addMenus', { title: '自动获取测试' }, 201)).data;
    const frontend = path.resolve(__dirname, '../../noIdea_Front');
    const port = await freePort(), url = `http://127.0.0.1:${port}`;
    vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { cwd: frontend, env: { ...process.env, VITE_API_BASE_URL: api, VITE_CACHE_DIR: path.join(uploads, 'vite-cache') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let spawnError;
    vite.stdout.on('data', text => { viteOutput = (viteOutput + text).slice(-5000); });
    vite.stderr.on('data', text => { viteOutput = (viteOutput + text).slice(-5000); }); vite.once('error', error => { spawnError = error; });
    await until(async () => {
      if (spawnError || vite.exitCode !== null) throw new Error('Vite failed: ' + (spawnError?.message || viteOutput));
      try { return (await fetch(url)).ok; } catch { return false; }
    }, 'Vite did not become ready');
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await context.addInitScript(session => { localStorage.setItem('token', session.token); localStorage.setItem('user', JSON.stringify(session.user)); }, login);
    page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => record('Page error: ' + error.message));
    await page.goto(url + '/home');
    await page.locator(`[data-section="${menu.id}"]`).waitFor();
    await page.locator('[data-home-edit-mode]').click();
    const section = page.locator(`[data-section="${menu.id}"]`);
    const dialog = page.locator('.el-dialog').filter({ has: page.locator('[data-bookmark-auto-title]') });
    const title = () => dialog.getByRole('textbox', { name: '书签名称', exact: true });
    const target = () => dialog.getByRole('textbox', { name: '目标网址', exact: true });
    const icon = () => dialog.getByRole('textbox', { name: '图标地址或名称首字', exact: true });
    const titleButton = () => dialog.locator('[data-bookmark-auto-title]');
    const iconButton = () => dialog.locator('[data-bookmark-auto-icon]');
    const open = async () => { await page.locator(`[data-home-add-bookmark="${menu.id}"]`).click(); await dialog.waitFor(); };
    const cancel = async () => { await dialog.getByRole('button', { name: '取消', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); };
    const save = async () => {
      const response = page.waitForResponse(res => /\/api\/menu\/(?:add|update)Submenus\//.test(res.url()) && ['POST', 'PUT'].includes(res.request().method()));
      await dialog.getByRole('button', { name: '确认', exact: true }).click(); assert.ok((await response).ok());
      await dialog.waitFor({ state: 'hidden' });
    };
    if (process.env.BOOKMARK_METADATA_LIVE_URL) {
      await open(); await target().fill(process.env.BOOKMARK_METADATA_LIVE_URL);
      const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/menu/metadata' && res.request().method() === 'POST');
      await titleButton().click();
      const live = await response;
      const body = await live.json();
      assert.equal(live.status(), 200, body.message);
      assert.ok(body.data.title, 'The live website should return a name');
      await until(async () => (await title().inputValue()) === body.data.title, 'Live title did not populate');
      await iconButton().click();
      await until(async () => (await icon().inputValue()) === body.data.icon, 'Live icon did not populate');
      await until(async () => dialog.locator('.bookmark-icon img').count() && dialog.locator('.bookmark-icon img').evaluate(img =>
        img.complete && img.naturalWidth > 0 && img.referrerPolicy === 'no-referrer'), 'Live icon address did not render as an image');
      if (process.env.BOOKMARK_METADATA_EXPECT_TITLE) assert.ok((await title().inputValue()).includes(process.env.BOOKMARK_METADATA_EXPECT_TITLE));
      await page.waitForFunction(() => ![...document.querySelectorAll('.el-message')].some(element => element.getBoundingClientRect().height > 0));
      await dialog.screenshot({ path: path.join(artifacts, 'live-website.png') });
      pass('real website name and visible image through browser and authenticated API: ' + body.data.title);
      await cancel();
    }
    let metadataRequests = 0;
    page.on('request', req => { if (new URL(req.url()).pathname === '/api/menu/metadata') metadataRequests++; });
    await open(); await target().fill('/chat?source=bookmark#messages');
    await titleButton().click(); assert.equal(await title().inputValue(), '聊天页面');
    await iconButton().click(); assert.equal(await icon().inputValue(), '聊');
    assert.equal(await dialog.locator('.bookmark-initial').textContent(), '聊');
    assert.equal(await dialog.locator('.bookmark-icon img').count(), 0);
    assert.equal(metadataRequests, 0);
    await dialog.screenshot({ path: path.join(artifacts, 'internal-desktop.png') });
    await save();
    await section.getByText('聊天页面', { exact: true }).waitFor();
    let saved = (await request(login.token, 'GET', `/menu/getSubmenus/${menu.id}`)).data;
    assert.equal(saved[0].icon, '聊');
    pass('add internal route with query/hash, route title and persisted text icon');
    await page.reload(); await section.getByText('聊天页面', { exact: true }).waitFor();
    const card = section.locator('.draggable-item').filter({ hasText: '聊天页面' });
    assert.equal(await card.locator('.bookmark-initial').textContent(), '聊');
    await page.locator('[data-home-edit-mode]').click();
    await card.getByRole('button', { name: '编辑书签', exact: true }).click();
    await target().fill(url + '/flowchart?mode=edit#canvas');
    await titleButton().click(); assert.equal(await title().inputValue(), '流程图');
    await iconButton().click(); assert.equal(await icon().inputValue(), '流'); await save();
    saved = (await request(login.token, 'GET', `/menu/getSubmenus/${menu.id}`)).data;
    assert.equal(saved[0].title, '流程图'); assert.equal(saved[0].icon, '流');
    pass('reload and edit same-origin absolute route with persisted icon');
    await open();
    await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.addRoute({
      path: '/metadata-test-new', name: 'newTool', meta: { title: '新增工具' }, component: { template: '<div />' },
    }));
    await target().fill('/metadata-test-new'); await titleButton().click(); assert.equal(await title().inputValue(), '新增工具');
    await iconButton().click(); assert.equal(await icon().inputValue(), '新');
    await target().fill('/register'); await titleButton().click(); assert.equal(await title().inputValue(), 'register');
    await iconButton().click(); assert.equal(await icon().inputValue(), 'r');
    pass('newly registered route titles and route.name fallback need no hardcoded page list');
    await target().fill('/unknown-page'); await title().fill('自定义😀页面'); await icon().fill('旧');
    await titleButton().click(); assert.equal(await title().inputValue(), '自定义😀页面');
    await iconButton().click(); assert.equal(await icon().inputValue(), '自');
    await title().fill('😀工具'); await iconButton().click(); assert.equal(await icon().inputValue(), '😀');
    pass('unknown route preserves custom name; first character supports Chinese and emoji');
    await target().fill('javascript:alert(1)'); await titleButton().click(); assert.equal(await title().inputValue(), '😀工具');
    assert.equal(metadataRequests, 0); await cancel();
    let pendingRelease;
    await page.route(candidate => candidate.pathname === '/api/menu/metadata', async route => {
      if (route.request().method() === 'OPTIONS') { await route.continue(); return; }
      const input = route.request().postDataJSON().url;
      if (input.includes('/slow')) await new Promise(resolve => { pendingRelease = resolve; });
      const data = { title: input.includes('/fresh') ? '新网站' : '外部示例', icon: 'https://example.com/assets/site.svg', url: input };
      try { await route.fulfill({ status: input.includes('/failure') ? 502 : 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(input.includes('/failure') ? { message: '网站暂时无法读取', status: 502 } : { data, status: 200 }) }); }
      catch { /* The frontend can cancel obsolete requests. */ }
    });
    await page.route('https://example.com/assets/site.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#409eff"/><circle cx="20" cy="20" r="9" fill="white"/></svg>' }));
    await page.route('https://example.com/assets/broken.ico', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing' }));
    await open(); await target().fill('https://example.com/article');
    const before = metadataRequests;
    await titleButton().click(); await iconButton().click();
    await until(async () => (await title().inputValue()) === '外部示例' && (await icon().inputValue()).endsWith('/site.svg'), 'External metadata did not populate');
    assert.equal(metadataRequests - before, 1, 'Both buttons should share one request');
    await until(() => dialog.locator('.bookmark-icon img').evaluate(img => img.complete && img.naturalWidth > 0), 'Icon did not load');
    assert.equal(await dialog.locator('.bookmark-icon img').getAttribute('referrerpolicy'), 'no-referrer');
    for (const value of ['聊', 'b', '😀']) {
      await icon().fill(value);
      assert.equal(await dialog.locator('.bookmark-initial').textContent(), value);
      assert.equal(await dialog.locator('.bookmark-icon img').count(), 0);
    }
    await icon().fill('https://example.com/assets/broken.ico');
    await until(async () => await dialog.locator('.bookmark-initial').textContent() === '外', 'Broken image should fall back to title initial');
    await icon().fill('https://example.com/assets/site.svg');
    await until(() => dialog.locator('.bookmark-icon img').evaluate(img => img.complete && img.naturalWidth > 0), 'Image should recover after switching formats');
    pass('URL and Chinese, Latin, emoji text icons switch correctly; broken images recover');
    await save(); await section.getByText('外部示例', { exact: true }).waitFor();
    await page.reload(); await section.getByText('外部示例', { exact: true }).waitFor();
    await until(() => section.locator('.draggable-item').filter({ hasText: '外部示例' }).locator('.bookmark-icon img')
      .evaluate(img => img.complete && img.naturalWidth > 0), 'Saved image icon should render after reload');
    await page.locator('[data-home-edit-mode]').click();
    pass('external title and image icon share one request and save correctly');
    await open(); await target().fill('https://example.com/slow-manual'); await title().fill('原名称');
    await titleButton().click(); await until(() => !!pendingRelease, 'Pending request missing');
    assert.equal(await dialog.getByRole('button', { name: '确认', exact: true }).isDisabled(), true);
    await title().fill('我手动输入的名称'); pendingRelease(); pendingRelease = undefined;
    await until(async () => !(await titleButton().getAttribute('class')).includes('is-loading'), 'Loading state stuck');
    assert.equal(await title().inputValue(), '我手动输入的名称');
    pass('pending response preserves a manually edited name');
    await target().fill('https://example.com/slow-old'); await titleButton().click(); await until(() => !!pendingRelease, 'Old request missing');
    const releaseOld = pendingRelease; pendingRelease = undefined;
    await target().fill('https://example.com/fresh'); await titleButton().click();
    await until(async () => (await title().inputValue()) === '新网站', 'New URL not applied');
    releaseOld(); await pause(150); assert.equal(await title().inputValue(), '新网站');
    pass('changing URL cancels old results and accepts the latest response');
    await target().fill('https://example.com/failure'); await icon().fill('保');
    await titleButton().click(); await page.getByText('网站暂时无法读取', { exact: true }).waitFor();
    assert.equal(await title().inputValue(), '新网站'); assert.equal(await icon().inputValue(), '保');
    await target().fill('https://example.com/slow-close'); await titleButton().click(); await until(() => !!pendingRelease, 'Close request missing');
    const releaseClosed = pendingRelease; pendingRelease = undefined; await cancel(); await open(); releaseClosed(); await pause(150);
    assert.equal(await title().inputValue(), ''); assert.equal(await icon().inputValue(), '');
    assert.equal(await dialog.getByRole('button', { name: '确认', exact: true }).isEnabled(), true);
    pass('failed and closed-dialog requests preserve data and reset loading states');
    for (const mode of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.dataset.theme = value, mode);
      await page.setViewportSize({ width: 390, height: 844 });
      await target().fill('/signPad'); await titleButton().click(); await iconButton().click();
      assert.equal(await title().inputValue(), '签名板页面'); assert.equal(await icon().inputValue(), '签');
      const bounds = await dialog.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391 && bounds.y >= 0 && bounds.y + bounds.height <= 845);
      await dialog.screenshot({ path: path.join(artifacts, `internal-mobile-${mode}.png`) });
      pass(mode + ' mobile dialog and internal metadata');
    }
    assert.ok(!diagnostics.some(value => value.startsWith('Page error:')), diagnostics.join('\n'));
    console.log(`Bookmark metadata smoke: ${results.length} checks passed. Artifacts: ${artifacts}`);
  } catch (error) {
    results.push({ check: 'bookmark metadata scenario', passed: false, message: error.message });
    record('Vite: ' + viteOutput);
    try { if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); } catch { /* Continue cleanup. */ }
    throw error;
  } finally {
    const clean = async action => { try { await action(); } catch (error) { cleanupErrors.push(error.message); } };
    await clean(async () => fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify({ results, diagnostics }, null, 2)));
    await clean(async () => { if (browser) await browser.close(); });
    await clean(async () => {
      if (vite && vite.exitCode === null && vite.signalCode === null) {
        vite.kill(); await Promise.race([new Promise(resolve => vite.once('exit', resolve)), pause(5000)]);
        if (vite.exitCode === null && vite.signalCode === null) vite.kill('SIGKILL');
      }
    });
    await clean(async () => {
      if (server?.io) await new Promise(resolve => server.io.close(resolve));
      for (const socket of sockets) socket.destroy();
      if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });
    await clean(async () => { if (sequelize) await sequelize.close(); });
    await clean(async () => { if (admin && created) { assert.match(database, /^ownproject_test_[a-f0-9]{16}$/); await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); } });
    await clean(async () => { if (admin) await admin.end(); });
    await clean(async () => fs.rmSync(uploads, { recursive: true, force: true }));
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    if (cleanupErrors.length) { console.error('Bookmark metadata cleanup failed: ' + cleanupErrors.join('; ')); process.exitCode = 1; }
  }
}
main().catch(error => { console.error('Bookmark metadata smoke failed: ' + error.stack); process.exitCode = 1; });
