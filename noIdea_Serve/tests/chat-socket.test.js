require('../config/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { io } = require('socket.io-client');

const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`未收到 ${name}`)); }, 4000);
  const listener = value => { clearTimeout(timer); socket.off(name, listener); resolve(value); };
  socket.on(name, listener);
});

test('真实聊天连接认证、定向通知和会话撤销', async t => {
  const database = `ownproject_test_${crypto.randomBytes(8).toString('hex')}`;
  const originalDatabase = process.env.DB_NAME;
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', socketPath: process.env.DB_SOCKET,
  });
  let sequelize, server;
  const clients = [];
  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    process.env.DB_NAME = database;
    const models = require('../models');
    sequelize = models.sequelize;
    await models.User.sync();
    await models.Session.sync();
    await require('../migrations/chat')();
    const users = await Promise.all(['alice', 'bob', 'outsider'].map(username => models.User.create({
      username, email: `${username}@example.test`, password: 'test-only-unused-hash',
    })));
    const { hashToken } = require('../middleware/auth');
    const session = async userId => {
      const token = crypto.randomBytes(32).toString('hex');
      await models.Session.create({ token_hash: hashToken(token), user_id: userId, expires_at: new Date(Date.now() + 3600000) });
      return token;
    };
    const [aliceToken, bobToken, outsiderToken] = await Promise.all(users.map(user => session(user.id)));
    server = require('../app').createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (token, method, route, body) => {
      const response = await fetch(origin + '/api' + route, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const connect = async token => {
      const socket = io(origin, { auth: { token }, transports: ['websocket'], reconnection: false, autoConnect: false });
      clients.push(socket);
      const connected = event(socket, 'connect');
      socket.connect();
      await connected;
      return socket;
    };
    await t.test('未登录和伪造凭证不能建立连接', async () => {
      for (const token of ['', 'a'.repeat(64)]) {
        const socket = io(origin, { auth: { token }, transports: ['websocket'], reconnection: false, autoConnect: false });
        clients.push(socket);
        const rejected = event(socket, 'connect_error');
        socket.connect();
        assert.equal((await rejected).data.status, 401);
        socket.close();
      }
    });
    const [alice, aliceTab, bob, outsider] = await Promise.all([
      connect(aliceToken), connect(aliceToken), connect(bobToken), connect(outsiderToken),
    ]);
    const conversation = await request(aliceToken, 'POST', '/chat/conversations', { userId: users[1].id });
    assert.equal(conversation.status, 200);
    const id = conversation.body.data.id;
    let message;
    await t.test('只有双方的设备收到一次消息，不能伪造加入别人房间', async () => {
      const outside = [];
      outsider.on('chat:message', value => outside.push(value));
      outsider.emit('join', `user:${users[1].id}`);
      const received = [alice, aliceTab, bob].map(socket => event(socket, 'chat:message'));
      const sent = await request(aliceToken, 'POST', `/chat/conversations/${id}/messages`, {
        clientMessageId: crypto.randomUUID(), content: '跨设备实时消息 📨', senderId: users[2].id,
      });
      assert.equal(sent.status, 201);
      message = sent.body.data;
      assert.equal(message.senderId, users[0].id);
      for (const value of await Promise.all(received)) assert.deepEqual(value, message);
      await new Promise(resolve => setTimeout(resolve, 80));
      assert.deepEqual(outside, []);
      const replay = await request(aliceToken, 'POST', `/chat/conversations/${id}/messages`, {
        clientMessageId: message.clientMessageId, content: message.content,
      });
      assert.equal(replay.status, 200);
      assert.equal(replay.body.data.id, message.id);
    });
    await t.test('已读位置实时通知双方并持久保存', async () => {
      const delivered = event(alice, 'chat:read');
      const result = await request(bobToken, 'PUT', `/chat/conversations/${id}/read`, { messageId: message.id });
      assert.equal(result.status, 200);
      assert.deepEqual(await delivered, { conversationId: id, userId: users[1].id, lastReadMessageId: message.id });
      assert.equal((await request(bobToken, 'GET', '/chat/conversations')).body.data[0].unreadCount, 0);
    });
    await t.test('撤销或过期的会话不能继续接收消息', async () => {
      await models.Session.update({ expires_at: new Date(Date.now() - 1000) }, { where: { token_hash: hashToken(bobToken) } });
      let leaked = false;
      bob.on('chat:message', () => { leaked = true; });
      const rejected = event(bob, 'chat:unauthorized');
      const sent = await request(aliceToken, 'POST', `/chat/conversations/${id}/messages`, {
        clientMessageId: crypto.randomUUID(), content: '不能推送给已过期的连接',
      });
      assert.equal(sent.status, 201);
      await rejected;
      assert.equal(leaked, false);
      assert.equal((await request(bobToken, 'GET', '/chat/conversations')).status, 401);
    });
    await t.test('退出立即关闭该会话的全部连接，保留同账号其他登录', async () => {
      const otherToken = await session(users[0].id);
      const otherDevice = await connect(otherToken);
      const rejected = [alice, aliceTab].map(socket => event(socket, 'chat:unauthorized'));
      assert.equal((await request(aliceToken, 'POST', '/users/logout', {})).status, 200);
      await Promise.all(rejected);
      assert.equal(otherDevice.connected, true);
      assert.equal((await request(otherToken, 'GET', '/chat/conversations')).status, 200);
      assert.equal((await request(aliceToken, 'GET', '/chat/conversations')).status, 401);
    });
    await t.test('管理员重置密码立即撤销该用户所有登录与聊天连接', async () => {
      await users[0].update({ role: 'admin' });
      const adminToken = await session(users[0].id);
      const secondToken = await session(users[2].id);
      const secondDevice = await connect(secondToken);
      const rejected = [outsider, secondDevice].map(socket => event(socket, 'chat:unauthorized'));
      const reset = await request(adminToken, 'PUT', `/admin/users/${users[2].id}/password`, {
        password: 'reset-password-for-socket-test',
      });
      assert.equal(reset.status, 200);
      await Promise.all(rejected);
      for (const token of [outsiderToken, secondToken]) {
        assert.equal((await request(token, 'GET', '/users/me')).status, 401);
      }
      assert.equal(await models.Session.count({ where: { user_id: users[2].id } }), 0);
      assert.equal((await request(adminToken, 'GET', '/users/me')).status, 200);
    });
  } finally {
    for (const client of clients) client.close();
    if (server?.io) await new Promise(resolve => server.io.close(resolve));
    else if (server) await new Promise(resolve => server.close(resolve));
    if (sequelize) await sequelize.close();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
    if (originalDatabase === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = originalDatabase;
  }
});
