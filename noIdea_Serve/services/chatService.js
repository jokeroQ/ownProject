const { Op, QueryTypes, UniqueConstraintError } = require('sequelize');
const { User, ChatConversation, ChatMember, ChatMessage, sequelize } = require('../models');

const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const identifier = (value, label = '编号', allowZero = false) => {
  const pattern = allowZero ? /^(0|[1-9]\d{0,9})$/ : /^[1-9]\d{0,9}$/;
  if (!['number', 'string'].includes(typeof value) || !pattern.test(String(value))) fail(`${label}格式不正确`);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2147483647) fail(`${label}格式不正确`);
  return id;
};
const objectBody = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('请求格式不正确');
  return body;
};
const publicMessage = message => ({
  id: message.id, conversationId: message.conversation_id, senderId: message.sender_id,
  clientMessageId: message.client_message_id, content: message.content,
  createdAt: new Date(message.created_at).toISOString(),
});
const member = async (userId, conversationId, transaction, lock = false) => {
  const membership = await ChatMember.findOne({
    where: { conversation_id: conversationId, user_id: userId }, transaction,
    ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!membership) fail('会话不存在', 404);
  return membership;
};
const memberIds = async (conversationId, transaction) => (await ChatMember.findAll({
  where: { conversation_id: conversationId }, attributes: ['user_id'], transaction,
})).map(item => item.user_id);

async function conversations(userId, conversationId) {
  const ownMembers = await ChatMember.findAll({ where: {
    user_id: userId, ...(conversationId === undefined ? {} : { conversation_id: conversationId }),
  } });
  if (!ownMembers.length) {
    if (conversationId !== undefined) fail('会话不存在', 404);
    return [];
  }
  const ids = ownMembers.map(item => item.conversation_id);
  const [rows, unread] = await Promise.all([
    ChatConversation.findAll({ where: { id: ids }, include: [
      { model: ChatMember, as: 'members', include: [{ model: User, as: 'user', attributes: ['id', 'username'] }] },
      { model: ChatMessage, as: 'lastMessage' },
    ], order: [['updated_at', 'DESC'], ['id', 'DESC']] }),
    sequelize.query(`SELECT message.conversation_id, COUNT(*) AS unread_count
      FROM chat_messages AS message
      INNER JOIN chat_members AS membership ON membership.conversation_id = message.conversation_id
      WHERE membership.user_id = :userId AND message.sender_id <> :userId
        AND message.id > membership.last_read_message_id
      GROUP BY message.conversation_id`, { replacements: { userId }, type: QueryTypes.SELECT }),
  ]);
  const counts = new Map(unread.map(item => [item.conversation_id, Number(item.unread_count)]));
  return rows.map(conversation => {
    const own = conversation.members.find(item => item.user_id === userId);
    const peer = conversation.members.find(item => item.user_id !== userId);
    if (!own || !peer?.user) fail('会话不存在', 404);
    return {
      id: conversation.id, peer: { id: peer.user.id, username: peer.user.username },
      lastMessage: conversation.lastMessage ? publicMessage(conversation.lastMessage) : null,
      unreadCount: counts.get(conversation.id) || 0,
      lastReadMessageId: own.last_read_message_id,
      peerLastReadMessageId: peer.last_read_message_id,
      updatedAt: new Date(conversation.updated_at).toISOString(),
    };
  });
}

exports.searchUsers = async (userId, keyword = '') => {
  if (typeof keyword !== 'string' || keyword.length > 100) fail('搜索关键词最多100个字符');
  // Locate literal text, so wildcard characters do not turn into broad searches.
  const escaped = keyword.trim().replace(/[\\%_]/g, character => `\\${character}`);
  const users = await User.findAll({
    where: { id: { [Op.ne]: userId }, ...(escaped ? { username: { [Op.like]: `%${escaped}%` } } : {}) },
    attributes: ['id', 'username'], order: [['username', 'ASC'], ['id', 'ASC']], limit: 20,
  });
  return users.map(user => ({ id: user.id, username: user.username }));
};

exports.listConversations = userId => conversations(userId);
exports.createConversation = async (userId, body) => {
  const peerId = identifier(objectBody(body).userId, '用户编号');
  if (peerId === userId) fail('不能与自己创建私聊');
  const id = await sequelize.transaction(async transaction => {
    // Lock both users in a fixed order so simultaneous create requests share one pair.
    for (const id of [userId, peerId].sort((a, b) => a - b)) {
      if (!await User.findByPk(id, { attributes: ['id'], transaction, lock: transaction.LOCK.UPDATE })) fail('用户不存在', 404);
    }
    const directKey = [userId, peerId].sort((a, b) => a - b).join(':');
    let conversation = await ChatConversation.findOne({ where: { direct_key: directKey }, transaction });
    if (!conversation) {
      conversation = await ChatConversation.create({ direct_key: directKey }, { transaction });
      await ChatMember.bulkCreate([userId, peerId].map(id => ({ conversation_id: conversation.id, user_id: id })), { transaction });
    }
    return conversation.id;
  });
  return (await conversations(userId, id))[0];
};

exports.listMessages = async (userId, value, query = {}) => {
  const conversationId = identifier(value, '会话编号');
  await member(userId, conversationId);
  if (query.beforeId !== undefined && query.afterId !== undefined) fail('不能同时指定 beforeId 和 afterId');
  const limit = query.limit === undefined ? 50 : identifier(query.limit, '分页数量');
  if (limit > 100) fail('每页最多100条消息');
  const after = query.afterId !== undefined;
  const cursor = after ? query.afterId : query.beforeId;
  const where = { conversation_id: conversationId };
  if (cursor !== undefined) where.id = { [after ? Op.gt : Op.lt]: identifier(cursor, '消息编号', after) };
  const rows = await ChatMessage.findAll({ where, order: [['id', after ? 'ASC' : 'DESC']], limit: limit + 1 });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (!after) page.reverse();
  return { data: page.map(publicMessage), hasMore };
};

const existingResult = async (existing, conversationId, content, transaction) => {
  if (existing.conversation_id !== conversationId || existing.content !== content) fail('该消息编号已用于其他内容', 409);
  return { message: publicMessage(existing), memberIds: await memberIds(conversationId, transaction), created: false };
};
exports.sendMessage = async (userId, value, body) => {
  const conversationId = identifier(value, '会话编号');
  objectBody(body);
  if (typeof body.clientMessageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientMessageId)) fail('客户端消息编号必须是 UUID');
  if (typeof body.content !== 'string' || !body.content.trim() || Array.from(body.content).length > 2000) fail('消息应为1至2000个字符的非空文本');
  const clientId = body.clientMessageId.toLowerCase();
  const duplicateWhere = { sender_id: userId, client_message_id: clientId };
  await member(userId, conversationId);
  try {
    return await sequelize.transaction(async transaction => {
      // All writers lock the conversation before assigning an auto-increment ID.
      // A reconnect cursor cannot pass an earlier, still uncommitted message.
      const conversation = await ChatConversation.findByPk(conversationId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!conversation) fail('会话不存在', 404);
      await member(userId, conversationId, transaction);
      const existing = await ChatMessage.findOne({ where: duplicateWhere, transaction });
      if (existing) return existingResult(existing, conversationId, body.content, transaction);
      const message = await ChatMessage.create({
        conversation_id: conversationId, sender_id: userId, client_message_id: clientId, content: body.content,
      }, { transaction });
      await conversation.update({ last_message_id: message.id, updated_at: new Date() }, { transaction });
      return { message: publicMessage(message), memberIds: await memberIds(conversationId, transaction), created: true };
    });
  } catch (error) {
    // The same sender can retry a UUID concurrently against different conversations.
    if (!(error instanceof UniqueConstraintError)) throw error;
    const existing = await ChatMessage.findOne({ where: duplicateWhere });
    if (!existing) throw error;
    return existingResult(existing, conversationId, body.content);
  }
};

exports.markRead = async (userId, value, body) => {
  const conversationId = identifier(value, '会话编号');
  const messageId = identifier(objectBody(body).messageId, '消息编号');
  await member(userId, conversationId);
  return sequelize.transaction(async transaction => {
    // Use the same lock order as sendMessage to serialize cursors and new messages.
    const conversation = await ChatConversation.findByPk(conversationId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!conversation) fail('会话不存在', 404);
    const membership = await member(userId, conversationId, transaction, true);
    if (!await ChatMessage.findOne({ where: { id: messageId, conversation_id: conversationId }, transaction })) fail('消息不存在', 404);
    if (messageId > membership.last_read_message_id) await membership.update({ last_read_message_id: messageId }, { transaction });
    return {
      receipt: { conversationId, userId, lastReadMessageId: membership.last_read_message_id },
      memberIds: await memberIds(conversationId, transaction),
    };
  });
};
