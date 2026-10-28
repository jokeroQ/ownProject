const { sequelize, User, Menu, MenuList, BookmarkTemplate, UserPreference } = require('../models');
async function migrateFeatures() {
  await require('./user-data')();
  await require('./themes')();
  await UserPreference.sync();
  return sequelize.transaction(async transaction => {
    const entry = { title: '今晚吃什么', targetUrl: '/dinner', icon: '食', type: 'internal', desc: '转动晚餐轮盘，也可以自定义选项' };
    const matches = value => typeof value === 'string' && value.split(/[?#]/)[0] === entry.targetUrl;
    const template = await BookmarkTemplate.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    const content = structuredClone(template.content);
    if (!content.some(category => category.bookmarks.some(bookmark => matches(bookmark.targetUrl)))) {
      let category = content.find(item => item.title.startsWith('有趣功能点'));
      if (!category) { category = { title: '有趣功能点尝试', bookmarks: [] }; content.push(category); }
      category.bookmarks.push({ ...entry, order: Math.max(0, ...category.bookmarks.map(item => item.order || 0)) + 1 });
      await template.update({ content }, { transaction });
    }
    const users = await User.findAll({ order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    let added = 0;
    for (const user of users) {
      const menus = await Menu.findAll({ where: { user_id: user.id }, include: [{ model: MenuList, as: 'menuLists' }], transaction });
      if (menus.some(menu => menu.menuLists.some(item => matches(item.targetUrl)))) continue;
      let menu = menus.find(item => item.title.startsWith('有趣功能点'));
      if (!menu) {
        menu = await Menu.create({ user_id: user.id, title: '有趣功能点尝试', is_locked: true, sort_order: Math.max(0, ...menus.map(item => item.sort_order)) + 1 }, { transaction });
        await menu.update({ index: String(menu.id) }, { transaction });
      }
      await MenuList.create({ ...entry, menu_id: menu.id, order: (await MenuList.max('order', { where: { menu_id: menu.id }, transaction }) || 0) + 1, is_locked: true }, { transaction });
      added++;
    }
    console.log(`功能迁移完成：为 ${added} 个账号补充晚餐转盘入口，保留已有设置和分类顺序。`);
    return { added };
  });
}
if (require.main === module) migrateFeatures().catch(error => { console.error('功能迁移失败：', error.message); process.exitCode = 1; }).finally(() => sequelize.close());
module.exports = migrateFeatures;
