require('../config/env');
const fs = require('node:fs');
const path = require('node:path');
const { sequelize } = require('../models');
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('用法：npm run import:series -- 爬虫输出.json');
  const filename = path.resolve(file);
  if (fs.statSync(filename).size > 10 * 1024 * 1024) throw new Error('导入文件不能超过10MB，请分批导入');
  const input = JSON.parse(fs.readFileSync(filename, 'utf8'));
  await require('../migrations/series-catalog')();
  const result = await require('../services/seriesCatalogService').importItems(Array.isArray(input) ? input : input.items);
  console.log(`已导入/更新 ${result.imported} 部作品，未删除其他作品或个人片单。`);
}
main().catch(error => { console.error('片库导入失败：', error.message); process.exitCode = 1; }).finally(() => sequelize.close());
