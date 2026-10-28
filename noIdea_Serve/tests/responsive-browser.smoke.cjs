// Real-browser responsive regression. It uses .env only for the MySQL admin connection;
// the schema and uploaded files are always isolated and removed in finally.
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
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sizes = (process.env.RESPONSIVE_VIEWPORTS || '320x568,390x844,768x1024,1024x768,1366x768,1920x1080,844x390')
  .split(',').map(size => { const [width, height] = size.split('x').map(Number); return { width, height }; });
const selectedPages = new Set((process.env.RESPONSIVE_PAGES || 'login,register,home,chat,signPad,flowchart,test').split(','));
async function until(check, message, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(100); }
  throw new Error(message);
}
async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

async function main() {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'responsive-uploads-'));
  const artifactDirectory = process.env.RESPONSIVE_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'responsive-artifacts-'));
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const previous = Object.fromEntries(['DB_NAME', 'THEME_UPLOAD_DIR', 'PORT'].map(name => [name, process.env[name]]));
  Object.assign(process.env, { DB_NAME: database, THEME_UPLOAD_DIR: uploads, PORT: '0' });
  let admin, created = false, sequelize, server, vite, browser;
  const connections = new Set();
  const results = [], diagnostics = [], cleanupErrors = [];
  let currentCase = '';
  const record = text => diagnostics.push(String(text).replace(/[a-f0-9]{64}/gi, '[redacted]').slice(0, 1000));
  const screenshot = async (page, name) => {
    // Success notices are transient overlays, so review the settled page underneath.
    await page.waitForFunction(() => [...document.querySelectorAll('.el-message')].every(element => {
      const style = getComputedStyle(element);
      return style.display === 'none' || style.visibility === 'hidden' || element.getBoundingClientRect().height === 0;
    }), undefined, { timeout: 7000 });
    const destination = path.join(artifactDirectory, `${name.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`);
    await page.screenshot({ path: destination, fullPage: true, timeout: 10000 });
    return destination;
  };
  const captureLayout = async (page, label) => {
    const metrics = await page.evaluate(() => {
      const width = window.innerWidth;
      const name = element => element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '') +
        [...element.classList].slice(0, 3).map(value => `.${value}`).join('');
      const internallyScrolling = element => {
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
          if (/(auto|scroll)/.test(style.overflowX) && bounds.left >= -1 && bounds.right <= width + 1) return true;
        }
        return false;
      };
      const overflow = [...document.querySelectorAll('body *')].filter(element => {
        if (element instanceof SVGElement) return false;
        const bounds = element.getBoundingClientRect(), style = getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0' &&
          (bounds.left < -1 || bounds.right > width + 1) && !internallyScrolling(element);
      }).map(element => {
        const bounds = element.getBoundingClientRect();
        return { element: name(element), left: Math.round(bounds.left), right: Math.round(bounds.right), width: Math.round(bounds.width) };
      }).slice(0, 12);
      const oversizedButtons = [...document.querySelectorAll('.el-button:not(.is-link), .chat-page .button, .sidebar-action')]
        .filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 32.5 && !element.closest('.autoBtn');
        }).map(element => ({ label: element.getAttribute('aria-label') || element.textContent.trim(),
          height: element.getBoundingClientRect().height }));
      return { viewport: { width, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight, scrollX: window.scrollX, overflow, oversizedButtons };
    });
    const boundedDesktop = metrics.viewport.width >= 1024 && metrics.viewport.height >= 600 && /^(home|chat|flowchart)-/.test(currentCase);
    const passed = metrics.documentWidth <= metrics.viewport.width + 1 && metrics.bodyWidth <= metrics.viewport.width + 1 &&
      metrics.scrollX === 0 && metrics.overflow.length === 0 && metrics.oversizedButtons.length === 0 &&
      (!boundedDesktop || metrics.documentHeight <= metrics.viewport.height + 2);
    results.push({ case: currentCase, check: label, passed, ...metrics });
    if (!passed) console.log(`LAYOUT ${currentCase}/${label}: ${JSON.stringify(metrics)}`);
    return passed;
  };
  const reachable = async (locator, label, visibleHeight) => {
    await locator.waitFor({ state: 'visible' });
    await locator.click({ trial: true, timeout: 5000 });
    const bounds = await locator.boundingBox();
    const viewport = locator.page().viewportSize();
    assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y >= -1 &&
      bounds.y + bounds.height <= (visibleHeight || viewport.height) + 1, `${label} must be reachable inside the viewport`);
    results.push({ case: currentCase, check: label, passed: true });
  };
  const prefer = async (page, selector, fallback) => await page.locator(selector).count() ? page.locator(selector).first() : fallback;
  const dialog = page => page.locator('.el-dialog:visible').last();
  const runCase = async (page, name, size, work) => {
    currentCase = `${name}-${size.width}x${size.height}`;
    await page.setViewportSize(size);
    try {
      await work();
      const failed = results.some(item => item.case === currentCase && !item.passed);
      await screenshot(page, currentCase + (failed ? '-failure' : ''));
      console.log(`${failed ? 'FAIL' : 'PASS'}: ${currentCase}`);
    } catch (error) {
      results.push({ case: currentCase, check: 'interaction', passed: false, message: error.message });
      console.log(`FAIL: ${currentCase}: ${error.message.split('\n')[0]}`);
      try { await captureLayout(page, 'failure-state'); await screenshot(page, currentCase + '-failure'); } catch { /* Keep auditing other pages. */ }
    }
  };
  try {
    admin = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
    assert.match(database, /^ownproject_test_[a-f0-9]{16}$/);
    await admin.query(`CREATE DATABASE \`${database}\``); created = true;
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    ({ sequelize } = require('../models'));
    await admin.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())',
      ['cara', 'cara@example.test', await require('bcryptjs').hash('responsive-browser-password', 10)]);
    for (const migration of ['user-data', 'themes', 'flowcharts', 'chat']) await require(`../migrations/${migration}`)();
    server = await require('../app').start();
    server.on('connection', socket => { connections.add(socket); socket.once('close', () => connections.delete(socket)); });
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const api = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (token, method, route, body) => {
      const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.ok(response.ok, `${method} ${route} failed (${response.status})`);
      return response.json();
    };
    const username = 'responsive-' + 'LongUsername'.repeat(8);
    const peerName = 'peer-' + 'VeryLongPartnerName'.repeat(8);
    for (const [index, name] of [username, peerName].entries()) await request(null, 'POST', '/users/register',
      { username: name, password: 'responsive-browser-password', email: `responsive-${index}@example.test` });
    const login = await request(null, 'POST', '/users/login', { username, password: 'responsive-browser-password' });
    const peerLogin = await request(null, 'POST', '/users/login', { username: peerName, password: 'responsive-browser-password' });
    const conversation = (await request(login.token, 'POST', '/chat/conversations', { userId: peerLogin.user.id })).data;
    await request(peerLogin.token, 'POST', `/chat/conversations/${conversation.id}/messages`,
      { clientMessageId: crypto.randomUUID(), content: 'LongUnbrokenMessage_'.repeat(80) + '\n多行内容测试。'.repeat(10) });
    const longCategory = (await request(login.token, 'POST', '/menu/addMenus', { title: '很长的分类名称用于验证内容换行和导航可达性'.repeat(4) })).data;
    await request(login.token, 'POST', `/menu/addSubmenus/${longCategory.id}`, { order: 1,
      title: 'VeryLongBookmarkTitleWithoutAnySpaces'.repeat(5), targetUrl: 'https://example.test/' + 'long-path'.repeat(20),
      desc: '响应式书签描述'.repeat(15), icon: '' });
    const frontend = process.env.RESPONSIVE_FRONTEND_ROOT || path.resolve(__dirname, '../../noIdea_Front');
    const port = Number(process.env.RESPONSIVE_FRONTEND_PORT || await freePort());
    const url = `http://127.0.0.1:${port}`;
    vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { cwd: frontend, env: { ...process.env, VITE_API_BASE_URL: api, VITE_CACHE_DIR: path.join(uploads, 'vite-cache') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let viteOutput = '', spawnError;
    vite.stdout.on('data', chunk => { viteOutput = (viteOutput + chunk).slice(-6000); });
    vite.stderr.on('data', chunk => { viteOutput = (viteOutput + chunk).slice(-6000); });
    vite.once('error', error => { spawnError = error; });
    await until(async () => {
      if (spawnError || vite.exitCode !== null) throw new Error('Vite failed to start: ' + (spawnError?.message || viteOutput));
      try { return (await fetch(url)).ok; } catch { return false; }
    }, 'Vite did not become ready', 20000);
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const publicContext = await browser.newContext();
    const context = await browser.newContext();
    await context.addInitScript(session => {
      localStorage.setItem('token', session.token); localStorage.setItem('user', JSON.stringify(session.user));
    }, login);
    const publicPage = await publicContext.newPage(), page = await context.newPage();
    for (const observed of [publicPage, page]) {
      observed.setDefaultTimeout(5000);
      observed.on('pageerror', error => record(`${currentCase}: ${error.message}`));
      observed.on('console', message => { if (message.type() === 'error') record(`${currentCase}: ${message.text()}`); });
    }
    // Warm dependency optimization before measuring layouts or interacting with forms.
    await publicPage.goto(url); await publicPage.getByRole('button', { name: '登录', exact: true }).waitFor();
    await delay(800);
    for (const size of sizes) {
      if (selectedPages.has('login')) await runCase(publicPage, 'login', size, async () => {
        await publicPage.goto(url); await publicPage.locator('input[type=password]').waitFor();
        await captureLayout(publicPage, 'page');
        await reachable(publicPage.locator('input').first(), 'username input');
        await reachable(publicPage.locator('input[type=password]'), 'password input');
        await reachable(publicPage.getByRole('button', { name: '登录', exact: true }), 'login action');
      });
      if (selectedPages.has('register')) await runCase(publicPage, 'register', size, async () => {
        await publicPage.goto(url + '/register'); await publicPage.getByRole('button', { name: '注册', exact: true }).waitFor();
        await captureLayout(publicPage, 'page');
        await reachable(publicPage.locator('input').last(), 'email input');
        await reachable(publicPage.getByRole('button', { name: '注册', exact: true }), 'register action');
      });
      if (selectedPages.has('home')) await runCase(page, 'home', size, async () => {
        await page.goto(url + '/home'); await page.locator('[data-section]').first().waitFor();
        await captureLayout(page, 'page');
        const contentHeight = await page.locator('main.el-main').evaluate(element => element.clientHeight);
        assert.ok(contentHeight >= Math.min(150, size.height * 0.25), 'Home content must retain usable vertical space');
        const longCategoryButton = page.locator(`[data-category="${longCategory.id}"]`);
        await reachable(longCategoryButton, 'long category navigation'); await longCategoryButton.click();
        await until(async () => new URL(page.url()).searchParams.get('category') === String(longCategory.id), 'Category navigation should preserve the selected ID');
        await reachable(page.getByPlaceholder('请输入搜索内容'), 'home search');
        await reachable(page.getByRole('button', { name: '退出登录', exact: true }), 'logout action');
        const addCategory = await prefer(page, '[data-home-add-category]', page.locator('.btnGroup svg').first());
        await reachable(addCategory, 'add category action'); await addCategory.click();
        await dialog(page).waitFor(); await captureLayout(page, 'add-category-dialog');
        const title = `响应式新增分类-${size.width}x${size.height}`;
        await page.getByPlaceholder('请输入标签名称').fill(title);
        await reachable(dialog(page).getByRole('button', { name: '确认', exact: true }), 'save category action');
        await dialog(page).getByRole('button', { name: '确认', exact: true }).click();
        await dialog(page).waitFor({ state: 'hidden' });
        const menus = (await request(login.token, 'GET', '/menu/getMenus')).data;
        const ownMenu = menus.find(item => item.title === title); assert.ok(ownMenu, 'New category persists');
        const edit = await prefer(page, '[data-home-edit-mode]', page.locator('.btnGroup svg').nth(1)); await edit.click();
        const addBookmark = await prefer(page, `[data-home-add-bookmark="${ownMenu.id}"]`, page.locator(`[data-section="${ownMenu.id}"] .lastBox`));
        await reachable(addBookmark, 'add bookmark action'); await addBookmark.click();
        await dialog(page).waitFor(); await captureLayout(page, 'add-bookmark-dialog');
        await page.getByPlaceholder('请输入目标网址').fill('https://example.test/responsive');
        await page.getByPlaceholder('请输入书签名称').fill(`Responsive ${size.width}x${size.height}`);
        await reachable(dialog(page).getByRole('button', { name: '确认', exact: true }), 'save bookmark action');
        await dialog(page).getByRole('button', { name: '确认', exact: true }).click();
        await dialog(page).waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '主题设置', exact: true }).click();
        await dialog(page).waitFor(); await captureLayout(page, 'theme-dialog');
        await screenshot(page, currentCase + '-theme');
        await reachable(page.locator('#theme-file'), 'theme image input');
        await reachable(dialog(page).getByRole('button', { name: '保存设置', exact: true }), 'save theme action');
        await require('./theme-mode-control.cjs')(page, size.width === 390 || size.width === 768 ? 'dark' : 'light');
        const savedTheme = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith('/api/theme'));
        await dialog(page).getByRole('button', { name: '保存设置', exact: true }).click();
        assert.ok((await savedTheme).ok(), 'Theme settings can be saved at this viewport');
        await dialog(page).getByRole('button', { name: '关闭', exact: true }).click();
        await dialog(page).waitFor({ state: 'hidden' });
        await reachable(page.getByText('退出编辑模式', { exact: true }), 'exit editing action');
        await captureLayout(page, 'after-dialogs');
      });
      if (selectedPages.has('chat')) await runCase(page, 'chat', size, async () => {
        await page.goto(url + '/chat'); await page.locator(`[data-chat-conversation="${conversation.id}"]`).click();
        await page.locator('[data-chat-message]').first().waitFor();
        await captureLayout(page, 'long-username-and-message');
        const headerHeight = await page.locator('.conversation-header').evaluate(element => element.getBoundingClientRect().height);
        assert.ok(headerHeight <= 105, 'Long usernames must not expand the conversation header into the message area');
        const composer = page.locator('[data-chat-composer]');
        await composer.fill('手机输入区与很长文字测试'.repeat(10));
        await composer.press('Shift+Enter');
        assert.ok((await composer.inputValue()).includes('\n'), 'Shift+Enter inserts a new line');
        await reachable(composer, 'chat composer');
        await reachable(page.locator('[data-chat-send]'), 'chat send action');
        if (size.width <= 390) {
          await page.setViewportSize({ width: size.width, height: 320 });
          await captureLayout(page, 'keyboard-reduced-height');
          await reachable(composer, 'keyboard composer'); await reachable(page.locator('[data-chat-send]'), 'keyboard send action');
          await screenshot(page, currentCase + '-keyboard'); await page.setViewportSize(size);
        }
        if (size.width === 320) {
          const mocked = await page.evaluate(() => {
            const viewport = window.visualViewport;
            if (!viewport) return false;
            Object.defineProperty(viewport, 'height', { configurable: true, get: () => 250 });
            viewport.dispatchEvent(new Event('resize'));
            return true;
          });
          assert.ok(mocked, 'Chromium must expose visualViewport for the keyboard regression');
          try {
            await until(async () => await page.evaluate(() => document.documentElement.style.getPropertyValue('--app-height')) === '250px',
              'Visual viewport resize must update the app height');
            await reachable(composer, 'visual viewport keyboard composer', 250);
            await reachable(page.locator('[data-chat-send]'), 'visual viewport keyboard send action', 250);
            await screenshot(page, currentCase + '-visual-viewport-keyboard');
          } finally {
            await page.evaluate(() => { delete window.visualViewport.height; window.visualViewport.dispatchEvent(new Event('resize')); });
            await until(async () => await page.evaluate(() => document.documentElement.style.getPropertyValue('--app-height')) === `${size.height}px`,
              'App height should recover when the software keyboard closes');
          }
        }
        const sent = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/messages'));
        await page.locator('[data-chat-send]').click(); assert.ok((await sent).ok(), 'Message can be sent at this viewport');
        await captureLayout(page, 'after-send');
      });
      if (selectedPages.has('signPad')) await runCase(page, 'signPad', size, async () => {
        await page.goto(url + '/signPad'); const canvas = page.locator('canvas'); await canvas.waitFor();
        await captureLayout(page, 'page');
        await canvas.scrollIntoViewIfNeeded(); const bounds = await canvas.boundingBox();
        assert.ok(bounds.width >= 180 && bounds.height >= 100, 'Signature canvas should have usable drawing space');
        const x = Math.max(15, bounds.x + 25), y = Math.max(15, bounds.y + 35);
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + 65, y + 35, { steps: 12 }); await page.mouse.move(x + 110, y + 8, { steps: 12 }); await page.mouse.up();
        const ink = () => canvas.evaluate(element => {
          const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
          let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 0 && pixels[i] + pixels[i + 1] + pixels[i + 2] < 650) count++;
          return count;
        });
        assert.ok(await ink() > 20, 'Pointer movement must draw visible ink');
        await page.setViewportSize({ width: size.width + 19, height: size.height + 17 }); await delay(200);
        await page.setViewportSize(size); await delay(200);
        assert.ok(await ink() > 20, 'Resizing must preserve the signature');
        const backing = await canvas.evaluate(element => ({ width: element.width, client: element.clientWidth, dpr: devicePixelRatio }));
        assert.ok(Math.abs(backing.width - backing.client * backing.dpr) <= 3, 'Canvas backing resolution should match its displayed size');
        const save = await prefer(page, '[data-signature-save]', page.getByRole('button', { name: '保存签名', exact: true }));
        await reachable(save, 'save signature action'); await save.click();
        const preview = await prefer(page, '[data-signature-preview]', page.locator('.signPad img').first()); await preview.click();
        const previewDialog = await prefer(page, '[data-signature-preview-dialog]', page.locator('.modal-content'));
        await previewDialog.waitFor(); await captureLayout(page, 'signature-preview'); await screenshot(page, currentCase + '-preview');
        const close = page.locator('[data-signature-preview-close]');
        assert.ok(await close.count(), 'Signature preview must provide a visible close button');
        await reachable(close, 'close signature preview'); await close.click(); await previewDialog.waitFor({ state: 'hidden' });
        await preview.click(); await previewDialog.waitFor(); await page.keyboard.press('Escape'); await previewDialog.waitFor({ state: 'hidden' });
      });
      if (selectedPages.has('flowchart')) await runCase(page, 'flowchart', size, async () => {
        await page.goto(url + '/flowchart'); await page.locator('[data-node]').first().waitFor();
        await captureLayout(page, 'page');
        for (const name of ['+ 步骤', '导出 SVG', '备份 JSON', '导入 JSON', '保存流程图'])
          await reachable(page.getByRole('button', { name, exact: true }), `flow ${name}`);
        const canvas = page.locator('.canvas-scroll');
        const internal = await canvas.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, overflow: getComputedStyle(element).overflowX }));
        assert.ok(internal.width > 160 && /auto|scroll/.test(internal.overflow), 'Flow canvas scrolls within its own bounded area');
        if (internal.scroll > internal.width) {
          await canvas.evaluate(element => { element.scrollLeft = 500; });
          assert.ok(await canvas.evaluate(element => element.scrollLeft) > 0, 'Flow canvas supports internal horizontal scrolling');
          await captureLayout(page, 'canvas-scrolled'); await canvas.evaluate(element => { element.scrollLeft = 0; });
        }
        await page.getByRole('button', { name: '+ 步骤', exact: true }).click();
        const settings = page.locator('[data-flow-inspector-toggle]');
        if (await settings.isVisible() && await settings.getAttribute('aria-expanded') !== 'true') await settings.click();
        await reachable(page.locator('#flow-label'), 'flow node properties');
        await page.locator('#flow-label').fill(`响应式节点 ${size.width}`); await page.locator('#flow-label').blur();
        await captureLayout(page, 'properties'); await screenshot(page, currentCase + '-properties');
        const close = page.locator('[data-flow-inspector-close]'); if (await close.isVisible()) await close.click();
        await reachable(page.getByRole('button', { name: '保存流程图', exact: true }), 'save flow after properties');
        await page.getByRole('button', { name: '保存流程图', exact: true }).click();
        await page.getByText('流程图已保存', { exact: true }).waitFor();
        const toast = page.locator('.el-message').filter({ hasText: '流程图已保存' }).last();
        assert.equal(await toast.evaluate(element => getComputedStyle(element).position), 'fixed', 'Flow save toast must be a fixed overlay on direct route entry');
        await captureLayout(page, 'after-save-toast');
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'Flow save toast must not increase the page height');
        results.push({ case: currentCase, check: 'fixed save toast does not increase document height', passed: true });
      });
      if (selectedPages.has('test')) await runCase(page, 'test', size, async () => {
        await page.goto(url + '/test'); await page.getByRole('heading', { name: '颜色变量测试' }).waitFor();
        await captureLayout(page, 'page'); await reachable(page.locator('.preview-theme-select .el-select__wrapper'), 'theme preview mode');
        const returnButton = page.getByRole('button', { name: /返回收藏/ }); if (await returnButton.count()) await reachable(returnButton, 'theme preview return');
      });
    }
    const failures = results.filter(item => !item.passed);
    console.log(`Responsive audit: ${results.length} checks, ${failures.length} failures. Artifacts: ${artifactDirectory}`);
    if (failures.length && process.env.RESPONSIVE_BASELINE !== '1') throw new Error(`${failures.length} responsive checks failed; see report.json`);
  } catch (error) {
    record(error.message); throw error;
  } finally {
    const clean = async action => { try { await action(); } catch (error) { cleanupErrors.push(error.message); } };
    await clean(async () => fs.writeFileSync(path.join(artifactDirectory, 'report.json'), JSON.stringify({ results, diagnostics }, null, 2)));
    await clean(async () => { if (browser) await browser.close(); }); await clean(() => stopChild(vite));
    await clean(async () => {
      if (server?.io) await new Promise(resolve => server.io.close(resolve));
      for (const socket of connections) socket.destroy();
      if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });
    await clean(async () => { if (sequelize) await sequelize.close(); });
    await clean(async () => { if (created && admin) { assert.match(database, /^ownproject_test_[a-f0-9]{16}$/); await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); } });
    await clean(async () => { if (admin) await admin.end(); });
    await clean(async () => fs.rmSync(uploads, { recursive: true, force: true }));
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    if (cleanupErrors.length) { console.error('Responsive cleanup failed: ' + cleanupErrors.join('; ')); process.exitCode = 1; }
    console.log(`Responsive report: ${path.join(artifactDirectory, 'report.json')}`);
  }
}
main().catch(error => { console.error(`Responsive smoke failed: ${error.message}`); process.exitCode = 1; });
