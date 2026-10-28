require('../config/env');
const { sequelize } = require('../models');
const { PLATFORMS } = require('../services/seriesPlatforms');
const { collect, message } = require('../services/seriesCollector');
async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(value => { const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
  const sources = (args.sources || 'douban,bangumi,tvmaze,tencent,youku,mango,iqiyi,netflix').split(',');
  const pages = Number(args.pages || 1), startPage = Number(args.startPage || 0);
  if (sources.some(source => !Object.hasOwn(PLATFORMS, source)) || !Number.isSafeInteger(pages) || pages < 1 || pages > 10 || !Number.isSafeInteger(startPage) || startPage < 0 || startPage > 10000) throw new Error('请使用已知来源、1–10页，以及有效startPage');
  await require('../migrations/series-catalog')();
  let failed = 0, imported = 0;
  for (const source of sources) {
    try {
      const items = await collect(source, { pages, startPage });
      if (!items.length) { console.log(`${PLATFORMS[source].label}：无可入库数据`); continue; }
      const result = await require('../services/seriesCatalogService').importItems(items);
      imported += result.imported;
      console.log(`${PLATFORMS[source].label}：已采集并入库 ${result.imported} 部`);
    } catch (error) { failed++; console.log(`${PLATFORMS[source].label}：未完成，${message(error)}`); }
  }
  const status = await require('../services/seriesCatalogService').status();
  console.log(`本次写入/更新 ${imported} 部；当前片库 ${status.total} 部；${failed} 个来源未完成。采集仅覆盖公开入口/所选页，不代表全平台或全量。`);
  if (failed) process.exitCode = 2;
}
main().catch(error => { console.error('采集失败：', error.message); process.exitCode = 1; }).finally(() => sequelize.close());
