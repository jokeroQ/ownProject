const { Op, fn, col, where } = require('sequelize');
const { User, UserReport, sequelize } = require('../models');
const { validateFormat, toCsv, buildExport } = require('./reportExports');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') fail('日期应在1900–2100年之间');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('日期不存在');
  return value;
}
function period(type, value) {
  const date = new Date(validateDate(value) + 'T00:00:00Z');
  if (!['daily', 'weekly'].includes(type)) fail('报告类型不正确');
  if (type === 'weekly') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const start = date.toISOString().slice(0, 10);
  if (type === 'weekly') date.setUTCDate(date.getUTCDate() + 6);
  return { period_start: start, period_end: date.toISOString().slice(0, 10) };
}
function validateInput(body) {
  const fields = ['type', 'date', 'accomplishments', 'plans', 'blockers'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) fail('报告信息格式不正确');
  const values = { type: body.type, ...period(body.type, body.date) };
  for (const field of ['accomplishments', 'plans', 'blockers']) {
    const text = body[field] ?? '';
    if (typeof text !== 'string' || text.length > 10000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail('每项内容最多10000个字符，不能含控制字符');
    values[field] = text.trim();
  }
  if (!values.accomplishments) fail('请填写完成工作');
  return values;
}
function validateQuery(input = {}) {
  const scalar = (key, fallback) => {
    if (input[key] === undefined) return fallback;
    if (typeof input[key] !== 'string') fail('报告筛选格式不正确');
    return input[key].trim();
  };
  const query = { type: scalar('type', 'all'), from: scalar('from', ''), to: scalar('to', ''), keyword: scalar('keyword', ''), page: scalar('page', '1') };
  if (!['all', 'daily', 'weekly'].includes(query.type) || query.keyword.length > 120 || !/^[1-9]\d{0,3}$/.test(query.page) || +query.page > 1000) fail('报告筛选或页码不正确');
  if (query.from) validateDate(query.from);
  if (query.to) validateDate(query.to);
  if (query.from && query.to && query.from > query.to) fail('开始日期不能晚于结束日期');
  return { ...query, page: Number(query.page) };
}
function conditions(userId, query) {
  const rules = [{ user_id: userId }];
  if (query.type !== 'all') rules.push({ type: query.type });
  // Include a weekly report whenever its Monday–Sunday interval overlaps the selected range.
  if (query.from) rules.push({ period_end: { [Op.gte]: query.from } });
  if (query.to) rules.push({ period_start: { [Op.lte]: query.to } });
  if (query.keyword) rules.push({ [Op.or]: ['accomplishments', 'plans', 'blockers'].map(field => where(fn('LOCATE', query.keyword, col(field)), { [Op.gt]: 0 })) });
  return { [Op.and]: rules };
}
const publicReport = row => ({ id: row.id, type: row.type, startDate: row.period_start, endDate: row.period_end, accomplishments: row.accomplishments, plans: row.plans, blockers: row.blockers, createdAt: row.created_at, updatedAt: row.updated_at });
const order = [['period_start', 'DESC'], ['id', 'DESC']];
exports.list = async (userId, input) => {
  const query = validateQuery(input), pageSize = 20;
  const result = await UserReport.findAndCountAll({ where: conditions(userId, query), order, limit: pageSize, offset: (query.page - 1) * pageSize });
  return { items: result.rows.map(publicReport), total: result.count, page: query.page, pageSize, hasMore: query.page * pageSize < result.count };
};
const withUser = (userId, operation) => sequelize.transaction(async transaction => {
  if (!await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })) fail('账号不存在', 401);
  try { return await operation(transaction); }
  catch (error) { if (error.name === 'SequelizeUniqueConstraintError') fail('这个日期已有同类型报告，请编辑已有记录', 409); throw error; }
});
exports.create = async (userId, body) => {
  const values = validateInput(body);
  return withUser(userId, async transaction => {
    if (await UserReport.count({ where: { user_id: userId }, transaction }) >= 10000) fail('每个账号最多保存10000篇报告，请先整理旧记录', 409);
    return publicReport(await UserReport.create({ user_id: userId, ...values }, { transaction }));
  });
};
function validateId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d{0,9}$/.test(String(value)) || +value > 2147483647) fail('报告标识不正确');
  return Number(value);
}
exports.update = async (userId, value, body) => {
  const id = validateId(value), values = validateInput(body);
  return withUser(userId, async transaction => {
    const row = await UserReport.findOne({ where: { id, user_id: userId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) fail('报告不存在或已被删除', 404);
    return publicReport(await row.update(values, { transaction }));
  });
};
exports.remove = async (userId, value) => {
  const id = validateId(value);
  if (!await UserReport.destroy({ where: { id, user_id: userId } })) fail('报告不存在或已被删除', 404);
  return { id };
};
exports.exportReports = async (userId, input) => {
  const query = validateQuery(input), format = validateFormat(input?.format);
  if (!query.from || !query.to) fail('导出时请选择开始和结束日期');
  const rows = await sequelize.transaction(async transaction => {
    const header = toCsv([]), items = [];
    let offset = 0, bytes = Buffer.byteLength(header);
    while (offset < 10000) {
      const rows = await UserReport.findAll({ where: conditions(userId, query), order, limit: 100, offset, transaction });
      if (!rows.length) break;
      const chunk = toCsv(rows).slice(header.length);
      bytes += Buffer.byteLength(chunk);
      if (bytes > 16 * 1024 * 1024) fail('导出内容超过16MB，请缩小日期范围后重试');
      if (format === 'docx' && items.length + rows.length > 500) fail('Word 单次最多导出500篇报告，请缩小日期范围或使用 Excel');
      items.push(...rows.map(row => row.get({ plain: true }))); offset += rows.length;
    }
    if (!offset) fail('所选范围内没有可导出的报告', 404);
    return items;
  });
  // Release the database snapshot before generating the binary file.
  return buildExport(rows, query, format);
};
Object.assign(exports, { validateDate, validateInput, validateQuery, period, toCsv });
