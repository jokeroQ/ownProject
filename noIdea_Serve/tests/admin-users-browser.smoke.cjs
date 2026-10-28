// Optional real-browser integration test. Connection credentials come from .env;
// migrations and writes always target a new random database owned by this test.
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
async function until(check, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
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
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(5000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

async function main() {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-users-uploads-'));
  const artifacts = process.env.ADMIN_BROWSER_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'admin-users-artifacts-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const previous = Object.fromEntries(['DB_NAME', 'THEME_UPLOAD_DIR', 'PORT'].map(name => [name, process.env[name]]));
  Object.assign(process.env, { DB_NAME: database, THEME_UPLOAD_DIR: uploads, PORT: '0' });
  let connection, created = false, sequelize, server, vite, browser, viteOutput = '';
  const sockets = new Set(), diagnostics = [], results = [], cleanupErrors = [];
  const password = 'admin-browser-password';
  const resetPassword = 'admin-browser-new-password';
  const record = text => {
    diagnostics.push(String(text).replace(/[a-f0-9]{64}/gi, '[redacted]').slice(0, 1200));
    if (diagnostics.length > 100) diagnostics.shift();
  };
  const passed = message => { results.push({ check: message, passed: true }); console.log('PASS: ' + message); };
  const screenshot = async (page, name) => {
    await page.waitForFunction(() => [...document.querySelectorAll('.el-message')].every(element => {
      const style = getComputedStyle(element);
      return style.display === 'none' || style.visibility === 'hidden' || element.getBoundingClientRect().height === 0;
    }), undefined, { timeout: 7000 });
    const destination = path.join(artifacts, name + '.png');
    await page.screenshot({ path: destination, fullPage: true, timeout: 10000 });
    return destination;
  };
  const layout = async (page, label) => {
    const metrics = await page.evaluate(() => {
      const width = innerWidth;
      const internal = element => {
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const bounds = parent.getBoundingClientRect();
          if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX) && bounds.left >= -1 && bounds.right <= width + 1) return true;
        }
        return false;
      };
      const overflow = [...document.querySelectorAll('body *')].filter(element => {
        if (element instanceof SVGElement) return false;
        const bounds = element.getBoundingClientRect(), style = getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0' &&
          (bounds.left < -1 || bounds.right > width + 1) && !internal(element);
      }).slice(0, 10).map(element => ({ element: element.tagName.toLowerCase() + '.' + [...element.classList].slice(0, 3).join('.'),
        left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right) }));
      return { viewport: { width, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, overflow };
    });
    const success = metrics.documentWidth <= metrics.viewport.width + 1 && metrics.bodyWidth <= metrics.viewport.width + 1 && metrics.overflow.length === 0;
    results.push({ check: label, passed: success, ...metrics });
    assert.ok(success, `${label} has horizontal overflow: ${JSON.stringify(metrics)}`);
  };
  const reachable = async (locator, label) => {
    await locator.click({ trial: true, timeout: 5000 });
    const box = await locator.boundingBox(), viewport = locator.page().viewportSize();
    assert.ok(box && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 &&
      box.y + box.height <= viewport.height + 1, `${label} must be reachable inside the viewport`);
  };
  const toolbarAlignment = async (page, label) => {
    const controls = [page.locator('[data-admin-search]'), page.getByRole('button', { name: '搜索', exact: true }),
      page.getByRole('button', { name: '刷新', exact: true })];
    const boxes = await Promise.all(controls.map(control => control.boundingBox()));
    assert.ok(boxes.every(box => box && Math.abs(box.height - 32) <= 1), `${label}: search input, search and refresh controls must all be 32px high`);
    if (page.viewportSize().width > 900) {
      const centers = boxes.map(box => box.y + box.height / 2);
      assert.ok(Math.max(...centers) - Math.min(...centers) <= 2, `${label}: desktop toolbar controls must share a vertical center`);
    }
    results.push({ check: label, passed: true, heights: boxes.map(box => box.height) });
  };
  const iconButtons = async (page, label) => {
    const controls = [
      [page.locator('.admin-header').getByRole('button', { name: '返回首页', exact: true }), '返回首页'],
      [page.locator('[data-admin-edit]').first(), '编辑用户'],
      [page.locator('[data-admin-reset-password]').first(), '重置密码'],
      [page.locator('[data-admin-prev]'), '上一页'],
      [page.locator('[data-admin-next]'), '下一页'],
    ];
    for (const [control, name] of controls) {
      assert.equal(await control.getAttribute('aria-label'), name);
      assert.equal((await control.innerText()).trim(), '', name + ' must use only an icon');
      assert.equal(await control.locator('svg').count(), 1, name + ' must render its icon');
      const box = await control.boundingBox();
      assert.ok(box && Math.abs(box.width - 32) <= 1 && Math.abs(box.height - 32) <= 1, name + ' must be a compact square');
    }
    const edit = controls[1][0];
    await edit.hover();
    await page.getByRole('tooltip', { name: '编辑用户', exact: true }).waitFor();
    await controls[2][0].hover();
    await page.getByRole('tooltip', { name: '重置密码', exact: true }).waitFor();
    await page.mouse.move(0, 0);
    results.push({ check: label, passed: true });
  };
  const desktopColumns = async page => {
    const geometry = await page.locator('.users-table').evaluate(table => {
      const rows = [...table.querySelectorAll('tbody tr')];
      const columns = rows.map(row => [...row.cells].map(cell => cell.getBoundingClientRect().left));
      const vertical = rows.map(row => [row.querySelector('.role-tag'), row.querySelector('.created-at time'), row.querySelector('.row-actions')]
        .map(element => { const bounds = element.getBoundingClientRect(); return bounds.top + bounds.height / 2; }));
      return { columns, vertical };
    });
    assert.ok(geometry.columns.every(columns => columns.every((left, index) => Math.abs(left - geometry.columns[0][index]) <= 1)),
      'Desktop cells in the same column must share a left edge');
    assert.ok(geometry.vertical.every(centers => Math.max(...centers) - Math.min(...centers) <= 3),
      'Desktop role, registration date and row actions must be vertically centered together');
    results.push({ check: 'desktop table column and vertical alignment', passed: true });
  };
  const dialogAlignment = async (page, label) => {
    const dialog = page.getByRole('dialog').last();
    const geometry = await dialog.evaluate(element => {
      const items = [...element.querySelectorAll('.el-form-item')].filter(item => item.querySelector('.el-form-item__label'));
      const fields = items.map(item => {
        const label = item.querySelector('.el-form-item__label');
        const wrapper = item.querySelector('.el-select__wrapper, .el-input__wrapper');
        const labelBounds = label.getBoundingClientRect(), bounds = wrapper.getBoundingClientRect();
        const text = document.createRange(); text.selectNodeContents(label);
        return { labelLeft: labelBounds.left, labelWidth: labelBounds.width, labelRight: text.getBoundingClientRect().right,
          labelCenter: labelBounds.top + labelBounds.height / 2, controlLeft: bounds.left,
          controlCenter: bounds.top + bounds.height / 2, height: bounds.height };
      });
      return { fields, footer: [...element.querySelectorAll('.el-dialog__footer .el-button')].map(button => {
        const bounds = button.getBoundingClientRect(); return { height: bounds.height, top: bounds.top };
      }) };
    });
    assert.ok(geometry.fields.length >= 2 && geometry.fields.every(field => Math.abs(field.height - 40) <= 1), `${label}: input wrappers and role select must be 40px high`);
    assert.ok(geometry.fields.every(field => Math.abs(field.labelWidth - 80) <= 1 && Math.abs(field.labelCenter - field.controlCenter) <= 1 && field.labelRight < field.controlLeft),
      `${label}: 80px labels and controls must share a row and vertical center, with a gap after the label text`);
    assert.ok(geometry.fields.every(field => Math.abs(field.labelLeft - geometry.fields[0].labelLeft) <= 1 && Math.abs(field.controlLeft - geometry.fields[0].controlLeft) <= 1),
      `${label}: labels and controls must each have consistent left edges`);
    assert.equal(geometry.footer.length, 2, `${label}: both footer actions must be present`);
    assert.ok(geometry.footer.every(button => Math.abs(button.height - 32) <= 1) && Math.abs(geometry.footer[0].top - geometry.footer[1].top) <= 1,
      `${label}: footer actions must be aligned and 32px high`);
    for (const button of await dialog.locator('.el-dialog__footer .el-button').all()) {
      if (!await button.isDisabled()) await reachable(button, label + ' footer action');
      else {
        await button.scrollIntoViewIfNeeded();
        assert.ok(await button.evaluate(element => {
          const bounds = element.getBoundingClientRect(), hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
          return bounds.left >= -1 && bounds.right <= innerWidth + 1 && bounds.top >= -1 && bounds.bottom <= innerHeight + 1 &&
            !!hit && (hit === element || element.contains(hit));
        }), label + ': disabled footer action must remain visible and uncovered');
      }
    }
    results.push({ check: label, passed: true, geometry });
  };
  try {
    connection = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
    assert.match(database, /^ownproject_test_[a-f0-9]{16}$/);
    await connection.query(`CREATE DATABASE \`${database}\``); created = true;
    await connection.query(`USE \`${database}\``);
    await connection.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    const models = require('../models'); sequelize = models.sequelize;
    const fixtureHash = await require('bcryptjs').hash(password, 10);
    await connection.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())', ['cara', 'cara@example.test', fixtureHash]);
    for (const migration of ['user-data', 'themes', 'flowcharts', 'chat']) await require(`../migrations/${migration}`)();
    server = await require('../app').start();
    server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const api = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (token, method, route, body, expected = 200) => {
      const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.equal(response.status, expected, `${method} ${route} should return ${expected}`);
      return response.json();
    };
    const register = (username, email) => request(null, 'POST', '/users/register', { username, email, password }, 201).then(body => body.user);
    const alice = await register('admin-browser-alice', 'admin-browser-alice@example.test');
    const bob = await register('admin-browser-bob', 'admin-browser-bob@example.test');
    const longName = 'LongUserNameWithoutSpaces'.repeat(8);
    const longUser = await register(longName, 'LongEmailAddress'.repeat(10) + '@example.test');
    // Filler accounts exercise actual UI pagination without extra password hashing.
    await models.User.bulkCreate(Array.from({ length: 12 }, (_, index) => ({ username: `admin-fixture-${String(index + 1).padStart(2, '0')}`,
      email: `admin-fixture-${index + 1}@example.test`, password: fixtureHash, role: 'user', created_at: new Date() })));
    const aliceSession = await request(null, 'POST', '/users/login', { username: alice.username, password });
    const bobOtherSession = await request(null, 'POST', '/users/login', { username: bob.username, password });
    const seededAdmin = await request(null, 'POST', '/users/login', { username: 'cara', password });
    assert.equal(seededAdmin.user.role, 'admin', 'The isolated fixture must provide a valid administrator login');
    const frontend = process.env.ADMIN_BROWSER_FRONTEND_ROOT || path.resolve(__dirname, '../../noIdea_Front');
    const frontendPort = Number(process.env.ADMIN_BROWSER_FRONTEND_PORT || await freePort());
    const url = `http://127.0.0.1:${frontendPort}`;
    vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'],
      { cwd: frontend, env: { ...process.env, VITE_API_BASE_URL: api, VITE_CACHE_DIR: path.join(uploads, 'vite-cache') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let spawnError;
    vite.stdout.on('data', data => { viteOutput = (viteOutput + data).slice(-5000); });
    vite.stderr.on('data', data => { viteOutput = (viteOutput + data).slice(-5000); });
    vite.once('error', error => { spawnError = error; });
    await until(async () => {
      if (spawnError || vite.exitCode !== null) throw new Error('Vite failed to start: ' + (spawnError?.message || viteOutput));
      try { return (await fetch(url)).ok; } catch { return false; }
    }, 'Vite did not become ready', 20000);
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const adminContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const ordinaryContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const anonymousContext = await browser.newContext();
    const adminPage = await adminContext.newPage(), ordinaryPage = await ordinaryContext.newPage(), anonymousPage = await anonymousContext.newPage();
    for (const [label, page] of [['Admin', adminPage], ['Ordinary', ordinaryPage], ['Anonymous', anonymousPage]]) {
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => record(`${label} pageerror: ${error.message}`));
      page.on('console', message => { if (message.type() === 'error') record(`${label} console: ${message.text()}`); });
      page.on('requestfailed', req => record(`${label} request failed: ${req.method()} ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`));
    }
    const loginInBrowser = async (page, username, secret) => {
      await page.goto(url); await page.locator('input[type=password]').waitFor();
      // A first Vite dependency optimization can reload the initial login document.
      await page.waitForLoadState('networkidle'); await pause(800);
      await page.locator('input').first().fill(username); await page.locator('input[type=password]').fill(secret);
      const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/users/login'));
      await page.getByRole('button', { name: '登录', exact: true }).click();
      const response = await responsePromise;
      const submitted = response.request().postDataJSON();
      assert.ok(submitted.username === username && submitted.password === secret, 'The login form must preserve the fixture credentials until submission');
      assert.ok(response.ok(), 'Browser login should succeed');
      await page.waitForURL(target => target.pathname !== '/' && target.pathname !== '/register');
      return page.evaluate(() => localStorage.getItem('token'));
    };
    const adminToken = await loginInBrowser(adminPage, 'cara', password);
    const ordinaryToken = await loginInBrowser(ordinaryPage, bob.username, password);
    assert.ok(adminToken && ordinaryToken, 'Both browser contexts must have independent sessions');
    assert.equal(await ordinaryPage.getByRole('link', { name: '用户管理', exact: true }).count(), 0, 'Ordinary user should not see the management entry');
    await adminPage.getByRole('link', { name: '用户管理', exact: true }).click(); await adminPage.waitForURL(target => target.pathname === '/admin/users');
    await adminPage.locator('[data-admin-user]').first().waitFor();
    await layout(adminPage, 'desktop user list'); await toolbarAlignment(adminPage, 'desktop toolbar alignment');
    await desktopColumns(adminPage); await screenshot(adminPage, 'admin-users-desktop');
    await iconButtons(adminPage, 'desktop compact icons and hover tooltip');
    const back = adminPage.locator('.admin-header').getByRole('button', { name: '返回首页', exact: true });
    await back.focus(); await back.press('Enter');
    await adminPage.waitForURL(target => target.pathname === '/home');
    await adminPage.getByRole('link', { name: '用户管理', exact: true }).click();
    await adminPage.waitForURL(target => target.pathname === '/admin/users');
    await adminPage.locator('[data-admin-user]').first().waitFor();
    await anonymousPage.goto(url + '/admin/users'); await anonymousPage.waitForURL(target => target.pathname === '/');
    await request(null, 'GET', '/admin/users', undefined, 401);
    for (const [method, route, body] of [['GET', '/admin/users'], ['PATCH', `/admin/users/${alice.id}`, { role: 'admin' }],
      ['PUT', `/admin/users/${alice.id}/password`, { password: resetPassword }]]) await request(ordinaryToken, method, route, body, 403);
    await ordinaryPage.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('user')); localStorage.setItem('user', JSON.stringify({ ...user, role: 'admin' }));
    });
    await ordinaryPage.goto(url + '/admin/users'); await ordinaryPage.waitForURL(target => target.pathname !== '/admin/users');
    assert.equal(await ordinaryPage.locator('[data-admin-user]').count(), 0, 'Forged cached role must not reveal the admin page');
    assert.equal(await ordinaryPage.evaluate(() => JSON.parse(localStorage.getItem('user')).role), 'user');
    passed('管理员入口可进入，普通和匿名用户无入口且直接路由/接口访问受限');

    const firstPage = (await request(adminToken, 'GET', '/admin/users?page=1&pageSize=2')).data;
    const secondPage = (await request(adminToken, 'GET', '/admin/users?page=2&pageSize=2')).data;
    assert.equal(firstPage.users.length, 2); assert.equal(secondPage.users.length, 2);
    assert.equal(firstPage.total, 16); assert.equal(firstPage.adminCount, 1);
    assert.equal(new Set([...firstPage.users, ...secondPage.users].map(user => user.id)).size, 4);
    const filtered = (await request(adminToken, 'GET', '/admin/users?keyword=' + encodeURIComponent(bob.username))).data;
    assert.equal(filtered.total, 1); assert.equal(filtered.adminCount, 1, 'Administrator count must remain global when searching ordinary users');
    for (const user of firstPage.users) assert.ok(!('password' in user) && !('token' in user), 'List rows must expose only public account fields');
    const pageSize = adminPage.locator('[data-admin-page-size]');
    if (await pageSize.count()) {
      await pageSize.locator('.el-select__wrapper').click();
      await adminPage.getByRole('option', { name: '10 条', exact: true }).click();
    }
    const initialIds = await adminPage.locator('[data-admin-user]').evaluateAll(rows => rows.map(row => row.getAttribute('data-admin-user')));
    await adminPage.locator('[data-admin-next]').click();
    await until(async () => {
      const ids = await adminPage.locator('[data-admin-user]').evaluateAll(rows => rows.map(row => row.getAttribute('data-admin-user')));
      return ids.length > 0 && ids.join(',') !== initialIds.join(',');
    }, 'Next page should replace the displayed rows');
    await adminPage.locator('[data-admin-prev]').click();
    passed('用户搜索和分页正确，全局管理员数量不受筛选影响，列表不泄漏密码或令牌');

    const row = id => adminPage.locator(`[data-admin-user="${id}"]:visible`);
    const search = async (keyword, id) => {
      const responsePromise = adminPage.waitForResponse(response => {
        const target = new URL(response.url());
        return response.request().method() === 'GET' && target.pathname.endsWith('/api/admin/users') && (target.searchParams.get('keyword') || '') === keyword;
      });
      await adminPage.locator('[data-admin-search]').fill(keyword); await adminPage.locator('[data-admin-search]').press('Enter');
      const response = await responsePromise;
      assert.ok(response.ok());
      if (id !== undefined) await row(id).waitFor();
      return response.json();
    };
    const mobileCard = async (viewport, id) => {
      if (viewport.width > 900) return;
      const card = row(id), container = adminPage.locator('[data-admin-list]');
      await card.scrollIntoViewIfNeeded();
      const scroll = await container.evaluate(element => ({ left: element.scrollLeft, width: element.clientWidth, scrollWidth: element.scrollWidth }));
      assert.equal(scroll.left, 0, 'Mobile user cards should not require horizontal scrolling');
      assert.ok(scroll.scrollWidth <= scroll.width + 1, 'Mobile card list must fit its own width');
      // Check all three together after one vertical scroll. Checking each with a click
      // would auto-scroll the table and could hide the name while exposing its actions.
      const controls = [card.locator('[data-admin-user-name]'), card.locator('[data-admin-edit]'), card.locator('[data-admin-reset-password]')];
      for (const control of controls) {
        const visible = await control.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
          return bounds.width > 0 && bounds.height > 0 && bounds.left >= -1 && bounds.right <= innerWidth + 1 &&
            bounds.top >= -1 && bounds.bottom <= innerHeight + 1 && !!target && (target === element || element.contains(target));
        });
        assert.ok(visible, 'Mobile user name, edit and password-reset controls must be visible together without horizontal scrolling or overlays');
      }
      results.push({ check: `mobile card name and actions together ${viewport.width}x${viewport.height}`, passed: true, scroll });
    };
    const openEdit = async id => { await row(id).locator('[data-admin-edit]').click(); await adminPage.locator('#admin-edit-username').waitFor(); };
    const openRoleMenu = async label => {
      const dialog = adminPage.getByRole('dialog').last();
      assert.equal(await dialog.locator('select').count(), 0, 'The edit dialog must not contain a native role select');
      const select = dialog.locator('.el-select');
      assert.equal(await select.count(), 1, 'Role selection must use the ElementPlus select component');
      const combobox = select.getByRole('combobox');
      assert.equal(await combobox.count(), 1, 'The styled role selector must expose an accessible combobox');
      // ElementPlus places its readonly combobox input behind the visible wrapper.
      // Click the visual control and use the actual combobox for keyboard interaction.
      if (await combobox.getAttribute('aria-expanded') !== 'true') await select.locator('.el-select__wrapper').click();
      const menu = adminPage.locator('.admin-role-dropdown:visible').last();
      await menu.waitFor(); await menu.getByRole('option', { name: '管理员', exact: true }).click({ trial: true });
      assert.equal(await combobox.getAttribute('aria-expanded'), 'true');
      const geometry = await menu.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const options = [...element.querySelectorAll('[role=option]')].map(option => {
          const box = option.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
            uncovered: !!hit && (hit === option || option.contains(hit)) };
        });
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, options, width: innerWidth, height: innerHeight };
      });
      assert.ok(geometry.left >= -1 && geometry.right <= geometry.width + 1 && geometry.top >= -1 && geometry.bottom <= geometry.height + 1,
        'The expanded role dropdown must remain fully inside the viewport');
      assert.equal(geometry.options.length, 2, 'Both role choices must be rendered');
      assert.ok(geometry.options.every(option => option.left >= -1 && option.right <= geometry.width + 1 && option.top >= -1 &&
        option.bottom <= geometry.height + 1 && option.uncovered), 'Role options must not be clipped or covered by the dialog');
      results.push({ check: label, passed: true, geometry });
      return { select, combobox, menu };
    };
    const chooseRole = async (role, keyboard = false) => {
      const label = role === 'admin' ? '管理员' : '普通用户';
      const { select, combobox, menu } = await openRoleMenu(`role dropdown ${keyboard ? 'keyboard' : 'pointer'} selection`);
      if (keyboard) {
        await combobox.focus(); await combobox.press(role === 'admin' ? 'End' : 'Home'); await combobox.press('Enter');
      } else await menu.getByRole('option', { name: label, exact: true }).click();
      await menu.waitFor({ state: 'hidden' });
      assert.equal((await select.locator('.el-select__placeholder').innerText()).trim(), label, 'The chosen role must be shown in the styled control');
    };
    const saveEdit = async (id, expected = 200) => {
      const responsePromise = adminPage.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/api/admin/users/${id}`));
      await adminPage.locator('[data-admin-save]').click();
      const response = await responsePromise; assert.equal(response.status(), expected); return response.json();
    };
    const closeDialog = async () => {
      const cancel = adminPage.getByRole('dialog').last().getByRole('button', { name: '取消', exact: true });
      await cancel.click(); await adminPage.getByRole('dialog').last().waitFor({ state: 'hidden' });
    };
    await search(alice.username, alice.id); await openEdit(alice.id);
    await adminPage.locator('#admin-edit-username').fill('cara'); await saveEdit(alice.id, 409);
    await adminPage.locator('#admin-edit-username').waitFor();
    assert.equal((await request(adminToken, 'GET', '/admin/users?keyword=' + encodeURIComponent(alice.username))).data.users[0].username, alice.username);
    await adminPage.locator('#admin-edit-username').fill(alice.username); await adminPage.locator('#admin-edit-email').fill('cara@example.test');
    await saveEdit(alice.id, 409); await adminPage.locator('#admin-edit-email').waitFor();
    const aliceName = 'admin-browser-alice-renamed';
    await adminPage.locator('#admin-edit-username').fill(aliceName);
    await adminPage.locator('#admin-edit-email').fill('admin-browser-alice-renamed@example.test');
    await chooseRole('admin');
    const edited = await saveEdit(alice.id);
    assert.equal(edited.data.username, aliceName); assert.equal(edited.data.role, 'admin'); assert.equal(edited.requiresLogin, true);
    await adminPage.locator('#admin-edit-username').waitFor({ state: 'hidden' });
    await request(aliceSession.token, 'GET', '/users/me', undefined, 401);
    await request(null, 'POST', '/users/login', { username: alice.username, password }, 401);
    const promotedSession = await request(null, 'POST', '/users/login', { username: aliceName, password });
    assert.equal(promotedSession.user.role, 'admin');
    assert.equal((await request(adminToken, 'GET', '/admin/users?keyword=' + encodeURIComponent(bob.username))).data.adminCount, 2);
    passed('重名和重复邮箱返回冲突且保留原数据；编辑用户名邮箱角色生效并撤销旧会话');

    await search(bob.username, bob.id); await row(bob.id).locator('[data-admin-reset-password]').click();
    await adminPage.locator('#admin-reset-password').fill(resetPassword); await adminPage.locator('#admin-reset-confirm').fill(resetPassword);
    const resetResponse = adminPage.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/api/admin/users/${bob.id}/password`));
    await adminPage.locator('[data-admin-password-save]').click();
    const resetResult = await resetResponse; assert.ok(resetResult.ok());
    const resetBody = await resetResult.json(); assert.equal(resetBody.data.userId, bob.id); assert.equal(resetBody.data.requiresLogin, true);
    await adminPage.locator('#admin-reset-password').waitFor({ state: 'hidden' });
    await request(ordinaryToken, 'GET', '/users/me', undefined, 401); await request(bobOtherSession.token, 'GET', '/users/me', undefined, 401);
    await request(null, 'POST', '/users/login', { username: bob.username, password }, 401);
    await ordinaryPage.reload(); await ordinaryPage.waitForURL(target => target.pathname === '/');
    assert.ok(!await ordinaryPage.evaluate(() => localStorage.getItem('token')), 'Expired browser session should clear cached credentials');
    await loginInBrowser(ordinaryPage, bob.username, resetPassword);
    assert.equal(await ordinaryPage.getByRole('link', { name: '用户管理', exact: true }).count(), 0);
    passed('重置密码撤销该用户所有旧会话，旧密码失败，新密码可真实浏览器登录');

    await search(aliceName, alice.id); await openEdit(alice.id); await chooseRole('user', true);
    await saveEdit(alice.id); await adminPage.locator('#admin-edit-username').waitFor({ state: 'hidden' });
    await request(promotedSession.token, 'GET', '/users/me', undefined, 401);
    const onlyAdmin = (await request(adminToken, 'GET', '/admin/users?keyword=cara')).data;
    assert.equal(onlyAdmin.adminCount, 1); const cara = onlyAdmin.users.find(user => user.username === 'cara'); assert.ok(cara);
    await request(adminToken, 'PATCH', `/admin/users/${cara.id}`, { username: 'cara', email: 'cara@example.test', role: 'user' }, 409);
    await search('cara', cara.id); await openEdit(cara.id);
    await dialogAlignment(adminPage, 'last administrator horizontal edit form');
    const lastAdminRole = await openRoleMenu('last administrator disabled ordinary role');
    const ordinaryOption = lastAdminRole.menu.getByRole('option', { name: '普通用户', exact: true });
    assert.ok(await ordinaryOption.getAttribute('aria-disabled') === 'true' || await ordinaryOption.evaluate(element => element.classList.contains('is-disabled')),
      'The last administrator ordinary-role option must be disabled');
    await screenshot(adminPage, 'admin-user-role-menu-desktop');
    const dialogBounds = await adminPage.getByRole('dialog').last().locator('.el-dialog').boundingBox(), menuBounds = await lastAdminRole.menu.boundingBox();
    const detailLeft = Math.max(0, Math.min(dialogBounds.x, menuBounds.x) - 8), detailTop = Math.max(0, Math.min(dialogBounds.y, menuBounds.y) - 8);
    await adminPage.screenshot({ path: path.join(artifacts, 'admin-user-role-menu-detail.png'), clip: { x: detailLeft, y: detailTop,
      width: Math.min(adminPage.viewportSize().width, Math.max(dialogBounds.x + dialogBounds.width, menuBounds.x + menuBounds.width) + 8) - detailLeft,
      height: Math.min(adminPage.viewportSize().height, Math.max(dialogBounds.y + dialogBounds.height, menuBounds.y + menuBounds.height) + 8) - detailTop } });
    const disabledBounds = await ordinaryOption.boundingBox();
    await adminPage.mouse.click(disabledBounds.x + disabledBounds.width / 2, disabledBounds.y + disabledBounds.height / 2);
    assert.equal((await lastAdminRole.select.locator('.el-select__placeholder').innerText()).trim(), '管理员', 'Clicking the disabled option must not demote the last administrator');
    await lastAdminRole.combobox.focus(); await lastAdminRole.combobox.press('Home'); await lastAdminRole.combobox.press('Enter');
    assert.equal((await lastAdminRole.select.locator('.el-select__placeholder').innerText()).trim(), '管理员', 'Keyboard navigation must skip the disabled ordinary-role option');
    await lastAdminRole.menu.waitFor({ state: 'hidden' });
    await closeDialog();
    assert.equal((await request(adminToken, 'GET', '/users/me')).user.role, 'admin');
    passed('角色降级撤销旧会话，最后一位管理员不能降级且仍保有管理权限');

    const visualViewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
      { width: 844, height: 390 }, { width: 1366, height: 768 }];
    for (const viewport of visualViewports) {
      await adminPage.setViewportSize(viewport); await search(longName, longUser.id);
      await layout(adminPage, `user list ${viewport.width}x${viewport.height}`);
      await toolbarAlignment(adminPage, `toolbar alignment ${viewport.width}x${viewport.height}`);
      await mobileCard(viewport, longUser.id);
      await iconButtons(adminPage, `compact action icons ${viewport.width}x${viewport.height}`);
      await reachable(row(longUser.id).locator('[data-admin-edit]'), 'Edit account');
      await reachable(row(longUser.id).locator('[data-admin-reset-password]'), 'Reset account password');
      await screenshot(adminPage, `admin-users-${viewport.width}x${viewport.height}`);
      await openEdit(longUser.id); await layout(adminPage, `edit dialog ${viewport.width}x${viewport.height}`);
      await adminPage.locator('#admin-edit-email').fill(`admin-mobile-${viewport.width}@example.test`);
      await dialogAlignment(adminPage, `edit dialog alignment ${viewport.width}x${viewport.height}`);
      await reachable(adminPage.locator('[data-admin-save]'), 'Save account'); await screenshot(adminPage, `admin-users-edit-${viewport.width}x${viewport.height}`);
      const roleMenu = await openRoleMenu(`expanded role menu ${viewport.width}x${viewport.height}`);
      await screenshot(adminPage, `admin-users-role-open-${viewport.width}x${viewport.height}`);
      await roleMenu.combobox.press('Escape'); await roleMenu.menu.waitFor({ state: 'hidden' });
      await closeDialog(); await row(longUser.id).locator('[data-admin-reset-password]').click();
      await adminPage.locator('#admin-reset-password').fill(resetPassword); await adminPage.locator('#admin-reset-confirm').fill(resetPassword);
      await layout(adminPage, `password dialog ${viewport.width}x${viewport.height}`);
      await dialogAlignment(adminPage, `password dialog alignment ${viewport.width}x${viewport.height}`);
      await reachable(adminPage.locator('[data-admin-password-save]'), 'Save reset password');
      await screenshot(adminPage, `admin-users-password-${viewport.width}x${viewport.height}`); await closeDialog();
    }
    passed('五种尺寸列表与两类弹窗无横向溢出，手机用户卡片的名称和操作同屏可达');

    for (const viewport of [visualViewports[0], visualViewports[4]]) {
      await adminPage.setViewportSize(viewport);
      const emptyResult = await search('no-matching-admin-browser-account');
      assert.equal(emptyResult.data.total, 0); assert.equal(emptyResult.data.adminCount, 1);
      await adminPage.locator('[data-admin-empty]').waitFor();
      assert.equal(await adminPage.locator('[data-admin-user]').count(), 0, 'Empty search must not retain old account rows');
      await layout(adminPage, `empty results ${viewport.width}x${viewport.height}`);
      await screenshot(adminPage, `admin-users-empty-${viewport.width}x${viewport.height}`);

      const failureKeyword = `admin-browser-simulated-failure-${viewport.width}`;
      let confirmIntercept, releaseResponse, handled = false;
      const intercepted = new Promise(resolve => { confirmIntercept = resolve; });
      const routePattern = '**/api/admin/users?**';
      const failOnce = async route => {
        const target = new URL(route.request().url());
        if (route.request().method() !== 'GET' || target.searchParams.get('keyword') !== failureKeyword || handled) return route.continue();
        handled = true;
        const released = new Promise(resolve => { releaseResponse = resolve; });
        confirmIntercept();
        await released;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '列表暂时不可用，请重试' }) });
      };
      await adminPage.route(routePattern, failOnce);
      try {
        await adminPage.locator('[data-admin-search]').fill(failureKeyword); await adminPage.locator('[data-admin-search]').press('Enter');
        await Promise.race([intercepted, pause(10000).then(() => { throw new Error('The simulated list failure was not intercepted'); })]);
        const loading = adminPage.locator('[data-admin-loading]');
        if (await loading.count()) await loading.waitFor();
        else await adminPage.getByText('正在读取用户列表…', { exact: true }).waitFor();
        await layout(adminPage, `loading state ${viewport.width}x${viewport.height}`);
        await screenshot(adminPage, `admin-users-loading-${viewport.width}x${viewport.height}`);
        releaseResponse();
        await adminPage.locator('[data-admin-list-error]').waitFor();
        assert.equal(await adminPage.locator('[data-admin-user]').count(), 0, 'Failed requests must not leave stale account rows visible');
        await layout(adminPage, `error state ${viewport.width}x${viewport.height}`);
        await reachable(adminPage.locator('[data-admin-retry]'), 'Retry failed user list');
        await screenshot(adminPage, `admin-users-error-${viewport.width}x${viewport.height}`);
      } finally {
        releaseResponse?.();
        await adminPage.unroute(routePattern, failOnce);
      }
      const retryResponse = adminPage.waitForResponse(response => response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/api/admin/users'));
      await adminPage.locator('[data-admin-retry]').click(); assert.ok((await retryResponse).ok());
      await adminPage.locator('[data-admin-empty]').waitFor();
      await search(longName, longUser.id);
    }
    passed('空结果、加载中和失败状态布局正确，不保留旧账号行，重试可恢复正常查询');

    const theme = (await request(adminToken, 'GET', '/theme')).data;
    await request(adminToken, 'PUT', '/theme', { ...theme, mode: 'dark' });
    await adminPage.reload(); await adminPage.locator('[data-admin-user]').first().waitFor();
    await adminPage.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    for (const viewport of visualViewports) {
      await adminPage.setViewportSize(viewport); await search(longName, longUser.id);
      await layout(adminPage, `dark user list ${viewport.width}x${viewport.height}`);
      await toolbarAlignment(adminPage, `dark toolbar alignment ${viewport.width}x${viewport.height}`);
      await mobileCard(viewport, longUser.id);
      await screenshot(adminPage, `admin-users-dark-${viewport.width}x${viewport.height}`);
      if (viewport.width === 390) {
        await openEdit(longUser.id); await adminPage.locator('#admin-edit-email').fill('admin-dark-menu@example.test');
        await dialogAlignment(adminPage, 'dark horizontal edit form');
        const roleMenu = await openRoleMenu('dark expanded role menu 390x844');
        await screenshot(adminPage, 'admin-users-role-open-dark-390x844');
        await roleMenu.combobox.press('Escape'); await roleMenu.menu.waitFor({ state: 'hidden' }); await closeDialog();
      }
    }
    await request(adminToken, 'PUT', '/theme', { ...theme, mode: 'light' });
    await adminPage.reload(); await adminPage.locator('[data-admin-user]').first().waitFor();
    await adminPage.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    passed('暗色主题在五种尺寸保持列表可读、卡片操作同屏可达且无横向溢出');

    await adminPage.setViewportSize({ width: 1366, height: 768 }); await search('cara', cara.id); await openEdit(cara.id);
    await adminPage.locator('#admin-edit-username').fill('cara-renamed-admin'); await adminPage.locator('#admin-edit-email').fill('cara-renamed-admin@example.test');
    const selfChange = await saveEdit(cara.id); assert.equal(selfChange.requiresLogin, true);
    await adminPage.waitForURL(target => target.pathname === '/');
    assert.ok(!await adminPage.evaluate(() => localStorage.getItem('token')), 'Editing the current administrator should require login again');
    await request(adminToken, 'GET', '/users/me', undefined, 401);
    await loginInBrowser(adminPage, 'cara-renamed-admin', password);
    if (new URL(adminPage.url()).pathname !== '/home') await adminPage.goto(url + '/home');
    await adminPage.getByRole('link', { name: '用户管理', exact: true }).waitFor();
    passed('管理员修改自身资料后退出旧会话，使用新用户名登录仍保留管理入口');
    console.log(`Admin user browser smoke: ${results.length} checks passed. Artifacts: ${artifacts}`);
  } catch (error) {
    results.push({ check: 'browser scenario', passed: false, message: error.message });
    if (viteOutput) record('Vite: ' + viteOutput);
    if (browser) {
      let index = 0;
      for (const context of browser.contexts()) for (const page of context.pages()) {
        try { await screenshot(page, `failure-${++index}`); } catch { /* Cleanup must continue even when pages are closed. */ }
      }
    }
    if (diagnostics.length) console.error('Browser diagnostics:\n' + diagnostics.join('\n'));
    throw error;
  } finally {
    const clean = async action => { try { await action(); } catch (error) { cleanupErrors.push(error.message); } };
    await clean(async () => fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify({ results, diagnostics }, null, 2)));
    await clean(async () => { if (browser) await browser.close(); }); await clean(() => stopChild(vite));
    await clean(async () => {
      if (server?.io) await new Promise(resolve => server.io.close(resolve));
      for (const socket of sockets) socket.destroy();
      if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });
    await clean(async () => { if (sequelize) await sequelize.close(); });
    await clean(async () => {
      if (created && connection) { assert.match(database, /^ownproject_test_[a-f0-9]{16}$/); await connection.query(`DROP DATABASE IF EXISTS \`${database}\``); }
    });
    await clean(async () => { if (connection) await connection.end(); });
    await clean(async () => fs.rmSync(uploads, { recursive: true, force: true }));
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    if (cleanupErrors.length) { console.error('Admin browser cleanup failed: ' + cleanupErrors.join('; ')); process.exitCode = 1; }
    console.log('Admin browser report: ' + path.join(artifacts, 'report.json'));
  }
}
main().catch(error => { console.error(`Admin user browser smoke failed: ${error.message}`); process.exitCode = 1; });
