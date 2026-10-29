const { sequelize, UserReport, User, Menu, MenuList, BookmarkTemplate } = require('../models');
const entry = { title: '工作日报', targetUrl: '/reports', icon: '报', type: 'internal', desc: '记录每日日报和周报，按时间范围导出表格' };
const matches = value => typeof value === 'string' && value.split(/[?#]/)[0] === entry.targetUrl;
async function migrateReports() {
  await sequelize.authenticate();
  await UserReport.sync();
  const result = await sequelize.transaction(async transaction => {
    const template = await BookmarkTemplate.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!template) throw new Error('请先执行 npm run migrate:user-data');
    const content = structuredClone(template.content);
    if (!Array.isArray(content) || content.some(category => !Array.isArray(category.bookmarks))) throw new Error('默认模板格式不正确');
    if (!content.some(category => category.bookmarks.some(bookmark => matches(bookmark.targetUrl)))) {
      let category = content.find(item => item.title.startsWith('有趣功能点'));
      if (!category) { category = { title: '有趣功能点尝试', bookmarks: [] }; content.push(category); }
      category.bookmarks.push({ ...entry, order: Math.max(0, ...category.bookmarks.map(bookmark => Number(bookmark.order) || 0)) + 1 });
      await template.update({ content }, { transaction });
    }
    const users = await User.findAll({ attributes: ['id'], order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    let added = 0;
    for (const user of users) {
      const menus = await Menu.findAll({ where: { user_id: user.id }, include: [{ model: MenuList, as: 'menuLists' }], transaction });
      if (menus.some(menu => menu.menuLists.some(bookmark => matches(bookmark.targetUrl)))) continue;
      let menu = menus.find(item => item.title.startsWith('有趣功能点'));
      if (!menu) {
        menu = await Menu.create({ title: '有趣功能点尝试', user_id: user.id, sort_order: Math.max(0, ...menus.map(item => item.sort_order)) + 1, is_locked: true }, { transaction });
        await menu.update({ index: String(menu.id) }, { transaction });
      }
      await MenuList.create({ ...entry, menu_id: menu.id, order: (await MenuList.max('order', { where: { menu_id: menu.id }, transaction }) || 0) + 1, is_locked: true }, { transaction });
      added++;
    }
    return { added };
  });
  console.log(`工作日报已就绪，为 ${result.added} 个账号补充入口，保留已有报告、分类和书签。`);
  return result;
}
if (require.main === module) migrateReports().catch(error => { console.error('日报迁移失败：', error.message); process.exitCode = 1; }).finally(() => sequelize.close());
module.exports = migrateReports;
