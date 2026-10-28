const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({ page, api, artifacts }) => {
  await require('../migrations/series')();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const request = async route => {
    const response = await fetch(api + route, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200, route);
    return (await response.json()).data;
  };
  const sample = (index, region) => ({ id: `tencent:region_${index}`, source: 'tencent', sourceId: `region_${index}`, title: `地区测试${index}`, url: `https://v.qq.com/x/cover/region_${index}.html`, poster: '', kind: 'tv', regions: region ? [region] : [], year: 2026, score: null, rank: index + 1 });
  const items = [...Array.from({ length: 25 }, (_, index) => sample(index, '中国大陆')), sample(25, '日本'), sample(26, '韩国'), sample(27, '法国'), sample(28, '泰国'), sample(29, '中国台湾'), sample(30, null)];
  await require('../services/seriesCatalogService').importItems(items);
  for (const [region, count] of [['国内', 26], ['国外', 4], ['欧美', 1], ['日韩', 2]]) {
    const data = await request('/series?source=catalog&year=all&region=' + encodeURIComponent(region));
    assert.equal(data.items.length, Math.min(20, count), region);
    assert.ok(data.items.every(item => require('../services/seriesRegions').matchesRegion(item.regions, region)));
  }
  const page1 = await request('/series?source=catalog&year=all&region=' + encodeURIComponent('国内'));
  const page2 = await request('/series?source=catalog&year=all&region=' + encodeURIComponent('国内') + '&page=2');
  assert.equal(page1.hasMore, true); assert.equal(page2.items.length, 6);
  assert.equal(new Set([...page1.items, ...page2.items].map(item => item.id)).size, 26);
  console.log('PASS: 地区分组在数据库分页前筛选，国外排除未知与国内、欧美/日韩准确分类');
  for (const item of [items[0], items[25], items[27], items[30]]) {
    const response = await fetch(api + '/series/library/' + encodeURIComponent(item.id), { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ item, favorite: true }) });
    assert.equal(response.status, 200);
  }
  for (const [region, count] of [['国内', 1], ['国外', 2], ['欧美', 1], ['日韩', 1]]) {
    assert.equal((await request('/series/library?region=' + encodeURIComponent(region))).total, count);
  }
  const origin = new URL(page.url()).origin;
  await page.goto(origin + '/series?source=catalog&year=all');
  const settle = async () => page.waitForFunction(() => document.querySelector('.series-results')?.getAttribute('aria-busy') === 'false');
  await page.locator('.series-card').first().waitFor();
  async function select(label, option) {
    await (label === '制作地区' ? page.locator('.filter-field').nth(2) : page.locator('.library-region')).locator('.el-select__wrapper').click();
    await page.getByRole('option', { name: option, exact: true }).click();
    await settle();
  }
  await select('制作地区', '欧美');
  assert.equal(await page.locator('.series-card').count(), 1);
  assert.ok(await page.locator('[data-series-id="tencent:region_27"]').isVisible());
  await page.reload();
  await page.locator('[data-series-id="tencent:region_27"]').waitFor();
  await select('制作地区', '日韩');
  assert.equal(await page.locator('.series-card').count(), 2);
  await select('制作地区', '国内（全部）');
  assert.equal(await page.locator('.series-card').count(), 20);
  await page.locator('.page-tabs').getByRole('button', { name: /我的片单/ }).click();
  await settle();
  await select('片单地区', '国外（全部）');
  assert.equal(await page.locator('.series-card').count(), 2);
  await select('片单地区', '日韩');
  assert.equal(await page.locator('.series-card').count(), 1);
  await page.reload();
  await page.locator('[data-series-id="tencent:region_25"]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('libraryRegion'), '日韩');
  for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.library-controls, .library-region, .library-search')].every(node => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1; })), `Region filter fits ${width}`);
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `regions-library-${width}.png`) }); }
  }
  await page.locator('.page-tabs').getByRole('button', { name: '发现剧集', exact: true }).click();
  await settle();
  await page.locator('.filter-field').nth(2).locator('.el-select__wrapper').click();
  await page.getByRole('option', { name: '国内（全部）', exact: true }).waitFor({ state: 'visible' });
  await page.locator('.el-select__popper:visible').evaluate(async node => { await Promise.allSettled(node.getAnimations({ subtree: true }).map(animation => animation.finished)); });
  assert.ok(await page.getByRole('option', { name: '国内（全部）', exact: true }).isVisible());
  assert.ok(await page.getByRole('option', { name: '国外（全部）', exact: true }).isVisible());
  assert.ok(await page.getByRole('option', { name: '欧美', exact: true }).isVisible());
  assert.ok(await page.getByRole('option', { name: '日韩', exact: true }).isVisible());
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'regions-options-mobile.png') });
  assert.deepEqual(errors, []);
  console.log('PASS: 发现和个人片单地区下拉分组、切换/刷新持久化及桌面/手机适配');
};
