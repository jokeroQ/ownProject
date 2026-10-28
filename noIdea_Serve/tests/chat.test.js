require('../config/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

test('私聊：隔离 MySQL 迁移、权限、消息幂等、分页与已读', { timeout: 60000 }, async t => {
  const database = `ownproject_chat_test_${crypto.randomBytes(8).toString('hex')}`;
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    socketPath: process.env.DB_SOCKET, connectTimeout: 5000,
  });
  let sequelize, server;
  try {
    // Always create a fresh database before loading the application connection.
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    process.env.DB_NAME = database;
    const models = require('../models');
    sequelize = models.sequelize;
    const { User, Session, ChatConversation, ChatMember, ChatMessage } = models;
    await User.sync();
    await Session.sync();
    const users = await User.bulkCreate(['chat-alice', 'chat-bob', 'chat-carol', 'chat-dave'].map(username => ({
      username, email: `${username}@example.test`, password: 'test-password-placeholder',
    })));
    const [alice, bob, carol, dave] = users;
    const migrate = require('../migrations/chat');
    const service = require('../services/chatService');
    let ab, ac;
    const makeMessage = content => ({ clientMessageId: crypto.randomUUID(), content });
    const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);

    await t.test('迁移可重跑，仅新增聊天表，双方并发打开同一个会话', async () => {
      await migrate();
      const conversations = await Promise.all(Array.from({ length: 6 }, (_, index) =>
        service.createConversation(index % 2 ? bob.id : alice.id, { userId: index % 2 ? alice.id : bob.id })));
      ab = conversations[0].id;
      assert.ok(conversations.every(conversation => conversation.id === ab));
      assert.equal(await ChatConversation.count(), 1);
      assert.equal(await ChatMember.count({ where: { conversation_id: ab } }), 2);
      assert.deepEqual(conversations[0].peer, { id: bob.id, username: bob.username });
      assert.equal(conversations[0].lastReadMessageId, 0);
      assert.equal(conversations[0].lastMessage, null);
      ac = (await service.createConversation(alice.id, { userId: carol.id })).id;
      await migrate();
      assert.equal(await ChatConversation.count(), 2);
      assert.equal(await User.count(), 4);
      const tables = await sequelize.getQueryInterface().showAllTables();
      assert.deepEqual(tables.sort(), ['chat_conversations', 'chat_members', 'chat_messages', 'user_sessions', 'users'].sort());
    });

    await t.test('用户搜索排除自己，仅公开 id、username，限制20人并按字面搜索通配符', async () => {
      await User.bulkCreate(Array.from({ length: 25 }, (_, index) => ({
        username: `search-person-${index}`, email: `search-${index}@example.test`, password: 'private',
      })));
      const result = await service.searchUsers(alice.id, 'search-person');
      assert.equal(result.length, 20);
      assert.ok(result.every(user => Object.keys(user).sort().join(',') === 'id,username'));
      assert.ok((await service.searchUsers(alice.id)).every(user => user.id !== alice.id));
      await User.create({ username: 'literal%name', email: 'literal@example.test', password: 'private' });
      assert.deepEqual((await service.searchUsers(alice.id, '%')).map(user => user.username), ['literal%name']);
      await rejects(service.searchUsers(alice.id, ['bad']), 400);
    });

    const tokens = new Map();
    for (const user of users) {
      const token = crypto.randomBytes(32).toString('hex');
      tokens.set(user.id, token);
      await Session.create({ token_hash: crypto.createHash('sha256').update(token).digest('hex'), user_id: user.id, expires_at: new Date(Date.now() + 3600000) });
    }
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/api/chat', require('../middleware/auth').requireAuth, require('../routes/chatRoutes'));
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message, status: error.status || 500 }));
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}/api/chat`;
    const request = async (method, route, user, body) => {
      const response = await fetch(base + route, {
        method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokens.get(user.id)}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json(), retryAfter: response.headers.get('retry-after') };
    };

    await t.test('HTTP认证、双方收发，发送者取服务端身份，重试返回同条消息', async () => {
      assert.equal((await request('GET', '/conversations')).status, 401);
      const content = { ...makeMessage('你好，Bob 👋\n下一行'), senderId: carol.id };
      const sent = await request('POST', `/conversations/${ab}/messages`, alice, content);
      assert.equal(sent.status, 201);
      assert.equal(sent.body.data.senderId, alice.id);
      assert.equal(sent.body.data.content, content.content);
      assert.ok(Number.isFinite(Date.parse(sent.body.data.createdAt)));
      const retry = await request('POST', `/conversations/${ab}/messages`, alice, content);
      assert.equal(retry.status, 200);
      assert.deepEqual(retry.body.data, sent.body.data);
      assert.equal((await request('POST', `/conversations/${ab}/messages`, alice, { ...content, content: 'changed' })).status, 409);
      assert.equal((await request('POST', `/conversations/${ac}/messages`, alice, content)).status, 409);
      const reply = await request('POST', `/conversations/${ab}/messages`, bob, { ...content, content: '同一UUID可用于另一发送者' });
      assert.equal(reply.status, 201);
      const history = await request('GET', `/conversations/${ab}/messages`, bob);
      assert.deepEqual(history.body.data.map(message => message.senderId), [alice.id, bob.id]);
      assert.equal((await request('GET', '/conversations', bob)).body.data[0].unreadCount, 1);
      assert.equal((await request('GET', '/users?keyword=chat-alice', bob)).body.data[0].username, alice.username);
      assert.equal((await request('POST', '/conversations', bob, { userId: alice.id })).body.data.id, ab);
    });

    await t.test('并发重复发送只插入一次，正文不同的编号复用报409', async () => {
      const body = makeMessage('并发重试');
      const results = await Promise.all(Array.from({ length: 10 }, () => service.sendMessage(alice.id, ab, body)));
      assert.equal(results.filter(result => result.created).length, 1);
      assert.equal(new Set(results.map(result => result.message.id)).size, 1);
      assert.equal(await ChatMessage.count({ where: { sender_id: alice.id, client_message_id: body.clientMessageId } }), 1);
      await rejects(service.sendMessage(alice.id, ab, { ...body, content: 'different' }), 409);
      const crossBody = makeMessage('跨会话同时复用UUID');
      const cross = await Promise.allSettled([service.sendMessage(alice.id, ab, crossBody), service.sendMessage(alice.id, ac, crossBody)]);
      assert.equal(cross.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(cross.find(result => result.status === 'rejected').reason.status, 409);
    });

    await t.test('同一会话事务串行提交，补拉游标不会越过尚未提交的消息', async () => {
      const conversationId = (await service.createConversation(bob.id, { userId: dave.id })).id;
      let release, entered;
      const paused = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      ChatMessage.addHook('afterCreate', 'test-pause-chat-message', async message => {
        if (message.content === 'first-paused') { entered(); await gate; }
      });
      let first, second;
      try {
        first = service.sendMessage(bob.id, conversationId, makeMessage('first-paused'));
        await paused;
        second = service.sendMessage(dave.id, conversationId, makeMessage('second'));
        await new Promise(resolve => setTimeout(resolve, 40));
        assert.deepEqual((await service.listMessages(bob.id, conversationId)).data, []);
      } finally {
        release();
        ChatMessage.removeHook('afterCreate', 'test-pause-chat-message');
        await Promise.all([first, second]);
      }
      const history = (await service.listMessages(bob.id, conversationId)).data;
      assert.deepEqual(history.map(message => message.content), ['first-paused', 'second']);
      assert.equal((await service.listConversations(bob.id)).find(item => item.id === conversationId).lastMessage.id, history[1].id);
    });

    await t.test('默认最新50条，向前分页和断线向后补拉均升序且不漏重复', async () => {
      const conversationId = (await service.createConversation(bob.id, { userId: carol.id })).id;
      await Promise.all(Array.from({ length: 55 }, (_, index) => service.sendMessage(index % 2 ? bob.id : carol.id, conversationId, makeMessage(`page-${index}`))));
      const latest = await service.listMessages(bob.id, conversationId);
      assert.equal(latest.data.length, 50);
      assert.equal(latest.hasMore, true);
      const older = await service.listMessages(bob.id, conversationId, { beforeId: latest.data[0].id });
      assert.equal(older.data.length, 5);
      assert.equal(older.hasMore, false);
      const ids = [...older.data, ...latest.data].map(message => message.id);
      assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
      assert.equal(new Set(ids).size, 55);
      const caughtUp = await service.listMessages(carol.id, conversationId, { afterId: ids[0], limit: 10 });
      assert.deepEqual(caughtUp.data.map(message => message.id), ids.slice(1, 11));
      assert.equal(caughtUp.hasMore, true);
      const fromStart = await service.listMessages(carol.id, conversationId, { afterId: '0', limit: 10 });
      assert.deepEqual(fromStart.data.map(message => message.id), ids.slice(0, 10));
      const end = await service.listMessages(carol.id, conversationId, { afterId: ids.at(-1) });
      assert.deepEqual(end, { data: [], hasMore: false });
    });

    await t.test('第三人无法获取、发送或标记已读，跨会话消息不能作为已读游标', async () => {
      for (const [method, path, body] of [
        ['GET', `/conversations/${ab}/messages`],
        ['POST', `/conversations/${ab}/messages`, makeMessage('unauthorized')],
        ['PUT', `/conversations/${ab}/read`, { messageId: 1 }],
        ['GET', '/conversations/2147483647/messages'],
      ]) assert.equal((await request(method, path, carol, body)).status, 404);
      assert.ok(!(await service.listConversations(carol.id)).some(item => item.id === ab));
      const foreign = (await service.sendMessage(alice.id, ac, makeMessage('foreign conversation'))).message;
      await rejects(service.markRead(bob.id, ab, { messageId: foreign.id }), 404);
    });

    await t.test('未读只计算对方消息，游标递增，双方可看到已读位置', async () => {
      const conversationId = (await service.createConversation(alice.id, { userId: dave.id })).id;
      const own = (await service.sendMessage(alice.id, conversationId, makeMessage('own'))).message;
      const first = (await service.sendMessage(dave.id, conversationId, makeMessage('first unread'))).message;
      const second = (await service.sendMessage(dave.id, conversationId, makeMessage('second unread'))).message;
      const mine = async () => (await service.listConversations(alice.id)).find(item => item.id === conversationId);
      assert.equal((await mine()).unreadCount, 2);
      assert.equal((await request('PUT', `/conversations/${conversationId}/read`, alice, { messageId: first.id })).body.data.lastReadMessageId, first.id);
      assert.equal((await mine()).unreadCount, 1);
      await Promise.all([service.markRead(alice.id, conversationId, { messageId: second.id }), service.markRead(alice.id, conversationId, { messageId: own.id })]);
      assert.equal((await mine()).lastReadMessageId, second.id);
      assert.equal((await mine()).unreadCount, 0);
      assert.equal((await service.listConversations(dave.id)).find(item => item.id === conversationId).peerLastReadMessageId, second.id);
      assert.equal((await service.markRead(alice.id, conversationId, { messageId: first.id })).receipt.lastReadMessageId, second.id);
    });

    await t.test('拒绝无效用户、消息、分页和正文，允许2000字符并保留文本', async () => {
      for (const body of [null, {}, { userId: alice.id }, { userId: '1e1' }, { userId: -1 }]) await rejects(service.createConversation(alice.id, body), 400);
      await rejects(service.createConversation(alice.id, { userId: 2147483647 }), 404);
      for (const body of [null, {}, { ...makeMessage('ok'), clientMessageId: 'bad' }, makeMessage(' \n\t'), makeMessage('a'.repeat(2001)), { ...makeMessage('ok'), content: {} }]) await rejects(service.sendMessage(alice.id, ab, body), 400);
      for (const query of [{ beforeId: 1, afterId: 2 }, { limit: 101 }, { limit: 0 }, { limit: '1e1' }, { beforeId: -1 }, { afterId: ['1', '2'] }]) await rejects(service.listMessages(alice.id, ab, query), 400);
      await rejects(service.markRead(alice.id, ab, { messageId: 0 }), 400);
      await rejects(service.listMessages(alice.id, '../bad'), 400);
      const content = '界'.repeat(2000);
      assert.equal((await service.sendMessage(alice.id, ab, makeMessage(content))).message.content, content);
      assert.equal((await request('GET', `/conversations/${ab}/messages?limit=bad`, alice)).status, 400);
      assert.equal((await request('POST', `/conversations/${ab}/messages`, alice, makeMessage(''))).status, 400);
    });

    await t.test('每用户发送限流返回429和重试时间，不写入非法消息', async () => {
      let last;
      for (let index = 0; index < 61; index++) last = await request('POST', `/conversations/${ab}/messages`, alice, makeMessage(''));
      assert.equal(last.status, 429);
      assert.ok(Number(last.retryAfter) > 0);
      assert.equal(await ChatMessage.count({ where: { content: '' } }), 0);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (sequelize) await sequelize.close();
    if (/^ownproject_chat_test_[a-f0-9]{16}$/.test(database)) await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
  }
});
