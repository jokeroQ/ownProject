const PLATFORMS = {
  douban: { label: '豆瓣', hosts: ['movie.douban.com'], live: true },
  bangumi: { label: 'Bangumi', hosts: ['bgm.tv', 'bangumi.tv'], live: true },
  tvmaze: { label: 'TVmaze', hosts: ['tvmaze.com'], live: true },
  bilibili: { label: '哔哩哔哩', hosts: ['bilibili.com'], live: true },
  tencent: { label: '腾讯视频', hosts: ['v.qq.com'] },
  youku: { label: '优酷', hosts: ['youku.com', 'youku.tv'] },
  mango: { label: '芒果TV', hosts: ['mgtv.com'] },
  iqiyi: { label: '爱奇艺', hosts: ['iqiyi.com', 'iq.com'] },
  netflix: { label: 'Netflix', hosts: ['netflix.com'] },
  hongguo: { label: '红果短剧', hosts: [] },
  hanjutv: { label: '韩剧TV', hosts: [] },
};
const SOURCES = Object.fromEntries(Object.entries(PLATFORMS).map(([key, value]) => [key, value.label]));
function hosts(source) {
  const configured = process.env[`SERIES_${source.toUpperCase()}_HOSTS`];
  return [...(PLATFORMS[source]?.hosts || []), ...(configured || '').split(',').map(host => host.trim().toLowerCase()).filter(host => /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(host) && host !== 'localhost')];
}
module.exports = { PLATFORMS, SOURCES, hosts };
