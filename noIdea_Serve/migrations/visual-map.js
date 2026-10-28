const { sequelize, User, Menu, MenuList, BookmarkTemplate } = require('../models');

const legacyDescription = '浏览地图、定位与查看坐标';
const entry = { title: '可视化地图', targetUrl: '/map', icon: '可', type: 'internal', desc: '查看中国省级地图与区域信息' };
const isMapEntry = value => typeof value === 'string' && value.split(/[?#]/)[0] === '/map';

async function migrateVisualMap() {
  await sequelize.authenticate();
  const result = await sequelize.transaction(async transaction => {
    const template = await BookmarkTemplate.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!template) throw new Error('请先执行 npm run migrate:user-data 初始化默认模板');
    const content = structuredClone(template.content);
    if (!Array.isArray(content) || content.some(category => !category || !Array.isArray(category.bookmarks)))
      throw new Error('默认书签模板格式不正确，未写入地图入口');
    let templateAdded = false;
    let templateUpdated = false;
    for (const category of content) for (const bookmark of category.bookmarks) {
      if (isMapEntry(bookmark.targetUrl) && bookmark.desc === legacyDescription) {
        bookmark.desc = entry.desc;
        templateUpdated = true;
      }
    }
    if (!content.some(category => category.bookmarks.some(bookmark => isMapEntry(bookmark.targetUrl)))) {
      let category = content.find(item => item.title?.startsWith('有趣功能点'));
      if (!category) { category = { title: '有趣功能点尝试', bookmarks: [] }; content.push(category); }
      const lastOrder = Math.max(0, ...category.bookmarks.map(bookmark => Number(bookmark.order) || 0));
      category.bookmarks.push({ ...entry, order: lastOrder + 1 });
      templateAdded = true;
    }
    if (templateAdded || templateUpdated) await template.update({ content }, { transaction });
    let added = 0;
    const users = await User.findAll({ attributes: ['id'], order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    for (const user of users) {
      const menus = await Menu.findAll({ where: { user_id: user.id }, include: [{ model: MenuList, as: 'menuLists' }],
        order: [['id', 'ASC']], transaction });
      const existing = menus.flatMap(menu => menu.menuLists).filter(bookmark => isMapEntry(bookmark.targetUrl));
      if (existing.length) {
        for (const bookmark of existing) if (bookmark.desc === legacyDescription)
          await bookmark.update({ desc: entry.desc }, { transaction });
        continue;
      }
      let menu = menus.find(item => item.title.startsWith('有趣功能点'));
      if (!menu) {
        menu = await Menu.create({ title: '有趣功能点尝试', user_id: user.id, is_locked: true, sort_order: Math.max(0, ...menus.map(item => item.sort_order)) + 1 }, { transaction });
        await menu.update({ index: String(menu.id) }, { transaction });
      }
      const last = await MenuList.findOne({ where: { menu_id: menu.id }, order: [['order', 'DESC']], transaction });
      await MenuList.create({ ...entry, menu_id: menu.id, order: last ? last.order + 1 : 1, is_locked: true }, { transaction });
      added++;
    }
    return { added, templateAdded };
  });
  console.log(`可视化地图入口已就绪：为 ${result.added} 个现有账号补充入口；新账号使用更新后的默认模板。`);
  return result;
}

if (require.main === module) migrateVisualMap().catch(error => {
  console.error('地图入口初始化失败：', error.message); process.exitCode = 1;
}).finally(() => sequelize.close());
module.exports = migrateVisualMap;
