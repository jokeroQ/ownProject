const { sequelize, UserSeries } = require('../models');
async function migrateSeriesLibrary() {
  await sequelize.authenticate();
  await UserSeries.sync();
}
if (require.main === module) migrateSeriesLibrary()
  .then(() => console.log('个人片单表已就绪，保留已有记录。'))
  .catch(error => { console.error('个人片单迁移失败：', error.message); process.exitCode = 1; })
  .finally(() => sequelize.close());
module.exports = migrateSeriesLibrary;
