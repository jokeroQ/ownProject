const { sequelize, UserFlowchart } = require('../models');
async function migrateFlowcharts() {
  await sequelize.authenticate();
  await UserFlowchart.sync();
  console.log('流程图迁移完成：user_flowcharts 已就绪。');
}
if (require.main === module) migrateFlowcharts().catch(error => {
  console.error('流程图迁移失败：', error.message); process.exitCode = 1;
}).finally(() => sequelize.close());
module.exports = migrateFlowcharts;
