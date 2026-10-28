// Optional integration smoke test: requires MySQL, frontend dependencies and Playwright Chromium.
// DB_* selects an admin connection only. This test always creates and drops its own random database.
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
async function eventually(check, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error(description);
}
async function freePort() {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => reservation.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  return port;
}
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  const finished = await Promise.race([
    new Promise(resolve => child.once('exit', () => resolve(true))),
    pause(5000).then(() => false),
  ]);
  if (!finished) child.kill('SIGKILL');
}

async function main() {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  assert.match(database, /^ownproject_test_[a-f0-9]{16}$/);
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-browser-'));
  const savedEnvironment = Object.fromEntries(['DB_NAME', 'THEME_UPLOAD_DIR', 'PORT'].map(name => [name, process.env[name]]));
  Object.assign(process.env, { DB_NAME: database, THEME_UPLOAD_DIR: uploads, PORT: '0' });
  let admin, createdDatabase = false, sequelize, server, vite, browser;
  const connections = new Set();
  const cleanupErrors = [];
  const diagnostics = [];
  const record = value => {
    diagnostics.push(String(value).replace(/[a-f0-9]{64}/gi, '[redacted]').slice(0, 800));
    if (diagnostics.length > 80) diagnostics.shift();
  };
  const observePage = (page, label) => {
    page.on('pageerror', error => record(`${label} pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') record(`${label} console: ${message.text()}`); });
    page.on('requestfailed', req => record(`${label} request failed: ${req.method()} ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`));
    page.on('response', response => {
      if (response.status() >= 400) record(`${label} HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
    });
  };
  try {
    admin = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET, multipleStatements: true });
    await admin.query(`CREATE DATABASE \`${database}\``);
    createdDatabase = true;
    await admin.query(`USE \`${database}\``);
    await admin.query(fs.readFileSync(path.join(__dirname, 'fixtures/legacy.sql'), 'utf8'));
    ({ sequelize } = require('../models'));
    await admin.query('INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,NOW())',
      ['cara', 'cara@example.test', await require('bcryptjs').hash('chat-browser-password', 10)]);
    for (const migration of ['user-data', 'themes', 'flowcharts', 'chat']) await require(`../migrations/${migration}`)();
    server = await require('../app').start();
    server.on('connection', socket => {
      connections.add(socket);
      socket.once('close', () => connections.delete(socket));
    });
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const api = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (token, method, route, body) => {
      const response = await fetch(api + route, { method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const payload = await response.json();
      assert.ok(response.ok, `${method} ${route} failed (${response.status})`);
      return payload;
    };
    const users = {};
    for (const name of ['alice', 'bob', 'charlie']) {
      const username = `chat-browser-${name}`;
      users[name] = (await request(null, 'POST', '/users/register', {
        username, password: 'chat-browser-password', email: `${username}@example.test`,
      })).user;
    }
    const frontend = process.env.CHAT_FRONTEND_ROOT || path.resolve(__dirname, '../../noIdea_Front');
    const frontendPort = Number(process.env.CHAT_FRONTEND_PORT || await freePort());
    const url = `http://127.0.0.1:${frontendPort}`;
    vite = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
      '--port', String(frontendPort), '--strictPort'], { cwd: frontend,
      env: { ...process.env, VITE_API_BASE_URL: api, VITE_CACHE_DIR: path.join(uploads, 'vite-cache') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    vite.stdout.on('data', chunk => { output = (output + chunk).slice(-6000); });
    vite.stderr.on('data', chunk => { output = (output + chunk).slice(-6000); });
    let spawnError;
    vite.once('error', error => { spawnError = error; });
    await eventually(async () => {
      if (spawnError) throw new Error(`Vite could not start: ${spawnError.message}`);
      if (vite.exitCode !== null) throw new Error(`Vite exited before becoming ready: ${output}`);
      try { return (await fetch(url)).ok; } catch { return false; }
    }, `Vite did not become ready: ${output}`, 20000);
    browser = await chromium.launch({ headless: true,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
    const aliceContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const bobContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const alice = await aliceContext.newPage();
    const bob = await bobContext.newPage();
    observePage(alice, 'Alice');
    observePage(bob, 'Bob');
    const login = async (page, user) => {
      await page.goto(url);
      await page.locator('input').nth(0).fill(user.username);
      await page.locator('input[type=password]').fill('chat-browser-password');
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/users/login') && response.request().method() === 'POST');
      await page.getByRole('button', { name: '登录', exact: true }).click();
      const response = await responsePromise;
      assert.ok(response.ok(), `Browser login should succeed (${response.status()})`);
      await page.waitForURL(target => target.pathname === '/home', { waitUntil: 'domcontentloaded' });
      return page.evaluate(() => localStorage.getItem('token'));
    };
    const aliceToken = await login(alice, users.alice);
    const bobToken = await login(bob, users.bob);
    assert.ok(aliceToken && bobToken, 'Both independent browser sessions must authenticate');
    const list = token => request(token, 'GET', '/chat/conversations').then(body => body.data);
    const messages = (token, id, query = '') => request(token, 'GET', `/chat/conversations/${id}/messages${query}`);
    const messageRow = (page, id) => page.locator(`[data-chat-message="${id}"]`);
    const openConversation = async (page, id) => {
      await page.bringToFront();
      await page.locator(`[data-chat-conversation="${id}"]`).click();
      await page.locator('[data-chat-composer]').waitFor();
    };
    const send = async (page, content) => {
      await page.bringToFront();
      const responsePromise = page.waitForResponse(response => response.url().includes('/api/chat/conversations/') &&
        response.url().split('?')[0].endsWith('/messages') && response.request().method() === 'POST');
      await page.locator('[data-chat-composer]').fill(content);
      await page.locator('[data-chat-send]').click();
      const response = await responsePromise;
      assert.ok(response.ok(), 'UI message send should persist successfully');
      const message = (await response.json()).data;
      await messageRow(page, message.id).waitFor();
      return message;
    };
    await alice.goto(url + '/chat');
    await bob.goto(url + '/chat');
    await alice.locator('[data-chat-search]').fill(users.bob.username);
    await alice.locator(`[data-chat-user="${users.bob.id}"]`).click();
    let conversation;
    await eventually(async () => {
      conversation = (await list(aliceToken)).find(item => item.peer.id === users.bob.id);
      return !!conversation;
    }, 'Creating a conversation should show it in the authenticated user list');
    const conversationId = conversation.id;
    const first = await send(alice, '你好 Bob，这是浏览器实时消息。');
    await bob.locator(`[data-chat-conversation="${conversationId}"]`).waitFor();
    await openConversation(bob, conversationId);
    await messageRow(bob, first.id).waitFor();
    const reply = await send(bob, '收到 Alice，我可以实时回复。');
    await messageRow(alice, reply.id).waitFor();
    const liveReply = await send(alice, '我也能实时收到你的回复。');
    await messageRow(bob, liveReply.id).waitFor();
    assert.equal(await messageRow(alice, first.id).count(), 1, 'REST result and realtime echo must merge into one bubble');
    assert.equal(await messageRow(bob, reply.id).count(), 1);
    await alice.reload();
    await openConversation(alice, conversationId);
    await messageRow(alice, first.id).waitFor();
    await messageRow(alice, reply.id).waitFor();
    console.log('PASS: 两个独立账号搜索发起私聊、双向实时收发、消息无重复及刷新恢复历史');

    await bob.goto(url + '/home');
    const unread = await send(alice, '离开聊天页后收到的未读消息');
    await eventually(async () => (await list(bobToken)).find(item => item.id === conversationId)?.unreadCount > 0,
      'Incoming messages should increase the recipient unread count');
    await bob.goto(url + '/chat');
    await openConversation(bob, conversationId);
    await messageRow(bob, unread.id).waitFor();
    await eventually(async () => (await list(bobToken)).find(item => item.id === conversationId)?.unreadCount === 0,
      'Opening the conversation should mark visible messages read');
    await bobContext.setOffline(true);
    const offlineMessage = await send(alice, '断线期间发送，恢复网络后需要补取');
    await bobContext.setOffline(false);
    await messageRow(bob, offlineMessage.id).waitFor({ timeout: 20000 });
    assert.equal(await messageRow(bob, offlineMessage.id).count(), 1);
    console.log('PASS: 未读计数、打开会话后已读，以及断线恢复后补取遗漏消息');

    const retryContent = '失败重试沿用客户端编号';
    let failedClientId, retriedClientId;
    await alice.route('**/api/chat/conversations/*/messages', async route => {
      const req = route.request();
      if (req.method() === 'POST' && req.postDataJSON().content === retryContent) {
        const payload = req.postDataJSON();
        if (!failedClientId) { failedClientId = payload.clientMessageId; return route.abort('failed'); }
        retriedClientId = payload.clientMessageId;
      }
      await route.continue();
    });
    await alice.locator('[data-chat-composer]').fill(retryContent);
    await alice.locator('[data-chat-send]').click();
    const retryRow = alice.locator('[data-chat-message-client]').filter({ hasText: retryContent });
    await retryRow.locator('[data-chat-retry]').waitFor();
    const retryResponse = alice.waitForResponse(response => response.request().method() === 'POST' &&
      response.url().endsWith(`/conversations/${conversationId}/messages`));
    await retryRow.locator('[data-chat-retry]').click();
    const retried = await retryResponse;
    assert.ok(retried.ok());
    const retryMessage = (await retried.json()).data;
    assert.ok(failedClientId, 'First failed send must have a client message ID');
    assert.equal(retriedClientId, failedClientId, 'Retry must reuse the original client message ID');
    const duplicate = (await request(aliceToken, 'POST', `/chat/conversations/${conversationId}/messages`,
      { clientMessageId: failedClientId, content: retryContent })).data;
    assert.equal(duplicate.id, retryMessage.id, 'Duplicate POST must return the original saved message');
    await messageRow(alice, retryMessage.id).waitFor();
    await messageRow(bob, retryMessage.id).waitFor();
    assert.equal((await messages(aliceToken, conversationId, '?limit=100')).data.filter(item => item.clientMessageId === failedClientId).length, 1);
    assert.equal(await alice.locator('[data-chat-message-client]').filter({ hasText: retryContent }).count(), 1);
    await alice.unroute('**/api/chat/conversations/*/messages');
    console.log('PASS: 发送失败可重试，客户端编号保持一致，重复请求只保存和展示一条消息');

    for (let i = 0; i < 65; i++) {
      await request(i % 2 ? bobToken : aliceToken, 'POST', `/chat/conversations/${conversationId}/messages`,
        { clientMessageId: crypto.randomUUID(), content: `分页历史 ${String(i + 1).padStart(2, '0')}` });
    }
    await alice.reload();
    await openConversation(alice, conversationId);
    const initialPage = await messages(aliceToken, conversationId, '?limit=20');
    assert.equal(initialPage.data.length, 20);
    assert.equal(initialPage.hasMore, true);
    assert.ok(initialPage.data.every((item, i, data) => i === 0 || item.id > data[i - 1].id), 'History is returned in display order');
    const previousPage = await messages(aliceToken, conversationId, `?limit=20&beforeId=${initialPage.data[0].id}`);
    assert.ok(previousPage.data.every(item => item.id < initialPage.data[0].id));
    assert.equal(new Set([...initialPage.data, ...previousPage.data].map(item => item.id)).size, 40);
    for (let attempt = 0; attempt < 10 && !await messageRow(alice, first.id).count(); attempt++) {
      const beforeCount = await alice.locator('[data-chat-message]').count();
      await alice.locator('[data-chat-more]').click();
      await eventually(async () => await alice.locator('[data-chat-message]').count() > beforeCount,
        'Loading earlier history should append messages');
    }
    await messageRow(alice, first.id).waitFor();
    console.log('PASS: 历史记录分页、顺序、无重叠及浏览器加载更早消息');

    const charlieToken = (await request(null, 'POST', '/users/login', {
      username: users.charlie.username, password: 'chat-browser-password',
    })).token;
    for (const [method, suffix, body] of [
      ['GET', '/messages'], ['POST', '/messages', { clientMessageId: crypto.randomUUID(), content: '禁止越权发送' }],
      ['PUT', '/read', { messageId: first.id }],
    ]) {
      const response = await fetch(api + `/chat/conversations/${conversationId}${suffix}`, { method,
        headers: { Authorization: `Bearer ${charlieToken}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.ok(response.status === 403 || response.status === 404, `Non-member ${method} ${suffix} must be denied`);
    }
    if (process.env.CHAT_SCREENSHOT) await alice.screenshot({
      path: process.env.CHAT_SCREENSHOT.replace(/(?:\.png)?$/i, '-desktop.png'), fullPage: true,
    });
    await alice.setViewportSize({ width: 390, height: 844 });
    assert.ok(await alice.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile chat must fit the viewport');
    if (process.env.CHAT_SCREENSHOT) await alice.screenshot({
      path: process.env.CHAT_SCREENSHOT.replace(/(?:\.png)?$/i, '-conversation.png'), fullPage: true,
    });
    await alice.locator('[data-chat-back-list]').click();
    await alice.locator(`[data-chat-conversation="${conversationId}"]`).waitFor({ state: 'visible' });
    assert.ok(await alice.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile conversation list must fit the viewport');
    if (process.env.CHAT_SCREENSHOT) await alice.screenshot({ path: process.env.CHAT_SCREENSHOT, fullPage: true });
    await alice.getByRole('button', { name: /返回收藏/ }).click();
    await alice.waitForURL(target => target.pathname === '/home');
    console.log('PASS: 非成员不能读写私聊、手机布局无横向溢出、返回会话列表和收藏入口');

    // A delayed request from a former login must not clear a newer valid session.
    const loginDetails = () => request(null, 'POST', '/users/login', {
      username: users.alice.username, password: 'chat-browser-password',
    });
    const oldLogin = await loginDetails();
    const newLogin = await loginDetails();
    const authContext = await browser.newContext();
    const authPage = await authContext.newPage();
    observePage(authPage, 'Auth-race');
    await authPage.goto(url);
    await authPage.getByRole('button', { name: '登录', exact: true }).waitFor();
    await authPage.evaluate(login => {
      localStorage.setItem('token', login.token);
      localStorage.setItem('user', JSON.stringify(login.user));
    }, oldLogin);
    let releaseOldResponse;
    let confirmIntercept;
    const intercepted = new Promise(resolve => { confirmIntercept = resolve; });
    await authPage.route('**/api/users/me?chat-auth-stale=1', async route => {
      assert.ok(route.request().headers().authorization === `Bearer ${oldLogin.token}`, 'The delayed request must belong to the old session');
      const released = new Promise(resolve => { releaseOldResponse = resolve; });
      confirmIntercept();
      await released;
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Expired test session' }) });
    });
    const staleResponse = authPage.evaluate(async () => {
      const { default: client } = await import('/src/api/apiClient.ts');
      try { await client.get('/users/me?chat-auth-stale=1'); return 200; }
      catch (error) { return error.response?.status || 0; }
    }).catch(error => { record(`Auth-race evaluation failed: ${error.message}`); return 0; });
    await Promise.race([intercepted, pause(10000).then(() => { throw new Error('The old-session request was not intercepted'); })]);
    await authPage.evaluate(login => {
      localStorage.setItem('token', login.token);
      localStorage.setItem('user', JSON.stringify(login.user));
    }, newLogin);
    releaseOldResponse();
    assert.equal(await staleResponse, 401);
    assert.ok(await authPage.evaluate(token => localStorage.getItem('token') === token, newLogin.token), 'An old-session 401 must preserve the new login token');
    await authContext.close();
    console.log('PASS: 旧会话延迟返回401不会清除新登录账号的有效凭据');
  } catch (error) {
    if (browser) {
      const base = process.env.CHAT_SCREENSHOT || path.join(os.tmpdir(), `chat-browser-${database}.png`);
      let index = 0;
      for (const context of browser.contexts()) for (const page of context.pages()) {
        try {
          const screenshot = base.replace(/(?:\.png)?$/i, `-failure-${++index}.png`);
          await page.screenshot({ path: screenshot, fullPage: true, timeout: 5000 });
          console.error(`Failure screenshot: ${screenshot}`);
        } catch { /* A closed page must not prevent database cleanup. */ }
      }
    }
    if (diagnostics.length) console.error('Browser diagnostics:\n' + diagnostics.join('\n'));
    throw error;
  } finally {
    // Every resource is attempted even if another cleanup operation fails.
    const cleanup = async action => { try { await action(); } catch (error) { cleanupErrors.push(error.message); } };
    await cleanup(async () => { if (browser) await browser.close(); });
    await cleanup(() => stopChild(vite));
    await cleanup(async () => {
      if (server?.io) await new Promise(resolve => server.io.close(resolve));
      for (const socket of connections) socket.destroy();
      if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });
    await cleanup(async () => { if (sequelize) await sequelize.close(); });
    await cleanup(async () => {
      if (admin && createdDatabase) {
        assert.match(database, /^ownproject_test_[a-f0-9]{16}$/);
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
      }
    });
    await cleanup(async () => { if (admin) await admin.end(); });
    await cleanup(async () => fs.rmSync(uploads, { recursive: true, force: true }));
    for (const [name, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    if (cleanupErrors.length) {
      console.error(`Chat smoke cleanup failed: ${cleanupErrors.join('; ')}`);
      process.exitCode = 1;
    }
  }
}
main().catch(error => { console.error(`Chat browser smoke failed: ${error.message}`); process.exitCode = 1; });
