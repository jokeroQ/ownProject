const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePatch, validateItem } = require('../services/seriesLibraryService');
const { normalize } = require('../services/seriesCatalogService');
const { extractHtml, parseNetflixTsv, robotsAllowed, mapTvmaze } = require('../services/seriesCollector');
const item = { id: 'douban:12345', source: 'douban', sourceId: '12345', title: '测试作品', url: 'https://movie.douban.com/subject/12345/', poster: 'https://img2.doubanio.com/view/photo/s_ratio_poster/public/p1234567.jpg', score: 8.5 };

test('片单验证拒绝身份注入、未知状态、非法标识及不匹配的来源', () => {
  const patch = validatePatch(item.id, { favorite: true, watchStatus: 'want', item });
  assert.equal(patch.item.ratingState, 'rated');
  assert.equal(patch.item.sourceLabel, '豆瓣');
  for (const body of [null, [], {}, { favorite: 'true' }, { watchStatus: 'watched' }, { favorite: true, userId: 2 }, { favorite: true, item: { ...item, id: 'douban:54321' } }, { favorite: true, item: { ...item, url: 'javascript:alert(1)' } }, { favorite: true, item: { ...item, url: 'https://movie.douban.com.evil.test/' } }]) assert.throws(() => validatePatch(item.id, body), { status: 400 });
  for (const id of ['douban:../1', 'other:123', ['douban:1'], 'constructor:a']) assert.throws(() => validatePatch(id, { favorite: true }), { status: 400 });
  assert.equal(validateItem({ ...item, score: 0 }).score, null);
  assert.equal(validateItem({ ...item, poster: 'http://localhost/a.png' }).poster, '');
});
test('新平台沿用稳定平台标识，片库不接受缺少分类或未来采集时间的数据', () => {
  const record = { ...item, source: 'tencent', sourceId: 'abc123', id: 'tencent:abc123', url: 'https://v.qq.com/x/cover/abc123.html', kind: 'tv' };
  const now = new Date('2026-10-28T00:00:00Z');
  assert.equal(normalize(record, 0, now).source, 'tencent');
  assert.throws(() => normalize({ ...record, kind: undefined }, 0, now), { status: 400 });
  assert.throws(() => normalize({ ...record, fetchedAt: '2099-01-01' }, 0, now), { status: 400 });
  assert.throws(() => normalize({ ...record, url: 'https://example.test/not-tencent' }, 0, now), { status: 400 });
});
test('公开页面采集仅提取已知平台作品链接和明确名称，拒绝同名镜像链接', () => {
  const records = extractHtml('tencent', '<a href="https://v.qq.com/x/cover/abc123.html" title="真实剧名"><img data-src="//puui.qpic.cn/a.jpg" alt="真实剧名">更新至30集</a><a href="https://evil.test/x/cover/bad.html" title="伪站"><img src="x.jpg"></a>');
  assert.equal(records.length, 1);
  assert.equal(records[0].title, '真实剧名');
  assert.equal(records[0].poster, 'https://puui.qpic.cn/a.jpg');
  assert.equal(records[0].score, null);
});
test('Netflix榜单去重保留最近周次，观看次数不转成评分或首播年份', () => {
  const records = parseNetflixTsv('week\tcategory\tweekly_rank\tshow_title\tseason_title\tweekly_views\n2026-10-11\tTV (English)\t2\tShow\tShow: Season 1\t1000\n2026-10-18\tTV (English)\t1\tShow\tShow: Season 1\t2000\n');
  assert.equal(records.length, 1);
  assert.equal(records[0].heat, 2000);
  assert.equal(records[0].score, null);
  assert.equal(records[0].year, null);
  assert.match(records[0].summary, /2026-10-18/);
  assert.throws(() => parseNetflixTsv('changed\nformat'), /格式已变化/);
});
test('采集遵守robots的具体路径、通配符和爬虫分组，不把动画归为普通剧集', () => {
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /\nAllow: /public/', '/public/list'), true);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private*', '/private/list'), false);
  assert.equal(robotsAllowed('User-agent: other\nDisallow: /\nUser-agent: *\nAllow: /', '/list'), true);
  assert.equal(robotsAllowed('User-agent: *\nAllow: /\nUser-agent: NoIdeaCatalog\nDisallow: /', '/list'), false);
  assert.equal(mapTvmaze({ id: 1, name: 'Anime', type: 'Animation', url: 'https://www.tvmaze.com/shows/1/anime', rating: {} }).kind, 'anime');
});
