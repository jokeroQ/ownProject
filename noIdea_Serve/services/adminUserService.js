const bcrypt = require('bcryptjs');
const { Op, UniqueConstraintError } = require('sequelize');
const { User, Session, sequelize } = require('../models');

const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const positiveInteger = (value, label, maximum = 2147483647) => {
  if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d{0,9}$/.test(String(value))) fail(`${label}格式不正确`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) fail(`${label}格式不正确`);
  return number;
};
const publicAttributes = ['id', 'username', 'email', 'role', 'created_at'];
const managedUser = user => ({
  id: user.id, username: user.username, email: user.email, role: user.role,
  createdAt: new Date(user.created_at).toISOString(),
});
const objectBody = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('请求格式不正确');
  return body;
};
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 255) fail(`${label}应为1至255个字符`);
  return value.trim();
};
const accountPatch = body => {
  objectBody(body);
  const keys = Object.keys(body);
  if (!keys.length || keys.some(key => !['username', 'email', 'role'].includes(key))) fail('仅支持修改用户名、邮箱和角色');
  const result = {};
  if (Object.hasOwn(body, 'username')) result.username = text(body.username, '用户名');
  if (Object.hasOwn(body, 'email')) {
    result.email = text(body.email, '邮箱');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fail('请输入有效的邮箱地址');
  }
  if (Object.hasOwn(body, 'role')) {
    if (!['user', 'admin'].includes(body.role)) fail('角色必须是 user 或 admin');
    result.role = body.role;
  }
  return result;
};

// There is no delete endpoint: the lowest user ID is a stable shared mutex.
// Acquire other user rows in ascending order, matching chat conversation creation.
async function lockedUsers(operatorId, targetId, transaction) {
  const mutex = await User.findOne({ attributes: ['id'], order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  if (!mutex) fail('无管理员权限', 403);
  const users = new Map();
  for (const id of [...new Set([operatorId, targetId])].sort((a, b) => a - b)) {
    users.set(id, await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE }));
  }
  if (users.get(operatorId)?.role !== 'admin') fail('无管理员权限', 403);
  const target = users.get(targetId);
  if (!target) fail('用户不存在', 404);
  return target;
}
const disconnect = userId => {
  // The database change is already committed; a transport failure must not imply rollback.
  try { require('../realtime/chatSocket').disconnectUser(userId); }
  catch (error) { console.error('撤销用户聊天连接失败：', error.message); }
};

exports.listUsers = async (operatorId, query = {}) => {
  // Also protect direct service callers; the route middleware checks before reaching here.
  const operator = await User.findByPk(operatorId, { attributes: ['id', 'role'] });
  if (operator?.role !== 'admin') fail('无管理员权限', 403);
  const page = query.page === undefined ? 1 : positiveInteger(query.page, '页码');
  const pageSize = query.pageSize === undefined ? 20 : positiveInteger(query.pageSize, '每页数量', 100);
  if (query.keyword !== undefined && (typeof query.keyword !== 'string' || query.keyword.length > 255)) fail('搜索关键词最多255个字符');
  const keyword = (query.keyword || '').trim().replace(/[\\%_]/g, character => `\\${character}`);
  const where = keyword ? { [Op.or]: [
    { username: { [Op.like]: `%${keyword}%` } }, { email: { [Op.like]: `%${keyword}%` } },
  ] } : {};
  const [result, adminCount] = await Promise.all([
    User.findAndCountAll({ where, attributes: publicAttributes, order: [['id', 'ASC']], limit: pageSize, offset: (page - 1) * pageSize }),
    User.count({ where: { role: 'admin' } }),
  ]);
  return { users: result.rows.map(managedUser), total: result.count, page, pageSize, adminCount };
};

exports.updateUser = async (operatorId, value, body) => {
  const targetId = positiveInteger(value, '用户编号');
  const patch = accountPatch(body);
  let result;
  try {
    result = await sequelize.transaction(async transaction => {
      const target = await lockedUsers(operatorId, targetId, transaction);
      const changed = Object.keys(patch).some(key => target[key] !== patch[key]);
      if (!changed) return { data: managedUser(target), requiresLogin: false, message: '用户资料未发生变化' };
      if (target.role === 'admin' && patch.role === 'user' && await User.count({ where: { role: 'admin' }, transaction }) <= 1) {
        fail('至少需要保留一位管理员', 409);
      }
      const duplicate = await User.findOne({ where: {
        id: { [Op.ne]: targetId }, [Op.or]: [
          { username: patch.username ?? target.username }, { email: patch.email ?? target.email },
        ],
      }, attributes: ['id'], transaction });
      if (duplicate) fail('用户名或邮箱已存在', 409);
      await target.update(patch, { transaction });
      await Session.destroy({ where: { user_id: targetId }, transaction });
      return { data: managedUser(target), requiresLogin: true, message: '用户资料已更新，该用户需要重新登录' };
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) fail('用户名或邮箱已存在', 409);
    throw error;
  }
  if (result.requiresLogin) disconnect(targetId);
  return result;
};

exports.resetPassword = async (operatorId, value, body) => {
  const targetId = positiveInteger(value, '用户编号');
  objectBody(body);
  if (Object.keys(body).some(key => key !== 'password') || typeof body.password !== 'string' || !body.password || Buffer.byteLength(body.password, 'utf8') > 72) {
    fail('密码不能为空且不能超过72个 UTF-8 字节');
  }
  const password = await bcrypt.hash(body.password, 10);
  await sequelize.transaction(async transaction => {
    const target = await lockedUsers(operatorId, targetId, transaction);
    await target.update({ password }, { transaction });
    await Session.destroy({ where: { user_id: targetId }, transaction });
  });
  disconnect(targetId);
  return { data: { userId: targetId, requiresLogin: true }, message: '密码已重置，该用户需要重新登录' };
};
