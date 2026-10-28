const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchesRegion, regionName, regionsFromTags, regionPattern } = require('../services/seriesRegions');
const { createSeriesService, validateQuery } = require('../services/seriesService');
test('地区分组识别国内、国外、欧美和日韩，未知地区不猜测，合拍可匹配多组', () => {
  for (const region of ['中国大陆', '中国香港', '中国台湾', '中国澳门', 'China', 'CN', '台湾']) assert.equal(matchesRegion([region], '国内'), true, region);
  for (const region of ['美国', '加拿大', '英国', '法国', '德国', 'Brazil', 'US']) assert.equal(matchesRegion([region], '欧美'), true, region);
  for (const region of ['日本', '韩国']) { assert.equal(matchesRegion([region], '日韩'), true); assert.equal(matchesRegion([region], '国外'), true); assert.equal(matchesRegion([region], '欧美'), false); }
  assert.equal(matchesRegion(['泰国'], '国外'), true);
  assert.equal(matchesRegion(['澳大利亚'], '欧美'), false);
  for (const regions of [[], ['未知'], ['其他'], ['全球']]) for (const group of ['国内', '国外', '欧美', '日韩']) assert.equal(matchesRegion(regions, group), false);
  assert.equal(matchesRegion(['中国大陆', '美国'], '国内'), true);
  assert.equal(matchesRegion(['中国大陆', '美国'], '国外'), true);
  assert.equal(regionName('DE'), '德国');
  assert.deepEqual(regionsFromTags(['TV', '2026', '剧情', '日本', '国产']), ['日本', '中国大陆']);
  assert.equal(new RegExp(regionPattern('欧美')).test(JSON.stringify(['美国']).toLowerCase()), true);
  for (const region of ['国内', '国外', '欧美', '日韩']) assert.equal(validateQuery({ region }).region, region);
  assert.throws(() => validateQuery({ region: ['国内'] }), { status: 400 });
});
test('豆瓣分组按国家交错分页，不丢掉每个国家未展示的记录，并限制并发', async () => {
  const countries = ['中国大陆', '中国香港', '中国台湾']; let active = 0, maxActive = 0;
  const service = createSeriesService({ request: async url => {
    active++; maxActive = Math.max(maxActive, active);
    const params = new URL(url).searchParams, country = params.get('countries'), start = +params.get('start');
    assert.ok(countries.includes(country));
    await new Promise(resolve => setImmediate(resolve)); active--;
    return { data: Array.from({ length: 20 }, (_, index) => ({ id: String(100000 + countries.indexOf(country) * 10000 + start + index), title: country + (start + index), rate: '8.0' })) };
  } });
  const first = await service.search({ source: 'douban', region: '国内', year: 'all' });
  const second = await service.search({ source: 'douban', region: '国内', year: 'all', page: '2' });
  assert.equal(first.items.length, 20); assert.equal(second.items.length, 20);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 40);
  assert.ok(first.items.every(item => matchesRegion(item.regions, '国内')));
  assert.ok(maxActive <= 3);
  assert.equal(second.hasMore, true);
});
test('TVmaze和动漫标签按真实元数据分组，不依据平台、文字语言或TV标签推测地区', async () => {
  const service = createSeriesService({ request: async url => {
    if (url.includes('api.bgm.tv')) return { total: 4, data: [{ id: 1, name: '日本作品', tags: [{ name: '日本' }] }, { id: 2, name: '中国作品', tags: [{ name: '国产' }] }, { id: 3, name_cn: '中文译名', tags: [{ name: 'TV' }] }] };
    return ['US', 'DE', 'JP', 'CN', null].map((code, index) => ({ show: { id: index + 1, name: 'Show' + index, url: `https://www.tvmaze.com/shows/${index + 1}/show`, genres: [], webChannel: { country: code ? { code } : null }, rating: {} } }));
  } });
  const query = { keyword: 'Show', year: 'all', source: 'tvmaze' };
  assert.equal((await service.search({ ...query, region: '欧美' })).items.length, 2);
  assert.equal((await service.search({ ...query, region: '国外' })).items.length, 3);
  assert.equal((await service.search({ ...query, region: '日韩' })).items.length, 1);
  assert.equal((await service.search({ ...query, region: '国内' })).items.length, 1);
  assert.equal((await service.search({ source: 'bangumi', region: '日韩', year: 'all' })).items[0].title, '日本作品');
  assert.equal((await service.search({ source: 'bangumi', region: '国外', year: 'all' })).items.length, 1);
});
