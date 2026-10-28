// Optional real-browser smoke test. See THEME_SETUP.md for prerequisites.
require('../config/env');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const sharp = require('sharp');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const selectThemeMode = require('./theme-mode-control.cjs');
const { setThemeColor } = require('./theme-color-control.cjs');

async function main() {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-browser-'));
  process.env.DB_NAME = database;
  process.env.THEME_UPLOAD_DIR = uploads;
  process.env.PORT = '0';
  const admin = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
  let server, vite, browser, sequelize;
  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    const models = require('../models'); sequelize = models.sequelize;
    await admin.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())', ['cara', 'cara@example.test', await require('bcryptjs').hash('browser-password', 10)]);
    await require('../migrations/user-data')(); await require('../migrations/themes')(); await require('../migrations/flowcharts')(); await require('../migrations/chat')();
    if (process.env.THEME_SETTINGS_FOCUS === 'visual-map') await require('../migrations/visual-map')();
    if (process.env.THEME_SETTINGS_FOCUS === 'workspace-features') await require('../migrations/workspace-features')();
    server = await require('../app').start();
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const api = `http://127.0.0.1:${server.address().port}/api`;
    for (const username of ['browser-alice', 'browser-bob']) {
      const response = await fetch(api + '/users/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'browser-password', email: username + '@example.test' }) });
      assert.equal(response.status, 201);
    }
    const frontend = process.env.THEME_FRONTEND_ROOT || path.resolve(__dirname, '../../noIdea_Front');
    const frontendPort = Number(process.env.THEME_FRONTEND_PORT || 5187);
    const url = process.env.THEME_FRONTEND_URL || `http://127.0.0.1:${frontendPort}`;
    if (process.env.THEME_FRONTEND_URL) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
    if (!process.env.THEME_FRONTEND_URL) vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
      cwd: frontend, env: { ...process.env, VITE_API_BASE_URL: api, VITE_CACHE_DIR: path.join(uploads, 'vite-cache') }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = ''; vite?.stdout.on('data', chunk => output += chunk); vite?.stderr.on('data', chunk => output += chunk);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (vite && vite.exitCode !== null) throw new Error('Vite 启动失败：' + output);
      try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* Still starting. */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, output);
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    if (process.env.THEME_FRONTEND_URL) await page.route(target => target.pathname.startsWith('/api/') || target.pathname.startsWith('/socket.io/'), route => {
      const target = new URL(route.request().url());
      return route.continue({ url: target.pathname.startsWith('/api/') ? api + target.pathname.slice('/api'.length) + target.search : new URL(api).origin + target.pathname + target.search });
    });
    if (process.env.THEME_FRONTEND_URL) await page.routeWebSocket(/\/socket\.io\//, socket => {
      const target = new URL(socket.url()); target.host = new URL(api).host; target.protocol = 'ws:';
      socket.connectToServer(target.toString());
    });
    if (process.env.THEME_FRONTEND_URL) {
      page.on('pageerror', error => console.error('Frontend runtime:', error.message));
      page.on('console', message => { if (['error', 'warning'].includes(message.type()) && /ECharts|geo|renderer|component/i.test(message.text())) console.error('Frontend warning:', message.text()); });
      page.on('response', response => { if (response.status() >= 400) console.error('Frontend resource:', response.status(), new URL(response.url()).pathname); });
    }
    const assertWatermark = async username => {
      await page.waitForFunction(name => document.getElementById('global-watermark')?.dataset.username === name, username);
      const style = await page.locator('#global-watermark').evaluate(element => {
        const style = getComputedStyle(element);
        return { mask: style.maskImage, color: style.backgroundColor, opacity: Number(style.opacity), events: style.pointerEvents,
          width: element.clientWidth, height: element.clientHeight };
      });
      assert.ok(style.mask.startsWith('url("data:image/png;base64,'));
      assert.ok(style.opacity >= 0.1 && style.opacity <= 0.2);
      assert.equal(style.events, 'none');
      assert.equal(style.width, 1280); assert.equal(style.height, 900);
      return style;
    };
    const login = async username => {
      await page.goto(url);
      await page.locator('input').nth(0).fill(username);
      await page.locator('input[type=password]').fill('browser-password');
      await page.getByRole('button', { name: '登录', exact: true }).click();
      await page.waitForURL(target => target.pathname === '/home');
      await page.getByRole('button', { name: '主题设置', exact: true }).waitFor();
      await page.locator('[data-section]').first().waitFor();
      await assertWatermark(username);
    };
    await login('cara');
    if (['save-only', 'style-audit', 'flowchart-layout', 'visual-map', 'workspace-features'].includes(process.env.THEME_SETTINGS_FOCUS)) {
      try {
        const scenario = process.env.THEME_SETTINGS_FOCUS === 'workspace-features' ? './workspace-features-scenarios.cjs' : process.env.THEME_SETTINGS_FOCUS === 'visual-map' ? './visual-map-scenarios.cjs'
          : process.env.THEME_SETTINGS_FOCUS === 'flowchart-layout' ? './flowchart-layout-scenarios.cjs'
          : process.env.THEME_SETTINGS_FOCUS === 'style-audit' ? './ui-style-scenarios.cjs' : './theme-settings-scenarios.cjs';
        await require(process.env.THEME_SETTINGS_SCENARIO || scenario)({ page, api, artifacts: process.env.THEME_SETTINGS_ARTIFACT_DIR });
      } catch (error) {
        if (process.env.THEME_SETTINGS_ARTIFACT_DIR) {
          fs.mkdirSync(process.env.THEME_SETTINGS_ARTIFACT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.THEME_SETTINGS_ARTIFACT_DIR, 'failure.png'), fullPage: true });
        }
        throw error;
      }
      return;
    }
    const lightWatermark = await assertWatermark('cara');
    await page.evaluate(() => localStorage.setItem('user', '{broken-json'));
    await page.reload();
    await assertWatermark('cara');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('user')).username), 'cara');
    await page.locator('[data-section]').first().waitFor();
    // Continuous sections, click/scroll synchronization and real HTML drag-and-drop.
    const menuToken = await page.evaluate(() => localStorage.getItem('token'));
    const menuRequest = async (method, route, body) => {
      const response = await fetch(api + route, { method, headers: { Authorization: `Bearer ${menuToken}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.ok(response.ok, route);
      return (await response.json()).data;
    };
    const initialMenus = await menuRequest('GET', '/menu/getMenus');
    assert.equal(await page.locator('[data-section]').count(), initialMenus.length);
    const iconBookmark = initialMenus[0].menuLists[0];
    const iconImage = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#409eff' } }).png().toBuffer();
    const iconSource = 'data:image/png;base64,' + iconImage.toString('base64');
    const updateIcon = icon => menuRequest('PUT', `/menu/updateSubmenus/${iconBookmark.id}`, {
      title: iconBookmark.title, targetUrl: iconBookmark.targetUrl, desc: iconBookmark.desc || '', icon,
    });
    const iconCard = page.locator(`[data-section="${initialMenus[0].id}"] .draggable-item`).first();
    await updateIcon(iconSource);
    await page.reload();
    await iconCard.locator('.bookmark-icon img').waitFor();
    await page.waitForFunction(() => { const image = document.querySelector('[data-section] .draggable-item .bookmark-icon img'); return image?.complete && image.naturalWidth > 0; });
    assert.equal(await iconCard.locator('.bookmark-icon img').getAttribute('src'), iconSource);
    await updateIcon('/bookmark-icon-missing.png');
    await page.reload();
    await iconCard.locator('.bookmark-initial').waitFor();
    assert.equal(await iconCard.locator('.bookmark-initial').textContent(), Array.from(iconBookmark.title.trim())[0]);
    await updateIcon('');
    await page.reload();
    await iconCard.locator('.bookmark-initial').waitFor();
    assert.equal(await iconCard.locator('.bookmark-icon img').count(), 0);
    assert.equal(await iconCard.locator('.bookmark-initial').textContent(), Array.from(iconBookmark.title.trim())[0]);
    await updateIcon(iconBookmark.icon || '');
    console.log('PASS: 书签显示保存的图标，空图标及加载失败时显示名称首字');
    const lastCategory = String(initialMenus.at(-1).id);
    await page.locator(`[data-category="${lastCategory}"]`).click();
    await page.waitForFunction(id => document.querySelector(`.el-menu-item[data-category="${id}"]`)?.classList.contains('is-active'), lastCategory);
    await page.waitForTimeout(700);
    assert.equal(new URL(page.url()).searchParams.get('category'), lastCategory);
    const content = page.locator('main.el-main');
    await content.hover();
    await page.mouse.wheel(0, -10000);
    await page.waitForFunction(id => document.querySelector(`.el-menu-item[data-category="${id}"]`)?.classList.contains('is-active'), String(initialMenus[0].id));
    await page.mouse.wheel(0, 10000);
    await page.waitForFunction(id => document.querySelector(`.el-menu-item[data-category="${id}"]`)?.classList.contains('is-active'), lastCategory);
    await page.reload();
    await page.waitForFunction(id => document.querySelector(`.el-menu-item[data-category="${id}"]`)?.classList.contains('is-active'), lastCategory);
    const empty = await menuRequest('POST', '/menu/addMenus', { title: 'empty-drop-target' });
    await page.reload();
    await page.locator('[data-section]').first().waitFor();
    await page.locator('.btnGroup svg').nth(1).click();
    const firstId = initialMenus[0].id;
    await page.locator(`[data-category="${firstId}"]`).click();
    await page.waitForTimeout(700);
    const sourceCards = page.locator(`[data-section="${firstId}"] .draggable-item`);
    const sourceId = initialMenus[0].menuLists[0].id;
    await sourceCards.first().dragTo(page.locator(`[data-category="${empty.id}"]`));
    await page.getByText('书签已移动', { exact: true }).waitFor();
    let refreshed = await menuRequest('GET', '/menu/getMenus');
    assert.equal(refreshed.find(menu => menu.id === empty.id).menuLists[0].id, sourceId);
    assert.ok(!refreshed.find(menu => menu.id === firstId).menuLists.some(bookmark => bookmark.id === sourceId));
    await page.locator(`[data-category="${empty.id}"]`).click();
    await page.waitForTimeout(700);
    await page.locator(`[data-section="${empty.id}"] .draggable-item`).first().dragTo(page.locator(`[data-category="${firstId}"]`));
    await page.waitForTimeout(400);
    refreshed = await menuRequest('GET', '/menu/getMenus');
    assert.equal(refreshed.find(menu => menu.id === firstId).menuLists.at(-1).id, sourceId);
    await page.locator(`[data-category="${firstId}"]`).click();
    await page.waitForTimeout(700);
    const cards = page.locator(`[data-section="${firstId}"] .draggable-item`);
    await cards.last().dragTo(cards.first());
    await page.waitForTimeout(400);
    assert.equal((await menuRequest('GET', '/menu/getMenus')).find(menu => menu.id === firstId).menuLists[0].id, sourceId);
    await page.reload();
    assert.equal((await menuRequest('GET', '/menu/getMenus')).find(menu => menu.id === firstId).menuLists[0].id, sourceId);
    await menuRequest('DELETE', `/menu/deletMenu/${empty.id}`);
    await page.reload();
    await page.getByRole('button', { name: '主题设置', exact: true }).waitFor();
    console.log('PASS: 分类点击、滚轮高亮、刷新定位、跨分类拖拽到空分类、同分类排序及数据库持久化');
    const signMenu = initialMenus.find(menu => menu.menuLists.some(item => item.targetUrl === '/signPad'));
    if (signMenu) {
      await page.locator(`[data-category="${signMenu.id}"]`).click();
      await page.waitForTimeout(700);
      const signBookmark = signMenu.menuLists.find(item => item.targetUrl === '/signPad');
      await page.locator(`[data-section="${signMenu.id}"] .draggable-item`).filter({ hasText: signBookmark.title }).click();
      await page.waitForURL(target => target.pathname === '/signPad');
      assert.equal(new URL(page.url()).searchParams.get('fromCategory'), String(signMenu.id));
      await page.locator('.signPad .el-button').first().click();
      await page.waitForURL(target => target.pathname === '/home' && target.searchParams.get('category') === String(signMenu.id));
      await page.waitForFunction(id => document.querySelector(`.el-menu-item[data-category="${id}"]`)?.classList.contains('is-active'), String(signMenu.id));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(`[data-category="${firstId}"]`).waitFor();
    await page.locator(`[data-category="${firstId}"]`).click();
    await page.waitForTimeout(700);
    await content.hover();
    await page.mouse.wheel(0, 10000);
    await page.waitForTimeout(500);
    await page.waitForFunction(id => document.querySelector(`.el-menu-item[data-category="${id}"]`)?.classList.contains('is-active'), lastCategory);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.setViewportSize({ width: 1280, height: 900 });
    console.log('PASS: 子页面返回保留分类、手机视口滚动定位且无横向溢出');
    const flowMenu = (await menuRequest('GET', '/menu/getMenus')).find(menu => menu.menuLists.some(item => item.targetUrl === '/flowchart'));
    assert.ok(flowMenu, 'Home 为当前用户安装流程图入口');
    await page.locator(`[data-category="${flowMenu.id}"]`).click();
    await page.waitForTimeout(700);
    await page.locator(`[data-section="${flowMenu.id}"] .draggable-item`).filter({ hasText: '流程图' }).click();
    await page.waitForURL(target => target.pathname === '/flowchart');
    await page.locator('[data-node]').first().waitFor();
    assert.equal(await page.locator('[data-node]').count(), 4);
    assert.equal(await page.getByRole('button', { name: '主题设置', exact: true }).count(), 0);
    await page.getByRole('button', { name: '+ 步骤', exact: true }).click();
    const added = page.locator('[data-node]').last();
    const addedId = await added.getAttribute('data-node');
    await page.locator('#flow-label').fill('浏览器流程步骤');
    await page.locator('#flow-label').blur();
    const nodeBounds = await added.boundingBox();
    await page.mouse.move(nodeBounds.x + nodeBounds.width / 2, nodeBounds.y + nodeBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(nodeBounds.x + nodeBounds.width / 2 + 60, nodeBounds.y + nodeBounds.height / 2 + 45, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('button', { name: '连线', exact: true }).click();
    await page.locator('[data-node="start"]').click();
    await added.click();
    assert.equal(await page.locator('[data-edge]').count(), 4);
    await page.locator('[data-edge]').last().focus();
    await page.locator('[data-edge]').last().press('Enter');
    await page.locator('#flow-label').fill('新的分支');
    await page.locator('#flow-label').blur();
    await page.getByRole('button', { name: '删除连线', exact: true }).click();
    assert.equal(await page.locator('[data-edge]').count(), 3);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    assert.equal(await page.locator('[data-edge]').count(), 4);
    await page.getByRole('button', { name: '重做', exact: true }).click();
    assert.equal(await page.locator('[data-edge]').count(), 3);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await page.getByRole('button', { name: '保存流程图', exact: true }).click();
    await page.getByText('流程图已保存', { exact: true }).waitFor();
    const persisted = await menuRequest('GET', '/flowchart');
    assert.equal(persisted.document.nodes.length, 5);
    assert.equal(persisted.document.nodes.find(node => node.id === addedId).label, '浏览器流程步骤');
    assert.notEqual(persisted.document.nodes.find(node => node.id === addedId).x, 650);
    assert.equal(persisted.document.edges.length, 4);
    assert.equal(persisted.document.edges.at(-1).label, '新的分支');
    if (process.env.FLOWCHART_SCREENSHOT) await page.screenshot({ path: process.env.FLOWCHART_SCREENSHOT, fullPage: true });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 SVG', exact: true }).click();
    const svgDownload = await downloadPromise;
    assert.ok(svgDownload.suggestedFilename().endsWith('.svg'));
    const exportedSvg = fs.readFileSync(await svgDownload.path(), 'utf8');
    assert.ok(exportedSvg.includes('浏览器流程步骤'));
    assert.ok(exportedSvg.includes('marker-end="url(#flow-arrow)"'));
    const backupPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '备份 JSON', exact: true }).click();
    const backup = await backupPromise;
    const backupBytes = fs.readFileSync(await backup.path());
    await added.press('Enter');
    await page.getByRole('button', { name: '删除节点', exact: true }).click();
    assert.equal(await page.locator('[data-node]').count(), 4);
    assert.equal(await page.locator('[data-edge]').count(), 3);
    await page.locator('input[type=file]').setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: backupBytes });
    await page.getByRole('button', { name: '导入', exact: true }).click();
    assert.equal(await page.locator('[data-node]').count(), 5);
    assert.equal(await page.locator('[data-edge]').count(), 4);
    await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"nodes":[],"edges":[{}]}') });
    await page.getByText('连线数据不正确', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-node]').count(), 5);
    await page.reload();
    await page.locator('[data-node]').first().waitFor();
    assert.equal(await page.locator('[data-node]').count(), 5);
    await page.locator('[data-node="start"]').click();
    await page.locator('#flow-label').waitFor();
    await page.getByRole('button', { name: '+ 判断', exact: true }).click();
    await page.getByRole('button', { name: '返回收藏', exact: true }).click();
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/flowchart');
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '流程图手机视口无横向溢出');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: '返回收藏', exact: true }).click();
    await page.waitForURL(target => target.pathname === '/home' && target.searchParams.get('category') === String(flowMenu.id));
    await page.locator('[data-section]').first().waitFor();
    console.log('PASS: 流程图入口、节点拖动编辑、箭头连线、撤销重做、账户保存刷新、SVG 导出、未保存拦截及返回分类');
    await page.getByRole('button', { name: '主题设置', exact: true }).click();
    await selectThemeMode(page, 'dark');
    await setThemeColor(page, '#7c3aed');
    await page.locator('#theme-overlay').evaluate(element => { element.value = '0.65'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByText('主题已保存', { exact: true }).waitFor();
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const getTheme = async () => (await (await fetch(api + '/theme', { headers: { Authorization: `Bearer ${token}` } })).json()).data;
    assert.equal((await getTheme()).mode, 'dark');
    assert.equal((await getTheme()).primaryColor, '#7c3aed');
    assert.equal((await getTheme()).overlay, 0.65);
    const image = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#284d69' } }).png().toBuffer();
    await page.locator('#theme-file').setInputFiles({ name: 'background.png', mimeType: 'image/png', buffer: image });
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByRole('button', { name: '保存设置', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.documentElement.dataset.hasBackground === 'true');
    await selectThemeMode(page, 'light');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal((await getTheme()).mode, 'dark');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && document.documentElement.dataset.hasBackground === 'true');
    const darkWatermark = await assertWatermark('cara');
    assert.notEqual(darkWatermark.color, lightWatermark.color);
    assert.equal(darkWatermark.color, 'rgb(226, 232, 240)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()), '#7c3aed');
    const sidebarStyle = await page.locator('.el-aside').evaluate(element => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
    assert.equal(sidebarStyle.color, 'rgb(226, 232, 240)');
    assert.equal(sidebarStyle.background, 'rgba(24, 34, 51, 0.88)');
    assert.equal(await page.locator('.full-height').evaluate(element => Math.round(element.getBoundingClientRect().height)), 900);
    if (process.env.THEME_SCREENSHOT) await page.screenshot({ path: process.env.THEME_SCREENSHOT, fullPage: true });
    await page.goto(url + '/chat');
    await assertWatermark('cara');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && document.documentElement.dataset.hasBackground === 'true');
    assert.equal(await page.getByRole('button', { name: '主题设置', exact: true }).count(), 0);
    await page.goto(url + '/signPad');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.getByRole('button', { name: '主题设置', exact: true }).count(), 0);
    await page.goto(url + '/register');
    await page.getByRole('button', { name: '注册', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '主题设置', exact: true }).count(), 0);
    await page.goto(url + '/home');
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await page.getByRole('button', { name: '退出', exact: true }).click();
    await page.waitForURL(url + '/');
    assert.equal(await page.locator('#global-watermark').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.hasBackground), 'false');
    await login('browser-bob');
    const bobToken = await page.evaluate(() => localStorage.getItem('token'));
    const bobMenusResponse = await fetch(api + '/menu/getMenus', { headers: { Authorization: `Bearer ${bobToken}` } });
    const bobMenus = (await bobMenusResponse.json()).data;
    assert.ok(bobMenus.every(menu => !menu.can_edit && !menu.can_delete && menu.menuLists.every(item => !item.can_edit)));
    await page.locator('.btnGroup svg').nth(1).click();
    assert.equal(await page.locator('.el-aside .edit').count(), 0);
    assert.equal(await page.locator('.draggable-item[draggable=true]').count(), 0);
    await page.locator(`[data-category="${bobMenus[0].id}"]`).click();
    await page.waitForTimeout(700);
    await page.locator(`[data-section="${bobMenus[0].id}"] .lastBox`).click();
    await page.getByPlaceholder('请输入目标网址').fill('https://example.test/bob-personal');
    await page.getByPlaceholder('请输入书签名称').fill('Bob个人新增');
    await page.getByRole('button', { name: '确认', exact: true }).click();
    const personalCard = page.locator('.draggable-item').filter({ hasText: 'Bob个人新增' });
    await personalCard.waitFor();
    assert.equal(await personalCard.getAttribute('draggable'), 'true');
    await personalCard.hover();
    assert.ok(await personalCard.locator('.edit').isVisible());
    await personalCard.locator('.edit svg').first().click();
    await page.getByPlaceholder('请输入书签名称').fill('Bob已修改');
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await page.locator('.draggable-item').filter({ hasText: 'Bob已修改' }).waitFor();
    const denied = await fetch(api + `/menu/deleteSubmenus/${bobMenus[0].menuLists[0].id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${bobToken}` } });
    assert.equal(denied.status, 403);
    await page.getByText('退出编辑模式', { exact: true }).click();
    console.log('PASS: 普通用户只读菜单无编辑入口、不能拖动、直接接口删除被拒绝；可在只读分类新增并编辑自己的书签');
    const bobWatermark = await assertWatermark('browser-bob');
    assert.notEqual(bobWatermark.mask, lightWatermark.mask);
    await page.goto(url + '/flowchart');
    await page.locator('[data-node]').first().waitFor();
    assert.equal(await page.locator('[data-node]').count(), 4);
    assert.ok(!await page.locator('.flow-canvas').textContent().then(text => text.includes('浏览器流程步骤')));
    await page.getByRole('button', { name: '返回收藏', exact: true }).click();
    await page.waitForURL(target => target.pathname === '/home');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.hasBackground), 'false');
    console.log('PASS: 真实浏览器登录、主题保存、图片上传、刷新恢复、跨页面应用、退出清理和另一账号默认主题');
    console.log('PASS: 动态用户名水印、损坏缓存后恢复、明暗主题及图片背景兼容、跨页面保留、退出清除与切换账号更新');
  } finally {
    if (browser) await browser.close();
    if (vite) { vite.kill(); await new Promise(resolve => vite.exitCode === null ? vite.once('exit', resolve) : resolve()); }
    if (server?.io) await new Promise(resolve => server.io.close(resolve));
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (sequelize) await sequelize.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); await admin.end();
    fs.rmSync(uploads, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
