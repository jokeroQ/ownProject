const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');
async function migratePermissions() {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();
  const columns = await qi.describeTable('users');
  if (!columns.role) {
    // Only the initial legacy migration bootstraps cara. Later runs preserve
    // administrator changes, including renaming or demoting that account.
    const [users] = await sequelize.query('SELECT id, username FROM users');
    const cara = users.find(user => user.username === 'cara');
    if (!cara) throw new Error('找不到 cara 账号，未修改权限结构。请先完成用户数据迁移。');
    await qi.addColumn('users', 'role', { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'user' });
    await sequelize.query("UPDATE users SET role = 'admin' WHERE id = :id", { replacements: { id: cara.id } });
  } else {
    // A crash after adding role but before its initial grant must not look like
    // a successful migration. Never infer who should regain administrator access.
    const [counts] = await sequelize.query("SELECT COUNT(*) AS admin_count FROM users WHERE role = 'admin'");
    if (Number(counts[0].admin_count) === 0) {
      throw new Error('users.role 已存在但没有管理员，可能是首次权限迁移中断。请先在数据库核实用户身份并手动恢复一位管理员，再重跑迁移；不会自动提升 cara 或其他账号。');
    }
  }
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
  console.log('权限迁移完成：首次迁移初始化管理员；重复执行保留当前用户角色和新增项权限。');
}
if (require.main === module) migratePermissions().catch(error => {
  console.error('权限迁移失败：', error.message); process.exitCode = 1;
}).finally(() => sequelize.close());
module.exports = migratePermissions;
