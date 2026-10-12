const { sequelize, UserTheme } = require('../models');
async function migrateThemes() {
  await sequelize.authenticate();
  await UserTheme.sync();
  console.log('主题迁移完成：user_themes 已就绪，现有用户默认使用浅色主题。');
}
if (require.main === module) migrateThemes().catch(error => {
  console.error('主题迁移失败：', error.message); process.exitCode = 1;
}).finally(() => sequelize.close());
module.exports = migrateThemes;
