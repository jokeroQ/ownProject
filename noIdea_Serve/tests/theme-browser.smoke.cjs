// Optional real-browser smoke test. See THEME_SETUP.md for prerequisites.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const sharp = require('sharp');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

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
    await models.User.create({ username: 'cara', password: await require('bcryptjs').hash('browser-password', 10), email: 'cara@example.test' });
    await require('../migrations/user-data')(); await require('../migrations/themes')();
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
    const url = `http://127.0.0.1:${frontendPort}`;
    vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
      cwd: frontend, env: { ...process.env, VITE_API_BASE_URL: api }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = ''; vite.stdout.on('data', chunk => output += chunk); vite.stderr.on('data', chunk => output += chunk);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (vite.exitCode !== null) throw new Error('Vite 启动失败：' + output);
      try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* Still starting. */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, output);
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const login = async username => {
      await page.goto(url);
      await page.locator('input').nth(0).fill(username);
      await page.locator('input[type=password]').fill('browser-password');
      await page.getByRole('button', { name: '登录', exact: true }).click();
      await page.waitForURL(target => target.pathname === '/home');
      await page.getByRole('button', { name: '主题设置', exact: true }).waitFor();
    };
    await login('browser-alice');
    await page.getByRole('button', { name: '主题设置', exact: true }).click();
    await page.locator('#theme-mode').selectOption('dark');
    await page.locator('#theme-color').fill('#7c3aed');
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
    await page.getByText('背景图片已保存', { exact: true }).waitFor();
    await page.locator('#theme-mode').selectOption('light');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal((await getTheme()).mode, 'dark');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && document.documentElement.dataset.hasBackground === 'true');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()), '#7c3aed');
    const sidebarStyle = await page.locator('.el-aside').evaluate(element => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
    assert.equal(sidebarStyle.color, 'rgb(226, 232, 240)');
    assert.equal(sidebarStyle.background, 'rgba(24, 34, 51, 0.88)');
    assert.equal(await page.locator('.full-height').evaluate(element => Math.round(element.getBoundingClientRect().height)), 900);
    if (process.env.THEME_SCREENSHOT) await page.screenshot({ path: process.env.THEME_SCREENSHOT, fullPage: true });
    await page.goto(url + '/chat');
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
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.hasBackground), 'false');
    await login('browser-bob');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.hasBackground), 'false');
    console.log('PASS: 真实浏览器登录、主题保存、图片上传、刷新恢复、跨页面应用、退出清理和另一账号默认主题');
  } finally {
    if (browser) await browser.close();
    if (vite) { vite.kill(); await new Promise(resolve => vite.exitCode === null ? vite.once('exit', resolve) : resolve()); }
    if (server) await new Promise(resolve => server.close(resolve));
    if (sequelize) await sequelize.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); await admin.end();
    fs.rmSync(uploads, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
