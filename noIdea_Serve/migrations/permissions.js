const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');
async function migratePermissions() {
  await sequelize.authenticate();
  // Raw queries also work before the role column exists in the upgraded User model.
  const [users] = await sequelize.query('SELECT id, username FROM users');
  const cara = users.find(user => user.username === 'cara');
  if (!cara) throw new Error('找不到 cara 账号，未修改权限结构。请先完成用户数据迁移。');
  const qi = sequelize.getQueryInterface();
  const columns = await qi.describeTable('users');
  if (!columns.role) await qi.addColumn('users', 'role', { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'user' });
  for (const table of ['menus', 'menulists']) {
    const fields = await qi.describeTable(table);
    if (!fields.is_locked) {
      // A default of true freezes existing rows atomically with the DDL. Future
      // user-created rows explicitly use the model's false default.
      await qi.addColumn(table, 'is_locked', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    }
    const current = await qi.describeTable(table);
    if (current.is_locked.defaultValue === true || current.is_locked.defaultValue === 1 || current.is_locked.defaultValue === '1') {
      await qi.changeColumn(table, 'is_locked', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    }
  }
  await sequelize.query("UPDATE users SET role = 'admin' WHERE id = :id", { replacements: { id: cara.id } });
  console.log('权限迁移完成：cara 为管理员，已有菜单只读，之后本人新增项可编辑。重复执行不会锁定新增项。');
}
if (require.main === module) migratePermissions().catch(error => {
  console.error('权限迁移失败：', error.message); process.exitCode = 1;
}).finally(() => sequelize.close());
module.exports = migratePermissions;
