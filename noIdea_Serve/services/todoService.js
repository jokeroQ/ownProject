const { Op, fn, col, where, literal } = require('sequelize');
const { User, UserTodo, sequelize } = require('../models');
const { getCalendar, periodDate, periodKey, isCompleted } = require('./todoPeriods');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const own = (value, key) => Object.hasOwn(value, key);
function validateId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d{0,9}$/.test(String(value)) || Number(value) > 2147483647) fail('待办标识不正确');
  return Number(value);
}
function validateDate(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || +value.slice(0, 4) < 1900 || +value.slice(0, 4) > 2100) fail('计划日期不正确');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('计划日期不存在');
  return value;
}
function validateInput(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('待办信息格式不正确');
  const keys = Object.keys(body), allowed = ['title', 'notes', 'dueDate', 'important', 'recurrence', ...(!creating ? ['completed', 'periodKey'] : [])];
  if (!keys.length || keys.some(key => !allowed.includes(key))) fail('包含不支持的待办字段');
  const result = {};
  if (creating || own(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(body.title)) fail('事项内容应为1–120个字符');
    result.title = body.title.trim();
  }
  if (own(body, 'notes')) {
    if (typeof body.notes !== 'string' || body.notes.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.notes)) fail('备注不能超过2000个字符');
    result.notes = body.notes.trim();
  }
  if (own(body, 'dueDate')) result.due_date = validateDate(body.dueDate);
  if (own(body, 'recurrence')) {
    if (!['none', 'daily', 'weekly'].includes(body.recurrence)) fail('待办类型不正确');
    result.recurrence = body.recurrence;
  }
  if (own(body, 'periodKey')) {
    if (!own(body, 'completed') || (body.periodKey !== null && (typeof body.periodKey !== 'string' || !/^(daily|weekly):\d{4}-\d{2}-\d{2}$/.test(body.periodKey)))) fail('待办周期不正确');
    result.periodKey = body.periodKey;
  }
  for (const key of ['important', 'completed']) if (own(body, key)) {
    if (typeof body[key] !== 'boolean') fail('待办状态不正确');
    result[key] = body[key];
  }
  return result;
}
function validateQuery(input = {}) {
  const scalar = (key, fallback) => { if (input[key] === undefined) return fallback; if (typeof input[key] !== 'string') fail('待办筛选格式不正确'); return input[key].trim(); };
  const query = { status: scalar('status', 'all'), keyword: scalar('keyword', ''), sort: scalar('sort', 'recent'), page: scalar('page', '1'), recurrence: scalar('recurrence', 'all') };
  if (!['all', 'none', 'daily', 'weekly'].includes(query.recurrence)) fail('待办类型筛选不正确');
  if (!['all', 'open', 'done'].includes(query.status) || !['recent', 'due', 'important'].includes(query.sort) || query.keyword.length > 120 || !/^[1-9]\d{0,3}$/.test(query.page) || +query.page > 1000) fail('待办筛选或页码不正确');
  return { ...query, page: Number(query.page) };
}
const publicTodo = (row, calendar) => ({ id: row.id, title: row.title, notes: row.notes, recurrence: row.recurrence, periodKey: periodKey(row.recurrence, calendar), dueDate: row.due_date ?? null, important: row.important, completed: isCompleted(row, calendar), completedAt: isCompleted(row, calendar) ? row.completed_at ?? null : null, createdAt: row.created_at, updatedAt: row.updated_at });
const completedSql = calendar => `CASE WHEN recurrence = 'daily' THEN IF(completed = 1 AND completed_period = ${sequelize.escape(calendar.today)}, 1, 0) WHEN recurrence = 'weekly' THEN IF(completed = 1 AND completed_period = ${sequelize.escape(calendar.weekStart)}, 1, 0) ELSE completed END`;
const withUser = (userId, operation) => sequelize.transaction(async transaction => {
  if (!await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })) fail('账号不存在', 401);
  return operation(transaction);
});
exports.list = async (userId, input) => {
  const query = validateQuery(input), calendar = getCalendar(), completion = completedSql(calendar), conditions = [{ user_id: userId }];
  if (query.recurrence !== 'all') conditions.push({ recurrence: query.recurrence });
  if (query.status !== 'all') conditions.push(where(literal(completion), query.status === 'done' ? 1 : 0));
  if (query.keyword) conditions.push({ [Op.or]: [where(fn('LOCATE', query.keyword, col('title')), { [Op.gt]: 0 }), where(fn('LOCATE', query.keyword, col('notes')), { [Op.gt]: 0 })] });
  const sorting = query.sort === 'due' ? [[literal('due_date IS NULL'), 'ASC'], ['due_date', 'ASC']] : query.sort === 'important' ? [['important', 'DESC']] : [];
  const pageSize = 30;
  const [result, stats] = await Promise.all([
    UserTodo.findAndCountAll({ where: { [Op.and]: conditions }, order: [[literal(completion), 'ASC'], ...sorting, ['created_at', 'DESC'], ['id', 'DESC']], limit: pageSize, offset: (query.page - 1) * pageSize }),
    UserTodo.findAll({ attributes: ['recurrence', [fn('COUNT', col('id')), 'all'], [fn('SUM', literal(completion)), 'done']], where: { user_id: userId }, group: ['recurrence'], raw: true }),
  ]);
  const recurrenceCounts = Object.fromEntries(['all', 'none', 'daily', 'weekly'].map(key => [key, { all: 0, open: 0, done: 0 }]));
  for (const stat of stats) {
    const counts = { all: Number(stat.all), done: Number(stat.done || 0) };
    counts.open = counts.all - counts.done;
    recurrenceCounts[stat.recurrence] = counts;
    for (const key of ['all', 'done', 'open']) recurrenceCounts.all[key] += counts[key];
  }
  return { items: result.rows.map(row => publicTodo(row, calendar)), calendar, total: result.count, page: query.page, pageSize, hasMore: query.page * pageSize < result.count, counts: recurrenceCounts[query.recurrence], recurrenceCounts, clearableCount: ['all', 'none'].includes(query.recurrence) ? recurrenceCounts.none.done : 0 };
};
exports.create = async (userId, body) => {
  const values = validateInput(body, true);
  if (values.recurrence && values.recurrence !== 'none' && values.due_date) fail('每日、每周待办按周期重复，无需填写计划日期');
  return withUser(userId, async transaction => {
    if (await UserTodo.count({ where: { user_id: userId }, transaction }) >= 1000) fail('每个账号最多保存1000项待办，请先整理已完成的事项', 409);
    return publicTodo(await UserTodo.create({ user_id: userId, ...values }, { transaction }), getCalendar());
  });
};
exports.update = async (userId, value, body) => {
  const id = validateId(value), { periodKey: expectedPeriod, ...values } = validateInput(body);
  return withUser(userId, async transaction => {
    const row = await UserTodo.findOne({ where: { id, user_id: userId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) fail('待办不存在或已被删除', 404);
    const calendar = getCalendar(), recurrence = values.recurrence ?? row.recurrence;
    if (recurrence !== 'none') {
      if (values.due_date) fail('每日、每周待办按周期重复，无需填写计划日期');
      values.due_date = null;
    }
    if (recurrence !== row.recurrence) {
      if (own(values, 'completed')) fail('请先保存待办类型，再勾选完成');
      values.completed = false; values.completed_at = null; values.completed_period = null;
    } else if (own(values, 'completed')) {
      if ((recurrence !== 'none' || expectedPeriod !== undefined) && expectedPeriod !== periodKey(recurrence, calendar)) fail('待办周期已变化，请刷新后重新勾选', 409);
      values.completed_at = values.completed ? new Date() : null;
      values.completed_period = periodDate(recurrence, calendar);
    }
    return publicTodo(await row.update(values, { transaction }), calendar);
  });
};
exports.remove = async (userId, value) => {
  const id = validateId(value);
  return withUser(userId, async transaction => {
    if (!await UserTodo.destroy({ where: { id, user_id: userId }, transaction })) fail('待办不存在或已被删除', 404);
    return { id };
  });
};
exports.clearCompleted = userId => withUser(userId, async transaction => ({ removed: await UserTodo.destroy({ where: { user_id: userId, recurrence: 'none', completed: true }, transaction }) }));
exports.validateInput = validateInput;
exports.validateQuery = validateQuery;
exports.validateDate = validateDate;
