const { User, UserFlowchart, Menu, MenuList, sequelize } = require('../models');
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const defaultDocument = () => ({ version: 1, nodes: [
  { id: 'start', type: 'start', label: '开始', x: 320, y: 100 },
  { id: 'step', type: 'process', label: '处理步骤', x: 320, y: 260 },
  { id: 'decision', type: 'decision', label: '是否满足条件？', x: 320, y: 430 },
  { id: 'end', type: 'end', label: '结束', x: 320, y: 620 },
], edges: [
  { id: 'e1', from: 'start', to: 'step', label: '' },
  { id: 'e2', from: 'step', to: 'decision', label: '' },
  { id: 'e3', from: 'decision', to: 'end', label: '是' },
] });
const validateDocument = value => {
  if (!value || value.version !== 1 || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length > 100 || value.edges.length > 200) fail('流程图格式不正确，最多100个节点、200条连线');
  const ids = new Set();
  const identifier = id => typeof id === 'string' && /^[\w-]{1,64}$/.test(id);
  const text = label => typeof label === 'string' && label.length <= 64;
  const nodes = value.nodes.map(node => {
    if (!node || !identifier(node.id) || ids.has(node.id) || !['start', 'process', 'decision', 'end'].includes(node.type) || !text(node.label) || !node.label.trim() || !Number.isFinite(node.x) || !Number.isFinite(node.y) || node.x < 90 || node.x > 1510 || node.y < 60 || node.y > 940) fail('节点名称、位置或类型不正确');
    ids.add(node.id);
    return { id: node.id, type: node.type, label: node.label, x: node.x, y: node.y };
  });
  const edgeIds = new Set(), pairs = new Set();
  const edges = value.edges.map(edge => {
    if (!edge || !identifier(edge.id) || ids.has(edge.id) || edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || !text(edge.label) || pairs.has(`${edge.from}:${edge.to}`)) fail('连线格式不正确或存在重复连线');
    edgeIds.add(edge.id); pairs.add(`${edge.from}:${edge.to}`);
    return { id: edge.id, from: edge.from, to: edge.to, label: edge.label };
  });
  return { version: 1, nodes, edges };
};
const publicChart = chart => ({ document: chart ? chart.document : defaultDocument(), revision: chart ? chart.revision : 0 });
exports.get = async userId => publicChart(await UserFlowchart.findByPk(userId));
exports.save = async (userId, body) => {
  if (!body || typeof body !== 'object') fail('流程图请求格式不正确');
  const document = validateDocument(body.document);
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) fail('无效的流程图版本');
  return sequelize.transaction(async transaction => {
    await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    let chart = await UserFlowchart.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (body.revision !== (chart?.revision || 0)) fail('流程图已在其他窗口修改，请先导出本地备份再刷新页面', 409);
    if (chart) await chart.update({ document, revision: chart.revision + 1 }, { transaction });
    else chart = await UserFlowchart.create({ user_id: userId, document, revision: 1 }, { transaction });
    return publicChart(chart);
  });
};
// Install once per account; deleting or moving this bookmark later is respected.
exports.installEntry = userId => sequelize.transaction(async transaction => {
  await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  let chart = await UserFlowchart.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  if (chart?.entry_installed) return;
  if (!chart) chart = await UserFlowchart.create({ user_id: userId, document: defaultDocument() }, { transaction });
  const existing = await MenuList.findOne({ where: { targetUrl: '/flowchart' }, include: [{ model: Menu, as: 'menu', required: true, where: { user_id: userId } }], transaction });
  if (!existing) {
    const menus = await Menu.findAll({ where: { user_id: userId }, order: [['id', 'ASC']], transaction });
    let menu = menus.find(item => item.title.startsWith('有趣功能点'));
    if (!menu) {
      menu = await Menu.create({ title: '有趣功能点', user_id: userId, is_locked: true }, { transaction });
      await menu.update({ index: String(menu.id) }, { transaction });
    }
    await menu.reload({ transaction, lock: transaction.LOCK.UPDATE });
    const last = await MenuList.findOne({ where: { menu_id: menu.id }, order: [['order', 'DESC']], transaction, lock: transaction.LOCK.UPDATE });
    await MenuList.create({ menu_id: menu.id, title: '流程图', targetUrl: '/flowchart', type: 'internal', desc: '绘制并保存自己的流程图', order: last ? last.order + 1 : 1, is_locked: true }, { transaction });
  }
  await chart.update({ entry_installed: true }, { transaction });
});
