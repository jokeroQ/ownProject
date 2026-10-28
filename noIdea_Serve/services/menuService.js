const { User, Menu, MenuList, sequelize } = require('../models');
const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const id = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) fail('无效的记录 ID'); return n; };
const title = value => { if (typeof value !== 'string' || !value.trim() || value.length > 255) fail('名称不能为空且不能超过255字符'); return value.trim(); };
const isAdmin = async (userId, transaction) => (await User.findByPk(userId, { transaction }))?.role === 'admin';
const editable = async (record, userId, transaction) => {
  if (record.is_locked && !await isAdmin(userId, transaction)) fail('该菜单为只读项，只能编辑自己新增的菜单', 403);
};
const publicBookmark = (bookmark, admin) => ({ ...bookmark.toJSON(), can_edit: admin || !bookmark.is_locked });
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
const recordIds = values => {
  if (!Array.isArray(values) || !values.length || values.length > 500) fail('请选择1–500个项目');
  const ids = values.map(id);
  if (new Set(ids).size !== ids.length) fail('项目不能重复');
  return ids;
};
// Lock every owned parent in a stable order; batch writes remain atomic with single-item moves.
exports.batchSubMenus = (data, userId) => sequelize.transaction({ isolationLevel: 'READ COMMITTED' }, async transaction => {
  const ids = recordIds(data.ids);
  if (!['move', 'delete'].includes(data.action)) fail('不支持的批量操作');
  const parents = await Menu.findAll({ where: { user_id: userId }, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  const rows = await MenuList.findAll({ where: { id: ids, menu_id: parents.map(menu => menu.id) }, order: [['menu_id', 'ASC'], ['order', 'ASC'], ['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  if (rows.length !== ids.length) fail('部分书签不存在，请刷新后重试', 404);
  for (const row of rows) await editable(row, userId, transaction);
  const displayOrder = new Map([...parents].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).map((menu, index) => [menu.id, index]));
  rows.sort((a, b) => displayOrder.get(a.menu_id) - displayOrder.get(b.menu_id) || a.order - b.order || a.id - b.id);
  if (data.action === 'delete') {
    await MenuList.destroy({ where: { id: ids }, transaction });
  } else {
    const target = id(data.menuId);
    if (!parents.some(menu => menu.id === target)) fail('目标分类不存在', 404);
    const targetRows = await MenuList.findAll({ where: { menu_id: target }, order: [['order', 'ASC'], ['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    const before = data.beforeId == null ? null : id(data.beforeId);
    if (before !== null && !targetRows.some(row => row.id === before)) fail('目标书签不存在', 404);
    if (ids.includes(before)) return { count: 0 };
    const sourceIds = [...new Set(rows.map(row => row.menu_id))].filter(source => source !== target);
    const reordered = targetRows.filter(row => !ids.includes(row.id));
    const position = before === null ? reordered.length : reordered.findIndex(row => row.id === before);
    reordered.splice(position, 0, ...rows);
    for (const [index, row] of reordered.entries()) await row.update({ menu_id: target, order: index + 1 }, { transaction });
    for (const source of sourceIds) {
      const remaining = await MenuList.findAll({ where: { menu_id: source }, order: [['order', 'ASC'], ['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
      for (const [index, row] of remaining.entries()) await row.update({ order: index + 1 }, { transaction });
    }
  }
  return { count: rows.length };
});
exports.reorderMenus = (values, userId) => sequelize.transaction(async transaction => {
  const ids = recordIds(values);
  await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  const menus = await Menu.findAll({ where: { user_id: userId }, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  if (ids.length !== menus.length || menus.some(menu => !ids.includes(menu.id))) fail('分类已变化，请刷新后重新排序', 409);
  for (const menu of menus) await menu.update({ sort_order: ids.indexOf(menu.id) + 1 }, { transaction });
});
exports.getAllMenuItems = async userId => {
  const admin = await isAdmin(userId);
  const menus = await Menu.findAll({
  where: { user_id: userId }, include: [{ model: MenuList, as: 'menuLists' }],
  order: [['sort_order', 'ASC'], ['id', 'ASC'], [{ model: MenuList, as: 'menuLists' }, 'order', 'ASC']],
  });
  return menus.map(menu => ({ ...menu.toJSON(), can_edit: admin || !menu.is_locked,
    can_delete: admin || (!menu.is_locked && !menu.menuLists.some(item => item.is_locked)),
    menuLists: menu.menuLists.map(item => publicBookmark(item, admin)) }));
};
exports.createMenuItem = (value, userId) => sequelize.transaction(async transaction => {
  await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  const last = await Menu.max('sort_order', { where: { user_id: userId }, transaction });
  const menu = await Menu.create({ title: title(value), user_id: userId, sort_order: (last || 0) + 1 }, { transaction });
  await menu.update({ index: String(menu.id) }, { transaction });
  return menu;
});
exports.deleteMenuItem = (menuId, userId) => sequelize.transaction(async transaction => {
  const menu = await ownedMenu(menuId, userId, transaction, true);
  await editable(menu, userId, transaction);
  if (!await isAdmin(userId, transaction) && await MenuList.count({ where: { menu_id: menu.id, is_locked: true }, transaction })) fail('分类包含只读书签，不能删除', 403);
  // Delete children explicitly: the legacy SQL has RESTRICT as well as CASCADE constraints.
  await MenuList.destroy({ where: { menu_id: menu.id }, transaction });
  await menu.destroy({ transaction });
});
exports.updateMenuItem = (menuId, value, userId) => sequelize.transaction(async transaction => {
  const menu = await ownedMenu(menuId, userId, transaction, true);
  await editable(menu, userId, transaction);
  return menu.update({ title: title(value) }, { transaction });
});
exports.getSubMenus = async (menuId, userId) => {
  await ownedMenu(menuId, userId);
  const admin = await isAdmin(userId);
  return (await MenuList.findAll({ where: { menu_id: id(menuId) }, order: [['order', 'ASC']] })).map(item => publicBookmark(item, admin));
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
  await editable(bookmark, userId, transaction);
  await bookmark.destroy({ transaction });
});
exports.updateSubMenu = (bookmarkId, data, userId) => sequelize.transaction(async transaction => {
  const bookmark = await ownedBookmark(bookmarkId, userId, transaction);
  await ownedMenu(bookmark.menu_id, userId, transaction, true);
  await editable(bookmark, userId, transaction);
  return bookmark.update(bookmarkData(data), { transaction });
});
exports.swapOrder = (firstId, secondId, userId) => sequelize.transaction(async transaction => {
  const first = await ownedBookmark(firstId, userId, transaction);
  const second = await ownedBookmark(secondId, userId, transaction);
  if (first.menu_id !== second.menu_id) fail('只能在同一分类中排序');
  await ownedMenu(first.menu_id, userId, transaction, true);
  await editable(first, userId, transaction);
  await editable(second, userId, transaction);
  // Re-read after locking the parent so concurrent swaps cannot use stale orders.
  await first.reload({ transaction }); await second.reload({ transaction });
  const order = first.order;
  await first.update({ order: second.order }, { transaction });
  await second.update({ order }, { transaction });
});

// Lock parents in ID order, then re-read: all ordering writes share these locks.
exports.moveSubMenu = (bookmarkId, menuId, beforeId, userId) => sequelize.transaction({ isolationLevel: 'READ COMMITTED' }, async transaction => {
  const bookmark = await ownedBookmark(bookmarkId, userId, transaction);
  const sourceId = bookmark.menu_id;
  const targetId = id(menuId);
  for (const parentId of [...new Set([sourceId, targetId])].sort((a, b) => a - b)) {
    await ownedMenu(parentId, userId, transaction, true);
  }
  await bookmark.reload({ transaction, lock: transaction.LOCK.UPDATE, include: [] });
  await editable(bookmark, userId, transaction);
  if (bookmark.menu_id !== sourceId) fail('书签已被移动，请刷新后重试', 409);
  const target = await MenuList.findAll({ where: { menu_id: targetId }, order: [['order', 'ASC'], ['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  const before = beforeId == null ? null : id(beforeId);
  if (before !== null && !target.some(item => item.id === before)) fail('目标书签不存在', 404);
  if (before === bookmark.id) return;
  const reordered = target.filter(item => item.id !== bookmark.id);
  const position = before === null ? reordered.length : reordered.findIndex(item => item.id === before);
  reordered.splice(position, 0, bookmark);
  for (let i = 0; i < reordered.length; i++) {
    await reordered[i].update({ menu_id: targetId, order: i + 1 }, { transaction });
  }
  if (sourceId !== targetId) {
    const source = await MenuList.findAll({ where: { menu_id: sourceId }, order: [['order', 'ASC'], ['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    for (let i = 0; i < source.length; i++) await source[i].update({ order: i + 1 }, { transaction });
  }
});
