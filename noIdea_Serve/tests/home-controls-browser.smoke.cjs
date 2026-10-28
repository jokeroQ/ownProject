// Focused Home controls regression. Never migrates or writes the configured user database.
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
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'home-controls-uploads-'));
  const artifacts = process.env.HOME_CONTROLS_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'home-controls-artifacts-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const previous = Object.fromEntries(['DB_NAME', 'THEME_UPLOAD_DIR', 'PORT'].map(name => [name, process.env[name]]));
  Object.assign(process.env, { DB_NAME: database, THEME_UPLOAD_DIR: uploads, PORT: '0' });
  let admin, created = false, sequelize, server, vite, browser, page, viteOutput = '';
  const sockets = new Set(), results = [], diagnostics = [], cleanupErrors = [];
  const record = text => diagnostics.push(String(text).replace(/[a-f0-9]{64}/gi, '[redacted]').slice(0, 1500));
  const shot = async name => {
    await page.waitForFunction(() => ![...document.querySelectorAll('.el-message')].some(element =>
      getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().height > 0), undefined, { timeout: 7000 });
    await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true });
  };
  const inspectToolbar = async viewport => {
    const geometry = await page.locator('[data-home-toolbar]').evaluate(element => [...element.children].map(button => {
      const bounds = button.getBoundingClientRect(), svg = button.querySelector('svg')?.getBoundingClientRect();
      return { tag: button.tagName, action: button.classList.contains('sidebar-action'), disabled: button.disabled,
        secondary: button.hasAttribute('data-home-secondary-action'), title: button.title, visible: bounds.width > 0 && bounds.height > 0,
        x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
        iconCentered: !!svg && Math.abs(svg.x + svg.width / 2 - bounds.x - bounds.width / 2) <= 1 &&
          Math.abs(svg.y + svg.height / 2 - bounds.y - bounds.height / 2) <= 1 };
    }));
    assert.equal(geometry.length, 5, 'Toolbar must contain five consistent button elements');
    assert.ok(geometry.every(button => button.tag === 'BUTTON' && button.action));
    assert.ok(geometry.slice(2).every(button => button.disabled && button.secondary && /暂无功能|暂未开放/.test(button.title)), 'Unimplemented actions must be disabled and clearly labelled');
    const visible = geometry.filter(button => button.visible);
    assert.equal(visible.length, viewport.width <= 900 ? 2 : 5);
    assert.ok(geometry.slice(0, 2).every(button => button.visible && !button.disabled));
    assert.ok(visible.every(button => button.iconCentered && Math.abs(button.width - visible[0].width) <= 1 &&
      Math.abs(button.height - visible[0].height) <= 1 && Math.abs(button.y - visible[0].y) <= 1), 'Visible icon button boxes must be uniform and centered');
    if (visible.length === 5) {
      const gaps = visible.slice(1).map((button, index) => button.x - visible[index].x - visible[index].width);
      assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, 'Desktop icon buttons must be evenly spaced');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1), 'Home must not overflow horizontally');
    return geometry;
  };
  const logoutStates = async (label, screenshots) => {
    const logout = page.locator('[data-home-logout]');
    const read = () => logout.evaluate(element => {
      const style = getComputedStyle(element), bounds = element.getBoundingClientRect();
      const danger = document.createElement('span'); danger.style.cssText = 'display:none;color:var(--el-color-danger)';
      document.body.appendChild(danger); const dangerColor = getComputedStyle(danger).color; danger.remove();
      return { width: bounds.width, height: bounds.height, color: style.color, background: style.backgroundColor,
        border: style.borderColor, borderWidth: style.borderWidth, radius: style.borderRadius, padding: style.padding,
        fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
        outline: style.outlineStyle, outlineWidth: style.outlineWidth, shadow: style.boxShadow,
        focusVisible: element.matches(':focus-visible'), dangerColor };
    });
    await logout.evaluate(element => element.blur()); await page.mouse.move(1, 1); await pause(220);
    const normal = await read(); if (screenshots) await shot(label + '-normal');
    await logout.hover(); await pause(220);
    const hover = await read(); if (screenshots) await shot(label + '-hover');
    await page.mouse.move(1, 1); await page.keyboard.press('Tab'); await logout.focus(); await pause(220);
    const focus = await read(); if (screenshots) await shot(label + '-focus');
    assert.ok(normal.width > 0 && normal.height >= 30 && normal.fontSize !== '0px');
    assert.equal(normal.color, normal.dangerColor, 'Logout normal text must retain the danger color');
    assert.ok(normal.background !== hover.background || normal.color !== hover.color || normal.border !== hover.border, 'Logout hover feedback must be visible');
    assert.ok(focus.focusVisible && (focus.outline !== 'none' && parseFloat(focus.outlineWidth) > 0 || focus.shadow !== 'none'), 'Logout must have a keyboard focus indicator');
    await logout.evaluate(element => element.blur()); await page.mouse.move(1, 1);
    return { normal, hover, focus };
  };
  try {
    admin = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
    assert.match(database, /^ownproject_test_[a-f0-9]{16}$/);
    await admin.query(`CREATE DATABASE \`${database}\``); created = true;
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    ({ sequelize } = require('../models'));
    const password = 'home-controls-password';
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
    const frontend = process.env.HOME_CONTROLS_FRONTEND_ROOT || path.resolve(__dirname, '../../noIdea_Front');
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
    const context = await browser.newContext();
    await context.addInitScript(session => { localStorage.setItem('token', session.token); localStorage.setItem('user', JSON.stringify(session.user)); }, login);
    page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', error => record('Page error: ' + error.message));
    page.on('console', message => { if (message.type() === 'error') record(message.text()); });
    const homeReady = async mode => {
      await page.locator('[data-section]').first().waitFor(); await page.locator('[data-home-logout]').waitFor();
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
      await page.waitForLoadState('networkidle');
    };
    const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
      { width: 844, height: 390 }, { width: 1366, height: 768 }];
    const logoutDialogOnly = process.env.HOME_CONTROLS_FOCUS === 'logout-dialog';
    for (const mode of ['light', 'dark']) {
      await request(login.token, 'PUT', '/theme', { mode, primaryColor: '#409eff', overlay: 0.35 });
      for (const viewport of viewports) {
        const label = `${mode}-${viewport.width}x${viewport.height}`, captureStates = [390, 1366].includes(viewport.width);
        await page.setViewportSize(viewport); await page.goto(url + '/home'); await homeReady(mode);
        if (logoutDialogOnly) {
          await page.locator('[data-home-logout]').click();
          const box = page.locator('.el-message-box.logout-confirm-dialog');
          await box.waitFor();
          const geometry = await box.evaluate(element => {
            const bounds = target => { const rect = target.getBoundingClientRect(); return { left: rect.left, top: rect.top,
              right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, center: rect.top + rect.height / 2 }; };
            return { box: bounds(element), title: bounds(element.querySelector('.el-message-box__title')),
              close: bounds(element.querySelector('.el-message-box__headerbtn')),
              icon: bounds(element.querySelector('.el-message-box__status')),
              message: bounds(element.querySelector('.el-message-box__message')),
              actions: [...element.querySelectorAll('.el-message-box__btns .el-button')].map(bounds),
              danger: getComputedStyle(element.querySelector('.logout-confirm-button')).getPropertyValue('--el-button-bg-color').trim() };
          });
          assert.ok(geometry.box.left >= 0 && geometry.box.right <= viewport.width && geometry.box.top >= 0 && geometry.box.bottom <= viewport.height,
            'Logout confirmation must fit the viewport');
          assert.ok(Math.abs(geometry.title.center - geometry.close.center) <= 2, 'Logout title and close action must align');
          assert.ok(Math.abs(geometry.icon.center - geometry.message.center) <= 2, 'Logout icon and message must align');
          assert.equal(geometry.actions.length, 2);
          assert.ok(geometry.actions.every(action => Math.abs(action.height - 32) <= 1) &&
            Math.abs(geometry.actions[0].top - geometry.actions[1].top) <= 1, 'Logout confirmation actions must align');
          assert.equal(geometry.danger, '#f56c6c', 'The confirmation must emphasize logout with the danger color');
          await shot('logout-dialog-' + label);
          await box.screenshot({ path: path.join(artifacts, 'logout-dialog-' + label + '-detail.png') });
          await box.getByRole('button', { name: '取消', exact: true }).click(); await box.waitFor({ state: 'hidden' });
          assert.ok(await page.evaluate(token => localStorage.getItem('token') === token, login.token), 'Cancelling logout must retain the session');
          results.push({ check: label + ' logout confirmation layout and cancel', passed: true, geometry });
          continue;
        }
        const beforeToolbar = await inspectToolbar(viewport), before = await logoutStates('home-direct-' + label, captureStates);
        await page.locator('[data-admin-entry]').click(); await page.waitForURL(target => target.pathname === '/admin/users');
        await page.getByRole('heading', { name: '用户管理', exact: true }).waitFor();
        await page.getByRole('button', { name: /返回首页/ }).click(); await page.waitForURL(target => target.pathname === '/home'); await homeReady(mode);
        const afterToolbar = await inspectToolbar(viewport), after = await logoutStates('home-return-' + label, captureStates);
        assert.deepEqual(after, before, 'Logout normal, hover and focus styles must survive visiting user management');
        assert.deepEqual(afterToolbar, beforeToolbar, 'Toolbar button layout must survive visiting user management');
        if (!captureStates) await shot('home-return-' + label);
        results.push({ check: label + ' direct and returned Home controls', passed: true, logout: after, toolbar: afterToolbar });
        console.log('PASS: Home controls ' + label);
      }
      if (logoutDialogOnly) continue;
      await page.setViewportSize(viewports[1]);
      await page.locator('[data-home-add-category]').click();
      await page.getByPlaceholder('请输入标签名称').fill('Home controls ' + mode);
      const addResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/menu/addMenus'));
      await page.getByRole('dialog').last().getByRole('button', { name: '确认', exact: true }).click(); assert.ok((await addResponse).ok());
      await page.getByPlaceholder('请输入标签名称').waitFor({ state: 'hidden' });
      assert.ok((await request(login.token, 'GET', '/menu/getMenus')).data.some(menu => menu.title === 'Home controls ' + mode));
      await page.locator('[data-home-edit-mode]').click(); await page.locator('.drag-help').waitFor();
      assert.equal(await page.locator('[data-home-edit-mode]').getAttribute('aria-pressed'), 'true');
      await page.getByText('退出编辑模式', { exact: true }).click(); await page.locator('.drag-help').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-home-edit-mode]').getAttribute('aria-pressed'), 'false');
      await page.locator('[data-home-logout]').click();
      await page.locator('.el-message-box').getByRole('button', { name: '取消', exact: true }).click();
      await page.locator('.el-message-box').waitFor({ state: 'hidden' });
      assert.ok(await page.evaluate(token => localStorage.getItem('token') === token, login.token), 'Cancelling logout must retain the session');
      await request(login.token, 'GET', '/users/me'); await shot('home-workflow-' + mode);
      results.push({ check: mode + ' add category, editing and cancelled logout', passed: true });
    }
    await page.locator('[data-home-logout]').click();
    await page.locator('.el-message-box').getByRole('button', { name: '退出', exact: true }).click({ trial: true });
    await shot('home-logout-confirmation');
    const logoutResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/users/logout'));
    await page.locator('.el-message-box').getByRole('button', { name: '退出', exact: true }).click(); assert.ok((await logoutResponse).ok());
    await page.waitForURL(target => target.pathname === '/');
    assert.ok(!await page.evaluate(() => localStorage.getItem('token')), 'Confirmed logout must clear the browser session');
    await request(login.token, 'GET', '/users/me', undefined, 401);
    await page.goto(url + '/home'); await page.waitForURL(target => target.pathname === '/');
    results.push({ check: 'confirmed logout revokes the session and protects Home', passed: true });
    console.log(`Home controls smoke: ${results.length} focused checks passed. Artifacts: ${artifacts}`);
  } catch (error) {
    results.push({ check: 'Home controls scenario', passed: false, message: error.message });
    if (viteOutput) record('Vite: ' + viteOutput);
    try { if (page) await shot('failure'); } catch { /* Cleanup must continue. */ }
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
    await clean(async () => { if (admin) await admin.end(); }); await clean(async () => fs.rmSync(uploads, { recursive: true, force: true }));
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    if (cleanupErrors.length) { console.error('Home controls cleanup failed: ' + cleanupErrors.join('; ')); process.exitCode = 1; }
    console.log('Home controls report: ' + path.join(artifacts, 'report.json'));
  }
}
main().catch(error => { console.error('Home controls smoke failed: ' + error.message); process.exitCode = 1; });
