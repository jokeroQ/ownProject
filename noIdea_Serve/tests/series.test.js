const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSeriesService, validateQuery, score, safeUrl } = require('../services/seriesService');
const now = () => new Date('2026-10-23T09:00:00Z');
const douban = { id: '12345', title: '豆瓣剧集', rate: '8.5', cover: 'https://img2.doubanio.com/a.jpg', casts: ['演员甲'] };
const anime = { id: 42, name_cn: '测试番剧', name: 'Anime', date: '2026-10-01', rating: { score: 7.8, total: 120 }, images: { common: 'https://lain.bgm.tv/a.jpg' }, tags: [{ name: '剧情' }], eps: 12 };
const show = { id: 8, name: 'Overseas', url: 'https://www.tvmaze.com/shows/8/a', premiered: '2026-09-01', rating: { average: 8.2 }, type: 'Scripted', genres: ['Drama', 'Crime'], webChannel: { country: { code: 'US' } }, image: { medium: 'https://static.tvmaze.com/a.jpg' }, summary: '<p>A &amp; B</p>', weight: 80 };
function fixtures(url, options) {
  if (url.includes('/j/new_search_subjects')) return { data: [douban, { ...douban, id: '12346', title: '未评分', rate: '' }] };
  if (url.includes('/v0/search/subjects')) return { total: 1, data: [anime] };
  if (url.includes('/schedule/web')) return [{ airdate: '2026-10-23', number: 3, season: 1, _embedded: { show } }];
  if (url.includes('/search/shows')) return [{ show }];
  if (url.includes('/subject_suggest')) return [{ id: '12345', type: 'movie', title: '关键词作品', year: '2026', img: 'https://img2.doubanio.com/a.jpg' }];
  if (url.includes('/subject_abstract')) return { r: 0, subject: { id: '12345', title: '关键词作品', rate: '8.5', release_year: '2026', is_tv: true, types: ['剧情', '犯罪'], region: '中国大陆', actors: ['演员甲'], directors: ['导演'], episodes_count: '24', duration: '15分钟' } };
  if (url.endsWith('/calendar')) return [{ items: [{ ...anime, air_date: anime.date }] }];
  throw new Error('Unexpected URL: ' + url + (options?.body || ''));
}
test('剧集参数严格校验，拒绝数组、越界、未知分类和过长关键词', () => {
  assert.equal(validateQuery({}, now()).year, 'recent');
  for (const query of [{ page: '-1' }, { page: '51' }, { page: '1.5' }, { minScore: 'NaN' }, { minScore: '11' }, { year: '2028' }, { year: '1800' }, { source: 'http://localhost' }, { kind: 'unknown' }, { genre: '不存在' }, { region: '未知' }, { keyword: 'a'.repeat(81) }, { keyword: ['a'] }]) assert.throws(() => validateQuery(query, now()), { status: 400 });
});
test('只展示有效评分，0、缺失、非法值不伪装成现有评分', () => {
  assert.equal(score('8.5'), 8.5);
  for (const value of ['', null, undefined, 0, '0.0', -1, 10.1, true, {}, 'abc']) assert.equal(score(value), null);
  assert.equal(safeUrl('javascript:alert(1)', ['doubanio.com']), '');
  assert.equal(safeUrl('https://doubanio.com.evil.test/a', ['doubanio.com']), '');
  assert.equal(safeUrl('//img2.doubanio.com/a', ['doubanio.com']), 'https://img2.doubanio.com/a');
});
test('聚合保留来源、各自评分与未评分状态，不把热度换算为分数', async () => {
  const service = createSeriesService({ request: async (...args) => fixtures(...args), clock: now });
  const result = await service.search({});
  assert.deepEqual(result.sources.map(source => source.state), ['ok', 'ok', 'ok']);
  assert.deepEqual(result.items.slice(0, 3).map(item => item.source), ['douban', 'bangumi', 'tvmaze']);
  assert.equal(result.items.find(item => item.sourceId === '12346').score, null);
  assert.equal(result.items.find(item => item.source === 'tvmaze').score, 8.2);
  assert.equal(result.items.find(item => item.source === 'tvmaze').heat, 80);
  assert.equal(result.items.find(item => item.source === 'tvmaze').summary, 'A & B');
  assert.equal(result.unavailable, false);
});
test('一个来源失败不会丢掉其他来源；全部失败明确不可用', async () => {
  const service = createSeriesService({ request: async (url, options) => { if (url.includes('api.bgm.tv')) throw new Error('private network detail'); return fixtures(url, options); }, clock: now });
  const result = await service.search({});
  assert.equal(result.sources.find(source => source.source === 'bangumi').state, 'unavailable');
  assert.ok(result.items.some(item => item.source === 'douban'));
  assert.ok(!JSON.stringify(result).includes('private network detail'));
  assert.equal((await createSeriesService({ request: async () => { throw Error('offline'); }, clock: now }).search({})).unavailable, true);
});
test('筛选映射真实来源参数，分页偏移正确，TVmaze按已知字段筛选', async () => {
  const calls = [];
  const service = createSeriesService({ request: async (url, options) => { calls.push({ url, options }); return fixtures(url, options); }, clock: now });
  const result = await service.search({ source: 'douban', kind: 'short', sort: 'rating', minScore: '8', page: '2', region: '中国大陆', genre: '悬疑', year: '2026' });
  const params = new URL(calls[0].url).searchParams;
  assert.equal(params.get('start'), '20'); assert.equal(params.get('sort'), 'S'); assert.equal(params.get('range'), '8,10');
  assert.equal(params.get('tags'), '短剧,悬疑'); assert.equal(params.get('countries'), '中国大陆'); assert.equal(params.get('year_range'), '2026,2026');
  assert.equal(result.items.length, 1);
  assert.equal((await service.search({ source: 'tvmaze', region: '日本' })).items.length, 0);
  assert.equal((await service.search({ source: 'tvmaze', minScore: '9' })).items.length, 0);
  assert.equal((await service.search({ source: 'bangumi', minScore: '9' })).items.length, 0);
  assert.equal((await service.search({ source: 'tvmaze', year: '2026', region: '美国', genre: '犯罪' })).items.length, 1);
});
test('相同并发请求合并，重复读取走缓存；上游故障可返回标注过期的旧数据', async () => {
  let clockValue = now(), calls = 0, offline = false;
  const service = createSeriesService({ request: async (url, options) => { calls++; if (offline) throw Error('offline'); await new Promise(resolve => setImmediate(resolve)); return fixtures(url, options); }, clock: () => clockValue });
  const query = { source: 'douban' };
  const [first, second] = await Promise.all([service.search(query), service.search(query)]);
  assert.equal(calls, 1); assert.deepEqual(first.items, second.items);
  await service.search(query); assert.equal(calls, 1);
  clockValue = new Date(now().getTime() + 6 * 60 * 1000); offline = true;
  const stale = await service.search(query);
  assert.equal(stale.sources[0].state, 'stale'); assert.deepEqual(stale.items, first.items);
  clockValue = new Date(now().getTime() + 61 * 60 * 1000);
  assert.equal((await service.search(query)).sources[0].state, 'unavailable');
});
test('关键词查全站联想并补充现有评分，详情缓存复用；不把AI角色当成AI制作剧', async () => {
  let abstracts = 0;
  const service = createSeriesService({ request: async (url, options) => { if (url.includes('subject_abstract')) abstracts++; return fixtures(url, options); }, clock: now });
  const result = await service.search({ source: 'douban', keyword: '关键词', kind: 'tv', year: 'all' });
  assert.equal(result.items[0].score, 8.5); assert.equal(result.items[0].year, 2026);
  await service.detail('12345'); assert.equal(abstracts, 1);
  await assert.rejects(service.detail('https://localhost'), { status: 400 });
  assert.equal((await service.search({ source: 'douban', keyword: 'AI', kind: 'ai', year: 'all' })).items.length, 0);
});
test('最新动漫用放送日历，不把收藏热度冒充日期排序；不支持的来源条件明确说明', async () => {
  const service = createSeriesService({ request: async (...args) => fixtures(...args), clock: now });
  const latest = await service.search({ source: 'bangumi', kind: 'anime', sort: 'latest' });
  assert.equal(latest.items[0].date, '2026-10-01');
  assert.match(latest.sources[0].message, /日历/);
  const unsupported = await service.search({ source: 'bilibili', year: '2026' });
  assert.equal(unsupported.sources[0].state, 'unsupported'); assert.equal(unsupported.items.length, 0);
});
