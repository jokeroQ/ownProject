const { Op, fn, col, where, cast } = require('sequelize');
const { SeriesCatalog, sequelize } = require('../models');
const { validateQuery, KINDS } = require('./seriesService');
const { validateItem } = require('./seriesLibraryService');
const { PLATFORMS } = require('./seriesPlatforms');
const { regionPattern } = require('./seriesRegions');
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
function normalize(value, index, now) {
  const item = validateItem(value);
  if (!Object.hasOwn(KINDS, value.kind) || value.kind === 'all') fail('入库作品必须提供明确的 kind 分类');
  const date = value.fetchedAt === undefined ? now : new Date(value.fetchedAt);
  if (!Number.isFinite(date.getTime()) || date > new Date(now.getTime() + 60000)) fail('采集时间不正确');
  return { series_id: item.id, source: item.source, title: item.title, original_title: item.originalTitle, kind: value.kind, year: item.year, score: item.score, release_date: item.date, rank: Number.isSafeInteger(value.rank) && value.rank >= 0 ? value.rank : index + 1, genres: item.genres, regions: item.regions, item, fetched_at: date };
}
exports.importItems = async values => {
  if (!Array.isArray(values) || !values.length || values.length > 10000) fail('每次导入1–10000条作品');
  const now = new Date(), rows = values.map((value, index) => normalize(value, index, now));
  const unique = [...new Map(rows.map(row => [row.series_id, row])).values()];
  // Validate the entire input first; one failed item cannot leave a half-imported batch.
  await sequelize.transaction(async transaction => {
    for (let start = 0; start < unique.length; start += 100) await SeriesCatalog.bulkCreate(unique.slice(start, start + 100), { transaction,
      updateOnDuplicate: ['source', 'title', 'original_title', 'kind', 'year', 'score', 'release_date', 'rank', 'genres', 'regions', 'item', 'fetched_at'] });
  });
  return { imported: unique.length };
};
exports.search = async input => {
  const query = validateQuery(input), conditions = [];
  if (!['all', 'catalog'].includes(query.source)) conditions.push({ source: query.source });
  if (query.kind !== 'all') conditions.push({ kind: query.kind });
  if (query.keyword) conditions.push({ [Op.or]: [where(fn('LOCATE', query.keyword, col('title')), { [Op.gt]: 0 }), where(fn('LOCATE', query.keyword, col('original_title')), { [Op.gt]: 0 })] });
  if (query.minScore) conditions.push({ score: { [Op.gte]: query.minScore } });
  if (query.year !== 'all') conditions.push({ year: query.year === 'recent' ? { [Op.between]: [new Date().getFullYear() - 1, new Date().getFullYear()] } : +query.year });
  if (query.genre) conditions.push(where(fn('JSON_CONTAINS', col('genres'), JSON.stringify(query.genre)), 1));
  if (query.region) conditions.push(where(fn('LOWER', cast(col('regions'), 'CHAR')), { [Op.regexp]: regionPattern(query.region) }));
  const order = query.sort === 'rating' ? [['score', 'DESC'], ['series_id', 'ASC']] : query.sort === 'latest' ? [['release_date', 'DESC'], ['series_id', 'ASC']] : [['rank', 'ASC'], ['series_id', 'ASC']];
  const { rows, count } = await SeriesCatalog.findAndCountAll({ where: { [Op.and]: conditions }, order, limit: 20, offset: (query.page - 1) * 20 });
  return { items: rows.map(row => ({ ...row.item, catalogFetchedAt: row.fetched_at })), total: count, page: query.page, hasMore: query.page < 50 && query.page * 20 < count };
};
exports.status = async () => {
  const counts = await SeriesCatalog.findAll({ attributes: ['source', [fn('COUNT', col('series_id')), 'count'], [fn('MAX', col('fetched_at')), 'lastFetchedAt']], group: ['source'], raw: true });
  return { total: counts.reduce((sum, row) => sum + Number(row.count), 0), sources: Object.entries(PLATFORMS).map(([source, platform]) => {
    const row = counts.find(row => row.source === source);
    return { source, label: platform.label, count: Number(row?.count || 0), lastFetchedAt: row?.lastFetchedAt || null, live: Boolean(platform.live) };
  }) };
};
exports.normalize = normalize;
