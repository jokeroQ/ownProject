const https = require('node:https');
const { createHash } = require('node:crypto');
const { Parser } = require('htmlparser2');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SOURCES, safeUrl, score } = require('./seriesService');
const { hosts } = require('./seriesPlatforms');
const { regionName } = require('./seriesRegions');
const PAGES = {
  tencent: 'https://v.qq.com/channel/tv',
  youku: 'https://www.youku.com/ku/webtv',
  mango: 'https://www.mgtv.com/lib/2?channelId=2',
  iqiyi: 'https://www.iqiyi.com/dianshiju/',
};
const BASE = (source, sourceId, title, url, kind = 'tv') => ({ id: `${source}:${sourceId}`, source, sourceId: String(sourceId), sourceLabel: SOURCES[source], title, originalTitle: '', url, poster: '', score: null, ratingState: 'unrated', ratingCount: null, year: null, genres: [], regions: [], cast: [], summary: '', episodes: '', date: '', heat: null, heatLabel: '', kind });
const message = error => error.status === 403 || error.status === 429 ? `平台返回 ${error.status}，本次停止采集，保留已有片库。` : error.message;
function getText(url, maxSize = 6 * 1024 * 1024, redirects = 0) {
  const target = new URL(url);
  // Callers use fixed platform origins only; never accept a URL from an HTTP request.
  const allowed = ['v.qq.com', 'www.youku.com', 'www.mgtv.com', 'www.iqiyi.com', 'www.netflix.com', 'api.tvmaze.com'];
  if (target.protocol !== 'https:' || !allowed.includes(target.hostname)) throw new Error('不支持的采集地址');
  const proxyHosts = (process.env.SERIES_COLLECTOR_PROXY_HOSTS || '').split(',').map(host => host.trim());
  return new Promise((resolve, reject) => {
    const request = https.get(target, { ...(process.env.SERIES_PROXY_URL && proxyHosts.includes(target.hostname) ? { agent: new HttpsProxyAgent(process.env.SERIES_PROXY_URL) } : {}), headers: { 'User-Agent': 'NoIdeaCatalog/1.0', Accept: 'text/html,application/json,text/tab-separated-values,text/plain', 'Accept-Encoding': 'identity' } }, response => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location && redirects < 3) {
        response.resume();
        try { const next = new URL(response.headers.location, target); if (next.origin !== target.origin) throw new Error('采集重定向到其他站点，已停止'); resolve(getText(next.href, maxSize, redirects + 1)); }
        catch (error) { reject(error); }
        return;
      }
      if (response.statusCode !== 200 || Number(response.headers['content-length']) > maxSize) {
        response.resume(); reject(Object.assign(new Error(`来源返回HTTP ${response.statusCode}`), { status: response.statusCode })); return;
      }
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > maxSize) { request.destroy(new Error('来源响应过大')); return; } chunks.push(chunk); });
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
    const timer = setTimeout(() => request.destroy(new Error('来源响应超时')), 15000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
}
// Evaluate the most specific matching group and longest path rule. Fail closed on
// unsupported wildcard/end-anchor syntax instead of accidentally ignoring a prohibition.
function robotsAllowed(robots, pathname) {
  if (/<\s*(?:!doctype|html|script|body)\b/i.test(robots)) throw new Error('robots.txt返回网页，无法核实采集规则');
  const groups = []; let group = null, hasRules = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(), match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2].trim();
    if (key === 'user-agent') {
      if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow', 'disallow'].includes(key)) { group.rules.push({ allow: key === 'allow', path: value }); hasRules = true; }
  }
  const specific = groups.filter(group => group.agents.some(agent => agent !== '*' && 'noideacatalog'.includes(agent)));
  const selected = specific.length ? specific : groups.filter(group => group.agents.includes('*'));
  const rules = selected.flatMap(group => group.rules).filter(rule => rule.path && (() => {
    const expression = rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    return new RegExp('^' + expression).test(pathname);
  })()).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return !rules.length || rules[0].allow;
}
function extractHtml(source, html, pageUrl = PAGES[source]) {
  const found = new Map(); let anchor = null, depth = 0;
  const identify = href => {
    if (source === 'tencent') return /\/(?:x\/cover\/|detail\/[a-z]\/)([a-zA-Z0-9]+)(?:\.html|\/|$)/.exec(href)?.[1];
    if (source === 'youku') return /\/(?:v_show|show_page)\/id_([\w=]+)\.html/.exec(href)?.[1]?.replace(/=/g, '');
    if (source === 'mango') return /\/(?:b|h)\/(\d+)(?:\/|\.html)/.exec(href)?.[1];
    if (source === 'iqiyi') return /\/a_([a-zA-Z0-9]+)\.html/.exec(href)?.[1];
  };
  new Parser({
    onopentag(name, attrs) {
      depth++;
      if (name === 'a') {
        let url; try { url = new URL(attrs.href || '', pageUrl).href; } catch { return; }
        const id = identify(url);
        if (id && safeUrl(url, hosts(source))) anchor = { id, url, depth, title: attrs.title || attrs['aria-label'] || '', alt: '', text: '', poster: '' };
      }
      if (name === 'img' && anchor) {
        anchor.poster ||= attrs['data-src'] || attrs['data-original'] || attrs.src || '';
        anchor.alt ||= attrs.alt || '';
      }
    },
    ontext(value) { if (anchor) anchor.text += value; },
    onclosetag() {
      if (anchor && depth === anchor.depth) {
        const title = (anchor.title || anchor.alt).replace(/\s+/g, ' ').trim();
        // Require an explicit title attribute or image alt; promotional text and
        // episode counts concatenated from nested children are not reliable names.
        if (title && title.length <= 120 && anchor.poster && !found.has(anchor.id)) {
          let poster = ''; try { poster = new URL(anchor.poster, pageUrl).href; } catch { /* Keep a text placeholder. */ }
          found.set(anchor.id, { ...BASE(source, anchor.id, title, anchor.url), poster, rank: found.size + 1 });
        }
        anchor = null;
      }
      depth--;
    },
  }, { decodeEntities: true }).end(html);
  return [...found.values()];
}
function parseNetflixTsv(input) {
  const parseLine = line => { const columns = []; let value = '', quoted = false; for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; } else if (char === '\t' && !quoted) { columns.push(value); value = ''; } else value += char; } columns.push(value); return columns; };
  const [header, ...lines] = input.replace(/^\uFEFF/, '').trim().split(/\r?\n/), keys = parseLine(header || '');
  if (!['show_title', 'week', 'category', 'weekly_rank'].every(key => keys.includes(key))) throw new Error('Netflix公开榜单格式已变化');
  const titles = new Map();
  for (const line of lines) {
    const values = parseLine(line), row = Object.fromEntries(keys.map((key, index) => [key, values[index] || '']));
    if (!row.show_title || !/^\d{4}-\d{2}-\d{2}$/.test(row.week)) continue;
    const season = row.season_title && !['N/A', 'NA'].includes(row.season_title) ? row.season_title : '';
    const title = season || row.show_title, id = createHash('sha256').update(row.category + '\0' + row.show_title + '\0' + season).digest('hex').slice(0, 32);
    const old = titles.get(id);
    if (old && old.week >= row.week) continue;
    titles.set(id, { ...BASE('netflix', id, title, 'https://www.netflix.com/tudum/top10', row.category.startsWith('Films') ? 'movie' : 'tv'),
      summary: `Netflix公开周榜：${row.category}；最近上榜周 ${row.week}，第 ${row.weekly_rank} 名。榜单不提供评分、首播年份或地区完整片库。`,
      heat: Number(row.weekly_views) || null, heatLabel: '周观看次数', rank: +row.weekly_rank, week: row.week });
  }
  return [...titles.values()].sort((a, b) => b.week.localeCompare(a.week) || a.rank - b.rank).map((item, index) => { const { week: _week, ...value } = item; return { ...value, rank: index + 1 }; });
}
function mapTvmaze(show) {
  const kind = show.type === 'Animation' ? 'anime' : show.type === 'Documentary' ? 'documentary' : ['Reality', 'Game Show', 'Talk Show', 'Panel Show', 'Award Show'].includes(show.type) ? 'variety' : 'tv';
  const year = Number(show.premiered?.slice(0, 4)) || null;
  return { ...BASE('tvmaze', show.id, show.name, show.url, kind), originalTitle: show.name, score: score(show.rating?.average), poster: show.image?.medium || '', year, genres: (show.genres || []).map(genre => ({ Drama: '剧情', Comedy: '喜剧', Crime: '犯罪', Romance: '爱情', 'Science-Fiction': '科幻', Mystery: '悬疑', Fantasy: '奇幻', Action: '动作', Adventure: '冒险', History: '历史', Family: '家庭' })[genre] || genre),
    regions: [regionName((show.network?.country || show.webChannel?.country)?.code)].filter(Boolean), date: show.premiered || '', summary: String(show.summary || '').replace(/<[^>]*>/g, '').slice(0, 600) };
}
async function collect(source, { pages = 1, startPage = 0 } = {}) {
  if (source === 'tvmaze') {
    const items = [];
    for (let page = startPage; page < startPage + pages; page++) {
      if (page > startPage) await new Promise(resolve => setTimeout(resolve, 1100));
      try { const data = JSON.parse(await getText(`https://api.tvmaze.com/shows?page=${page}`)); if (!Array.isArray(data)) throw new Error('TVmaze片库格式已变化'); items.push(...data.map(mapTvmaze)); }
      catch (error) { if (error.status === 404) break; throw error; }
    }
    return items;
  }
  if (['douban', 'bangumi', 'bilibili'].includes(source)) {
    const items = []; let requested = false;
    for (let page = 1; page <= pages; page++) for (const kind of source === 'douban' ? ['tv', 'short', 'anime', 'movie', 'variety', 'documentary', 'ai'] : source === 'bangumi' ? ['anime', 'tv'] : ['short', 'ai']) {
      if (requested) await new Promise(resolve => setTimeout(resolve, 1100));
      requested = true;
      const result = await require('./seriesService').search({ source, kind, page: String(page), year: 'all', sort: 'hot' });
      if (result.unavailable) { if (!items.length) throw new Error(result.sources[0].message); else continue; }
      items.push(...result.items.map(item => ({ ...item, kind })));
    }
    return [...new Map(items.map(item => [item.id, item])).values()];
  }
  const target = PAGES[source] || (source === 'netflix' ? 'https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv' : null);
  if (!target) throw new Error('尚无已核实的公开采集入口，请使用授权数据JSON导入；不会猜测App内部接口或使用同名镜像站。');
  let robots = '';
  try { robots = await getText(new URL('/robots.txt', target).href, 256 * 1024); }
  catch (error) { if (error.status !== 404) throw new Error('robots.txt无法核实，本次不采集该网站'); }
  if (!robotsAllowed(robots, new URL(target).pathname)) throw new Error('该路径不允许当前爬虫访问，本次不采集');
  await new Promise(resolve => setTimeout(resolve, 1100));
  const data = await getText(target);
  const items = source === 'netflix' ? parseNetflixTsv(data) : extractHtml(source, data);
  if (!items.length) throw new Error('公开页面未提供可确认的作品数据，可能采用动态渲染；本次保留已有片库');
  return items;
}
module.exports = { collect, extractHtml, parseNetflixTsv, robotsAllowed, mapTvmaze, message };
