const live = require('./seriesService');
const catalog = require('./seriesCatalogService');
const { PLATFORMS } = require('./seriesPlatforms');
exports.detail = live.detail;
exports.search = async input => {
  const query = live.validateQuery(input);
  const catalogOnly = query.source === 'catalog' || (query.source !== 'all' && !PLATFORMS[query.source]?.live);
  // Both sources run independently; unavailable upstreams must not hide saved catalog data.
  const [local, remote] = await Promise.allSettled([catalog.search(input), catalogOnly ? Promise.resolve(null) : live.search(input)]);
  if (catalogOnly && local.status === 'rejected') throw local.reason;
  if (remote.status === 'rejected' && local.status === 'rejected') throw remote.reason;
  const stored = local.status === 'fulfilled' ? local.value : null;
  const network = remote.status === 'fulfilled' ? remote.value : null;
  // Prefer live metadata for the same platform id. Names alone are never a reliable join key.
  const liveIds = new Set((network?.items || []).map(item => item.id));
  const items = [...(network?.items || []), ...(stored?.items || []).filter(item => !liveIds.has(item.id))];
  if (query.sort === 'rating') items.sort((a, b) => (b.score || 0) - (a.score || 0));
  const localSource = { source: 'catalog', label: query.source === 'catalog' || query.source === 'all' ? '自建片库' : PLATFORMS[query.source].label,
    state: stored ? 'ok' : 'unavailable', message: !stored ? '自建片库暂时无法读取，已保留其余来源结果。' : stored.total ? `自建片库匹配 ${stored.total} 部作品，保留各平台原始信息。` : '自建片库暂无匹配作品。需先执行采集或导入；这里不会用平台搜索链接冒充已收录数据。', count: stored?.items.length || 0, updatedAt: null };
  return { items, sources: [...(network?.sources || []), ...((stored?.items.length || catalogOnly || local.status === 'rejected') ? [localSource] : [])], page: query.page,
    hasMore: Boolean(stored?.hasMore || network?.hasMore), unavailable: !items.length && Boolean(network?.unavailable || (!stored && catalogOnly)), fetchedAt: new Date().toISOString(),
    notice: '聚合实时来源与自建片库。自建片库由独立采集任务或JSON导入更新，不在打开页面时临时爬取。平台收录、评分体系和可用性不同；相同平台ID去重，同名不同作品不自动合并。' };
};
