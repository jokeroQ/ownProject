const { DataTypes, QueryTypes } = require('sequelize');
const { sequelize, User, Menu, MenuList, Session, BookmarkTemplate } = require('../models');
const { copyDefaults } = require('../services/defaultBookmarks');

async function migrate() {
  await sequelize.authenticate();
  await require('./permissions')();
  const qi = sequelize.getQueryInterface();
  await BookmarkTemplate.sync();
  const existingTemplate = await BookmarkTemplate.findByPk(1);
  const cara = existingTemplate ? null : await User.findOne({ where: { username: 'cara' } });
  if (!existingTemplate && !cara) throw new Error('找不到 cara 账号；请先在旧版应用中注册 cara，再执行迁移。不会自动创建密码。');
  const columns = await qi.describeTable('menus');
  if (!columns.sort_order) {
    await qi.addColumn('menus', 'sort_order', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    await sequelize.query('UPDATE menus SET sort_order = id');
  }
  if (!columns.user_id) {
    await qi.addColumn('menus', 'user_id', { type: DataTypes.INTEGER, allowNull: true });
  }
  const bookmarkColumns = await qi.describeTable('menulists');
  if (!bookmarkColumns.desc) await qi.addColumn('menulists', 'desc', { type: DataTypes.STRING, allowNull: true });
  await Session.sync();
  // DDL in MySQL auto-commits. The template and all data changes share a separate transaction.
  await sequelize.transaction(async transaction => {
    let template = await BookmarkTemplate.findByPk(1, { transaction });
    const firstMigration = !template;
    if (firstMigration) {
      if (!cara) throw new Error('首次用户数据迁移需要 cara 账号，未变更分类归属。');
      const existing = await Menu.findAll({ include: [{ model: MenuList, as: 'menuLists' }], order: [['id', 'ASC']], transaction });
      const content = existing.map(menu => ({
        title: menu.title,
        bookmarks: menu.menuLists.map(item => ({
          order: item.order, title: item.title, icon: item.icon,
          type: item.type, targetUrl: item.targetUrl, desc: item.desc,
        })),
      }));
      template = await BookmarkTemplate.create({ id: 1, content }, { transaction });
    }
    if (firstMigration) {
      await sequelize.query('UPDATE menus SET user_id = :owner WHERE user_id IS NULL', {
        replacements: { owner: cara.id }, type: QueryTypes.UPDATE, transaction,
      });
    } else {
      const orphan = await Menu.findOne({ where: { user_id: null }, attributes: ['id'], transaction });
      if (orphan) throw new Error(`用户模板已存在，但分类 ${orphan.id} 的 user_id 为 NULL；请先修复该分类归属后重试，迁移不会自动分配给管理员。`);
    }
    // Normalize the legacy display index to the real category ID without changing bookmark IDs.
    await sequelize.query('UPDATE menus SET `index` = CAST(id AS CHAR)', { transaction });
    if (firstMigration) {
      const users = await User.findAll({ transaction });
      for (const user of users) {
        if (user.id !== cara.id && !await Menu.count({ where: { user_id: user.id }, transaction })) {
          await copyDefaults(user.id, transaction);
        }
      }
    }
  });
  const currentColumns = await qi.describeTable('menus');
  if (currentColumns.user_id.allowNull) {
    await qi.changeColumn('menus', 'user_id', { type: DataTypes.INTEGER, allowNull: false });
  }
  const indexes = await qi.showIndex('menus');
  if (!indexes.some(index => index.fields.some(field => field.attribute === 'user_id'))) {
    await qi.addIndex('menus', ['user_id'], { name: 'menus_user_id' });
  }
  const constraints = await qi.getForeignKeyReferencesForTable('menus');
  if (!constraints.some(constraint => constraint.columnName === 'user_id')) {
    await qi.addConstraint('menus', { fields: ['user_id'], type: 'foreign key', name: 'menus_owner_fk',
      references: { table: 'users', field: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  }
  console.log('用户数据迁移完成：默认模板已保存；重复执行保留分类归属，不覆盖模板或重置个人数据。');
}
if (require.main === module) migrate().catch(error => {
  console.error('迁移失败：', error.message); process.exitCode = 1;
}).finally(() => sequelize.close());
module.exports = migrate;
