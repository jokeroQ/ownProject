const { UserPreference } = require('../models');
const defaults = ['火锅', '牛肉面', '饺子', '炒饭', '麻辣烫', '烤肉', '轻食沙拉', '家常菜'];
const validateOptions = values => {
  if (!Array.isArray(values) || values.length < 2 || values.length > 16 || values.some(value => typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > 12)) {
    throw Object.assign(new Error('请设置2–16个选项，每项1–12个字'), { status: 400 });
  }
  const options = values.map(value => value.trim());
  if (new Set(options).size !== options.length) throw Object.assign(new Error('选项名称不能重复'), { status: 400 });
  return options;
};
exports.validateOptions = validateOptions;
exports.get = async userId => ({ options: (await UserPreference.findOne({ where: { user_id: userId, tool: 'dinner' } }))?.content?.options || [...defaults] });
exports.save = async (userId, values) => {
  const options = validateOptions(values);
  await UserPreference.upsert({ user_id: userId, tool: 'dinner', content: { options } });
  return { options };
};
