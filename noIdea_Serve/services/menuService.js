const { Menu, MenuList, sequelize } = require('../models');
const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const id = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) fail('无效的记录 ID'); return n; };
const title = value => { if (typeof value !== 'string' || !value.trim() || value.length > 255) fail('名称不能为空且不能超过255字符'); return value.trim(); };
const ownedMenu = async (menuId, userId, transaction, lock = false) => {
  const menu = await Menu.findOne({ where: { id: id(menuId), user_id: userId }, transaction,
    ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!menu) fail('分类不存在', 404);
  return menu;
};
const ownedBookmark = async (bookmarkId, userId, transaction) => {
  const bookmark = await MenuList.findOne({ where: { id: id(bookmarkId) },
    include: [{ model: Menu, as: 'menu', required: true, where: { user_id: userId } }], transaction });
  if (!bookmark) fail('书签不存在', 404);
  return bookmark;
};
const bookmarkData = data => {
  const result = { title: title(data.title) };
  for (const field of ['targetUrl', 'icon', 'type', 'desc']) {
    if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > 255)) fail('书签字段格式不正确');
    result[field] = data[field] || '';
  }
  if (!result.targetUrl.trim()) fail('目标地址不能为空');
  if (result.targetUrl.startsWith('//') || (!result.targetUrl.startsWith('/') && !/^https?:\/\//i.test(result.targetUrl))) fail('目标地址需为站内路径或 http(s) 网址');
  // Route links are identified by their destination, not the numeric parent category ID.
  result.type = result.targetUrl.startsWith('/') ? 'internal' : 'external';
  return result;
};
exports.getAllMenuItems = userId => Menu.findAll({
  where: { user_id: userId }, include: [{ model: MenuList, as: 'menuLists' }],
  order: [['id', 'ASC'], [{ model: MenuList, as: 'menuLists' }, 'order', 'ASC']],
});
exports.createMenuItem = (value, userId) => sequelize.transaction(async transaction => {
  const menu = await Menu.create({ title: title(value), user_id: userId }, { transaction });
  await menu.update({ index: String(menu.id) }, { transaction });
  return menu;
});
exports.deleteMenuItem = (menuId, userId) => sequelize.transaction(async transaction => {
  const menu = await ownedMenu(menuId, userId, transaction, true);
  // Delete children explicitly: the legacy SQL has RESTRICT as well as CASCADE constraints.
  await MenuList.destroy({ where: { menu_id: menu.id }, transaction });
  await menu.destroy({ transaction });
});
exports.updateMenuItem = (menuId, value, userId) => sequelize.transaction(async transaction => {
  const menu = await ownedMenu(menuId, userId, transaction, true);
  return menu.update({ title: title(value) }, { transaction });
});
exports.getSubMenus = async (menuId, userId) => {
  await ownedMenu(menuId, userId);
  return MenuList.findAll({ where: { menu_id: id(menuId) }, order: [['order', 'ASC']] });
};
exports.createSubMenu = (menuId, data, userId) => sequelize.transaction(async transaction => {
  const values = bookmarkData(data);
  const menu = await ownedMenu(menuId, userId, transaction, true);
  const max = await MenuList.max('order', { where: { menu_id: menu.id }, transaction });
  return MenuList.create({ ...values, menu_id: menu.id, order: max == null ? 1 : max + 1 }, { transaction });
});
exports.deleteSubMenu = (bookmarkId, userId) => sequelize.transaction(async transaction => {
  const bookmark = await ownedBookmark(bookmarkId, userId, transaction);
  await ownedMenu(bookmark.menu_id, userId, transaction, true);
  await bookmark.destroy({ transaction });
});
exports.updateSubMenu = (bookmarkId, data, userId) => sequelize.transaction(async transaction => {
  const bookmark = await ownedBookmark(bookmarkId, userId, transaction);
  await ownedMenu(bookmark.menu_id, userId, transaction, true);
  return bookmark.update(bookmarkData(data), { transaction });
});
exports.swapOrder = (firstId, secondId, userId) => sequelize.transaction(async transaction => {
  const first = await ownedBookmark(firstId, userId, transaction);
  const second = await ownedBookmark(secondId, userId, transaction);
  if (first.menu_id !== second.menu_id) fail('只能在同一分类中排序');
  await ownedMenu(first.menu_id, userId, transaction, true);
  // Re-read after locking the parent so concurrent swaps cannot use stale orders.
  await first.reload({ transaction }); await second.reload({ transaction });
  const order = first.order;
  await first.update({ order: second.order }, { transaction });
  await second.update({ order }, { transaction });
});
