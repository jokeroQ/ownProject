const { BookmarkTemplate, Menu, MenuList } = require('../models');
exports.copyDefaults = async (userId, transaction) => {
  const template = await BookmarkTemplate.findByPk(1, { transaction });
  if (!template) throw new Error('默认模板未初始化，请先执行数据库迁移');
  for (const item of template.content) {
    const menu = await Menu.create({ title: item.title, user_id: userId }, { transaction });
    await menu.update({ index: String(menu.id) }, { transaction });
    for (const bookmark of item.bookmarks) {
      await MenuList.create({ ...bookmark, menu_id: menu.id }, { transaction });
    }
  }
};
