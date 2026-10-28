const { User, UserSeries, sequelize } = require('../models');
const { SOURCES, safeUrl, score } = require('./seriesService');
const { hosts } = require('./seriesPlatforms');
const { REGIONS, matchesRegion } = require('./seriesRegions');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const own = (value, key) => Object.hasOwn(value, key);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 255) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 15).map(item => text(item, 80)) : [];
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const imageHosts = ['doubanio.com', 'lain.bgm.tv', 'static.tvmaze.com', 'hdslb.com', 'gtimg.com', 'gtimg.cn', 'qpic.cn', 'ykimg.com', 'mgtv.com', 'hunantv.com', 'iqiyipic.com', 'nflximg.net', 'nflxso.net'];
const MAX_ITEMS = 1000;
function validateId(id) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_-]{1,31}:[\w-]{1,64}$/.test(id) || !own(SOURCES, id.split(':')[0])) fail('作品标识不正确');
  return id;
}
function validateItem(value, id) {
  if (!plain(value) || value.id !== id || value.id !== `${value.source}:${value.sourceId}` || !text(value.title)) fail('作品信息不完整');
  if (typeof value.url !== 'string' || value.url.length > 2048 || (value.poster !== undefined && (typeof value.poster !== 'string' || value.poster.length > 2048))) fail('作品或海报地址过长或格式不正确');
  const url = safeUrl(value.url, hosts(value.source));
  if (!url) fail('作品来源地址不正确');
  const rating = score(value.score);
  return { id, source: value.source, sourceId: String(value.sourceId), sourceLabel: SOURCES[value.source], title: text(value.title), originalTitle: text(value.originalTitle),
    url, poster: safeUrl(value.poster, imageHosts), score: rating, ratingState: rating !== null ? 'rated' : value.ratingState === 'unavailable' ? 'unavailable' : 'unrated',
    ratingCount: number(value.ratingCount), year: Number.isInteger(value.year) && value.year >= 1800 && value.year <= 2200 ? value.year : null,
    genres: strings(value.genres), regions: strings(value.regions), cast: strings(value.cast), summary: text(value.summary, 600), episodes: text(value.episodes, 80), date: text(value.date, 32), heat: number(value.heat), heatLabel: text(value.heatLabel, 32) };
}
function validatePatch(id, body) {
  validateId(id);
  if (!plain(body) || Object.keys(body).some(key => !['favorite', 'watchStatus', 'item'].includes(key)) || (!own(body, 'favorite') && !own(body, 'watchStatus'))) fail('请指定收藏或观看状态');
  if (own(body, 'favorite') && typeof body.favorite !== 'boolean') fail('收藏状态不正确');
  if (own(body, 'watchStatus') && !['none', 'want', 'watching'].includes(body.watchStatus)) fail('观看状态不正确');
  return { ...(own(body, 'favorite') ? { favorite: body.favorite } : {}), ...(own(body, 'watchStatus') ? { watch_status: body.watchStatus } : {}), ...(own(body, 'item') ? { item: validateItem(body.item, id) } : {}) };
}
const state = row => ({ id: row.series_id, favorite: row.favorite, watchStatus: row.watch_status });
const entry = row => ({ ...row.item, ...state(row), savedAt: row.saved_at, updatedAt: row.updated_at });
exports.status = async userId => {
  const rows = await UserSeries.findAll({ where: { user_id: userId }, attributes: ['series_id', 'favorite', 'watch_status'], order: [['series_id', 'ASC']] });
  return { entries: rows.map(state), counts: { all: rows.length, favorite: rows.filter(row => row.favorite).length, want: rows.filter(row => row.watch_status === 'want').length, watching: rows.filter(row => row.watch_status === 'watching').length } };
};
exports.list = async (userId, query = {}) => {
  const list = query.list === undefined ? 'all' : query.list;
  const keyword = query.keyword === undefined ? '' : query.keyword;
  const page = query.page === undefined ? 1 : Number(query.page);
  const region = query.region === undefined ? '' : query.region;
  if (typeof region !== 'string' || (region && !REGIONS.includes(region))) fail('片单地区参数不正确');
  if (!['all', 'favorite', 'want', 'watching'].includes(list) || typeof keyword !== 'string' || keyword.length > 80 || (query.page !== undefined && typeof query.page !== 'string') || !Number.isSafeInteger(page) || page < 1 || page > 1000) fail('片单筛选参数不正确');
  const where = { user_id: userId, ...(list === 'favorite' ? { favorite: true } : list !== 'all' ? { watch_status: list } : {}) };
  // Only a bounded personal library is read; filtering in memory keeps literal %/_ searches
  // predictable and avoids database-specific JSON LIKE escaping differences.
  const rows = await UserSeries.findAll({ where, order: [['updated_at', 'DESC'], ['series_id', 'ASC']] });
  const needle = keyword.trim().toLocaleLowerCase();
  const matches = rows.filter(row => matchesRegion(row.item.regions, region) && (!needle || [row.item.title, row.item.originalTitle].some(title => title.toLocaleLowerCase().includes(needle))));
  const pageSize = 24, offset = (page - 1) * pageSize;
  return { items: matches.slice(offset, offset + pageSize).map(entry), total: matches.length, page, pageSize, hasMore: offset + pageSize < matches.length };
};
exports.save = async (userId, id, body) => {
  const patch = validatePatch(id, body);
  return sequelize.transaction(async transaction => {
    // Serialize changes for this user, including inserts of the same previously absent title.
    if (!await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })) fail('账号不存在', 401);
    let row = await UserSeries.findOne({ where: { user_id: userId, series_id: id }, transaction, lock: transaction.LOCK.UPDATE });
    const favorite = patch.favorite ?? row?.favorite ?? false;
    const watchStatus = patch.watch_status ?? row?.watch_status ?? 'none';
    if (!favorite && watchStatus === 'none') {
      if (row) await row.destroy({ transaction });
      return { id, favorite: false, watchStatus: 'none' };
    }
    if (row) row = await row.update(patch, { transaction });
    else {
      if (!patch.item) fail('首次加入片单需要完整的作品信息');
      if (await UserSeries.count({ where: { user_id: userId }, transaction }) >= MAX_ITEMS) fail('个人片单最多保存1000部作品', 409);
      row = await UserSeries.create({ user_id: userId, series_id: id, ...patch }, { transaction });
    }
    return state(row);
  });
};
exports.remove = async (userId, id) => {
  validateId(id);
  return sequelize.transaction(async transaction => {
    await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    await UserSeries.destroy({ where: { user_id: userId, series_id: id }, transaction });
    return { id, favorite: false, watchStatus: 'none' };
  });
};
exports.validatePatch = validatePatch;
exports.validateItem = (value) => { validateId(value?.id); return validateItem(value, value.id); };
