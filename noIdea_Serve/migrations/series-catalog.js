const { sequelize, SeriesCatalog } = require('../models');
async function migrateSeriesCatalog() { await sequelize.authenticate(); await SeriesCatalog.sync(); }
if (require.main === module) migrateSeriesCatalog()
  .then(() => console.log('自建片库已就绪，保留已有数据。'))
  .catch(error => { console.error('片库迁移失败：', error.message); process.exitCode = 1; })
  .finally(() => sequelize.close());
module.exports = migrateSeriesCatalog;
