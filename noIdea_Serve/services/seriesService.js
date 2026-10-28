const { Parser } = require('htmlparser2');
const https = require('node:https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const { SOURCES } = require('./seriesPlatforms');
const { GROUPS, REGIONS, matchesRegion, regionsFromTags, regionName, LIVE_COUNTRIES } = require('./seriesRegions');
const KINDS = { all: '全部', tv: '电视剧', short: '短剧', ai: 'AI剧', anime: '动漫', movie: '电影', variety: '综艺', documentary: '纪录片' };
const GENRES = ['剧情', '喜剧', '爱情', '悬疑', '犯罪', '科幻', '奇幻', '动作', '冒险', '历史', '战争', '家庭', '动画', '纪录片'];
const EN_GENRES = { Drama: '剧情', Comedy: '喜剧', Romance: '爱情', Mystery: '悬疑', Crime: '犯罪', 'Science-Fiction': '科幻', Fantasy: '奇幻', Action: '动作', Adventure: '冒险', History: '历史', War: '战争', Family: '家庭', Anime: '动画' };
const PAGE_SIZE = 20;
const fail = message => Object.assign(new Error(message), { status: 400 });
const text = (value, max = 255) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 15).map(item => text(item, 80)) : [];
const score = value => ['number', 'string'].includes(typeof value) && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 10 ? Number(value) : null;
function plain(html) {
  let result = '';
  new Parser({ ontext: value => { result += value; } }, { decodeEntities: true }).end(String(html || ''));
  return text(result, 600);
}
function safeUrl(value, hosts) {
  try {
    const url = new URL(String(value).startsWith('//') ? 'https:' + value : value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)) ? url.href.replace(/^http:/, 'https:') : '';
  } catch { return ''; }
}
function validateQuery(input = {}, now = new Date()) {
  const scalar = (key, fallback) => {
    if (input[key] === undefined) return fallback;
    if (typeof input[key] !== 'string') throw fail('筛选参数格式不正确');
    return input[key].trim();
  };
  const query = { keyword: scalar('keyword', ''), kind: scalar('kind', 'all'), source: scalar('source', 'all'), sort: scalar('sort', 'hot'), genre: scalar('genre', ''), region: scalar('region', ''), year: scalar('year', 'recent'), minScore: Number(scalar('minScore', '0')), page: Number(scalar('page', '1')) };
  if (query.keyword.length > 80 || /[\u0000-\u001f]/.test(query.keyword)) throw fail('关键词不能超过80个字');
  if (!Object.hasOwn(KINDS, query.kind) || !['all', 'catalog', ...Object.keys(SOURCES)].includes(query.source) || !['hot', 'latest', 'rating'].includes(query.sort)) throw fail('不支持的分类、来源或排序');
  if ((query.genre && !GENRES.includes(query.genre)) || (query.region && !REGIONS.includes(query.region))) throw fail('不支持的题材或地区');
  if (!['recent', 'all'].includes(query.year) && (!/^\d{4}$/.test(query.year) || +query.year < 1900 || +query.year > now.getFullYear() + 1)) throw fail('年份不正确');
  if (!Number.isFinite(query.minScore) || query.minScore < 0 || query.minScore > 10 || !Number.isInteger(query.page) || query.page < 1 || query.page > 50) throw fail('评分或页码不正确');
  return query;
}
const bounds = (query, now) => query.year === 'all' ? null : query.year === 'recent' ? [now.getFullYear() - 1, now.getFullYear()] : [+query.year, +query.year];
const itemBase = (source, id, title, url) => ({ id: `${source}:${id}`, source, sourceLabel: SOURCES[source], sourceId: String(id), title: text(title), originalTitle: '', url, poster: '', score: null, ratingState: 'unrated', ratingCount: null, year: null, genres: [], regions: [], cast: [], summary: '', episodes: '', date: '', heat: null, heatLabel: '' });
function matches(item, query, now) {
  if (query.minScore && (item.score === null || item.score < query.minScore)) return false;
  const years = bounds(query, now);
  if (years && (item.year === null || item.year < years[0] || item.year > years[1])) return false;
  if (query.genre && !item.genres.includes(query.genre)) return false;
  if (!matchesRegion(item.regions, query.region)) return false;
  return true;
}

// All requests have fixed upstream origins; user input is only encoded as query values.
async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 6000);
  try {
    return await new Promise((resolve, reject) => {
      const proxyHosts = (process.env.SERIES_PROXY_HOSTS || 'api.bgm.tv').split(',').map(value => value.trim());
      const proxy = proxyHosts.includes(new URL(url).hostname) ? process.env.SERIES_PROXY_URL : '';
      const req = https.request(url, {
        method: options.method || 'GET', signal: controller.signal,
        agent: proxy ? new HttpsProxyAgent(proxy) : false,
        headers: { 'User-Agent': 'noIdea-Series/1.0 (personal media discovery)', Accept: 'application/json', 'Accept-Encoding': 'identity', ...options.headers },
      }, response => {
        response.on('error', reject);
        if (response.statusCode !== 200 || Number(response.headers['content-length']) > 2 * 1024 * 1024) { response.destroy(); reject(new Error('upstream unavailable')); return; }
        const chunks = []; let size = 0;
        response.on('data', chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) { req.destroy(new Error('upstream too large')); return; } chunks.push(chunk); });
        response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
      });
      req.on('error', reject);
      req.end(options.body);
    });
  } finally { clearTimeout(timer); }
}

function createSeriesService({ request = fetchJson, clock = () => new Date() } = {}) {
  const cache = new Map(), pending = new Map();
  async function cached(key, operation, ttl = 5 * 60 * 1000) {
    const previous = cache.get(key), now = clock().getTime();
    if (previous && now - previous.time < ttl) return { ...previous, stale: false };
    if (pending.has(key)) return pending.get(key);
    const promise = (async () => {
      try {
        const value = { value: await operation(), time: clock().getTime(), stale: false };
        cache.delete(key); cache.set(key, value);
        if (cache.size > 160) cache.delete(cache.keys().next().value);
        return value;
      } catch (error) {
        if (previous && now - previous.time < 60 * 60 * 1000) return { ...previous, stale: true };
        throw error;
      } finally { pending.delete(key); }
    })();
    pending.set(key, promise);
    return promise;
  }
  const doubanRequest = (path, timeoutMs) => request('https://movie.douban.com' + path, { timeoutMs, headers: { Referer: 'https://movie.douban.com/tv/' } });
  async function abstract(id) {
    if (!/^\d{1,12}$/.test(String(id))) throw fail('作品ID不正确');
    return cached('douban-detail:' + id, async () => {
      const data = await doubanRequest('/j/subject_abstract?subject_id=' + id, 2500);
      if (!data.subject || data.r !== 0) throw new Error('invalid subject');
      const subject = data.subject;
      return { title: text(subject.title), score: score(subject.rate), year: /^\d{4}$/.test(subject.release_year) ? +subject.release_year : null, genres: strings(subject.types), regions: text(subject.region).split(/\s*[/／]\s*/).filter(Boolean), cast: strings(subject.actors), directors: strings(subject.directors), episodes: subject.episodes_count ? `${text(String(subject.episodes_count), 10)} 集` : '', duration: text(subject.duration), isTv: Boolean(subject.is_tv), url: `https://movie.douban.com/subject/${id}/` };
    }, 30 * 60 * 1000);
  }
  async function douban(query) {
    if (query.keyword) {
      if (query.page > 1) return { items: [], hasMore: false };
      const suggestions = await doubanRequest('/j/subject_suggest?q=' + encodeURIComponent(query.keyword), 3500);
      if (!Array.isArray(suggestions)) throw new Error('invalid suggestions');
      const subjects = suggestions.filter(row => /^\d+$/.test(String(row.id)) && row.type === 'movie').slice(0, 10);
      const results = [];
      // Keep at most three detail requests open, and share them with the detail dialog cache.
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(3, subjects.length) }, async () => {
        while (index < subjects.length) {
          const row = subjects[index++];
          let data;
          try { data = (await abstract(row.id)).value; } catch { data = null; }
          const item = { ...itemBase('douban', row.id, row.title, `https://movie.douban.com/subject/${row.id}/`), poster: safeUrl(row.img, ['doubanio.com']), year: /^\d{4}$/.test(row.year) ? +row.year : null, ...(data || {}), title: text(row.title), ratingState: data ? 'unrated' : 'unavailable' };
          if (item.score !== null) item.ratingState = 'rated';
          if (data) {
            if (query.kind === 'movie' && data.isTv) continue;
            if (query.kind === 'tv' && !data.isTv) continue;
            if (query.kind === 'short' && (!data.isTv || !(/短剧|短片/.test(data.genres.join('')) || (/^\d+/.test(data.duration) && parseInt(data.duration) <= 20 && !data.genres.includes('动画'))))) continue;
            if (query.kind === 'anime' && !data.genres.includes('动画')) continue;
            if (query.kind === 'documentary' && !data.genres.includes('纪录片')) continue;
            if (query.kind === 'variety' && !data.genres.some(value => ['综艺', '真人秀', '脱口秀'].includes(value))) continue;
            if (query.kind === 'ai') continue; // No reliable AI-production classification in this endpoint.
          } else if (query.kind !== 'all') continue;
          if (matches(item, query, clock())) results.push(item);
        }
      }));
      results.sort((a, b) => query.sort === 'rating' ? (b.score || 0) - (a.score || 0) : query.sort === 'latest' ? (b.year || 0) - (a.year || 0) : subjects.findIndex(row => String(row.id) === a.sourceId) - subjects.findIndex(row => String(row.id) === b.sourceId));
      return { items: results, hasMore: false, note: '关键词使用豆瓣联想检索，最多返回10项匹配作品。' };
    }
    const tag = { all: '电视剧', tv: '电视剧', short: '短剧', ai: 'AI剧', anime: '动画', movie: '电影', variety: '综艺', documentary: '纪录片' }[query.kind];
    if (GROUPS.includes(query.region)) {
      const countries = LIVE_COUNTRIES[query.region];
      const slots = Array.from({ length: PAGE_SIZE }, (_, index) => {
        const position = (query.page - 1) * PAGE_SIZE + index;
        return { country: countries[position % countries.length], offset: Math.floor(position / countries.length) };
      });
      const plans = countries.map(country => ({ country, start: slots.find(slot => slot.country === country)?.offset, count: slots.filter(slot => slot.country === country).length }));
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(3, plans.length) }, async () => {
        while (index < plans.length) {
          const plan = plans[index++];
          const params = new URLSearchParams({ sort: { hot: 'U', latest: 'R', rating: 'S' }[query.sort], range: `${query.minScore},10`, tags: [tag, query.genre].filter(Boolean).join(','), start: String(plan.start), countries: plan.country });
          const years = bounds(query, clock());
          if (years) params.set('year_range', years.join(','));
          const data = await doubanRequest('/j/new_search_subjects?' + params);
          if (!Array.isArray(data.data)) throw new Error('invalid douban response');
          plan.rows = data.data;
        }
      }));
      const items = slots.map(slot => {
        const plan = plans.find(plan => plan.country === slot.country);
        const row = plan.rows[slot.offset - plan.start];
        return row && /^\d+$/.test(String(row.id)) && row.title ? { ...itemBase('douban', row.id, row.title, `https://movie.douban.com/subject/${row.id}/`), poster: safeUrl(row.cover, ['doubanio.com']), score: score(row.rate), ratingState: score(row.rate) === null ? 'unrated' : 'rated', cast: strings(row.casts), regions: [slot.country] } : null;
      }).filter(item => item && (!query.minScore || (item.score !== null && item.score >= query.minScore)));
      return { items: [...new Map(items.map(item => [item.id, item])).values()], hasMore: plans.some(plan => plan.rows.length > plan.count), note: '地区分组并行检索常用国家/地区并交错分页；完整国家范围以自建片库已知的制作地区为准。' };
    }
    const params = new URLSearchParams({ sort: { hot: 'U', latest: 'R', rating: 'S' }[query.sort], range: `${query.minScore},10`, tags: [tag, query.genre].filter(Boolean).join(','), start: String((query.page - 1) * PAGE_SIZE) });
    if (query.region) params.set('countries', query.region);
    const years = bounds(query, clock());
    if (years) params.set('year_range', years.join(','));
    const result = await doubanRequest('/j/new_search_subjects?' + params);
    if (!Array.isArray(result.data)) throw new Error('invalid douban response');
    const items = result.data.filter(row => /^\d+$/.test(String(row.id)) && row.title).map(row => ({ ...itemBase('douban', row.id, row.title, `https://movie.douban.com/subject/${row.id}/`), poster: safeUrl(row.cover, ['doubanio.com']), score: score(row.rate), ratingState: score(row.rate) === null ? 'unrated' : 'rated', cast: strings(row.casts) })).filter(item => !query.minScore || (item.score !== null && item.score >= query.minScore));
    return { items, hasMore: result.data.length === PAGE_SIZE, note: query.kind === 'ai' ? 'AI剧只展示豆瓣明确收录的标签作品，未收录内容可前往平台搜索。' : '' };
  }
  async function bangumi(query) {
    if (!['all', 'tv', 'anime'].includes(query.kind)) return { items: [], hasMore: false, unsupported: true, note: '此来源提供动漫与已收录的电视剧。' };
    if (query.sort === 'latest') {
      // The public API has no date-desc sort: browse its latest airing calendar instead of relabeling heat as latest.
      const calendar = await request('https://api.bgm.tv/calendar');
      if (!Array.isArray(calendar)) throw new Error('invalid calendar');
      const rows = [...new Map(calendar.flatMap(day => day.items || []).map(row => [row.id, row])).values()];
      const items = rows.map(row => ({ ...itemBase('bangumi', row.id, row.name_cn || row.name, `https://bgm.tv/subject/${row.id}`), originalTitle: text(row.name), poster: safeUrl(row.images?.large || row.images?.common, ['bgm.tv']), score: score(row.rating?.score), ratingState: score(row.rating?.score) ? 'rated' : 'unrated', ratingCount: row.rating?.total || null, year: /^\d{4}/.test(row.air_date) ? +row.air_date.slice(0, 4) : null, date: text(row.air_date), genres: ['动画'], summary: text(row.summary, 600) })).filter(item => matches(item, query, clock()) && (!query.keyword || `${item.title} ${item.originalTitle}`.toLowerCase().includes(query.keyword.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
      if (query.kind === 'tv') return { items: [], hasMore: false, unsupported: true, note: '最新番剧日历只覆盖动漫，电视剧请查看其他来源。' };
      return { items: items.slice((query.page - 1) * PAGE_SIZE, query.page * PAGE_SIZE), hasMore: items.length > query.page * PAGE_SIZE, note: '最新列表来自当前番剧放送日历；题材和地区未知的作品不会通过相应筛选。' };
    }
    const filter = { type: query.kind === 'anime' ? [2] : query.kind === 'tv' ? [6] : [2, 6], nsfw: false };
    const years = bounds(query, clock());
    if (years) filter.air_date = [`>=${years[0]}-01-01`, `<=${years[1]}-12-31`];
    if (query.minScore) filter.rating = ['>=' + query.minScore];
    const tags = [query.genre, GROUPS.includes(query.region) ? '' : query.region === '中国大陆' ? '中国' : query.region].filter(Boolean);
    if (tags.length) filter.tag = tags;
    const result = await request(`https://api.bgm.tv/v0/search/subjects?limit=${PAGE_SIZE}&offset=${(query.page - 1) * PAGE_SIZE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: query.keyword, sort: query.sort === 'rating' ? 'score' : 'heat', filter }) });
    if (!Array.isArray(result.data)) throw new Error('invalid bangumi response');
    return { items: result.data.map(row => ({ ...itemBase('bangumi', row.id, row.name_cn || row.name, `https://bgm.tv/subject/${row.id}`), originalTitle: text(row.name), poster: safeUrl(row.images?.common || row.images?.large, ['bgm.tv']), score: score(row.rating?.score), ratingState: score(row.rating?.score) ? 'rated' : 'unrated', ratingCount: row.rating?.total || null, year: /^\d{4}/.test(row.date) ? +row.date.slice(0, 4) : null, date: text(row.date), genres: strings(row.tags?.slice(0, 4).map(tag => tag.name)), regions: regionsFromTags(row.tags?.map(tag => tag.name)), summary: text(row.summary, 600), episodes: row.eps ? `${row.eps} 集` : '' })).filter(item => (!GROUPS.includes(query.region) || matchesRegion(item.regions, query.region)) && (!query.minScore || (item.score !== null && item.score >= query.minScore)) && (!years || (item.year !== null && item.year >= years[0] && item.year <= years[1]))), hasMore: Number(result.total) > query.page * PAGE_SIZE };
  }
  async function tvmaze(query) {
    if (['ai', 'movie', 'short'].includes(query.kind)) return { items: [], hasMore: false, unsupported: true, note: '此来源未提供独立的短剧、AI剧或电影分类。' };
    let rows;
    if (query.keyword) {
      const result = await request('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(query.keyword));
      if (!Array.isArray(result)) throw new Error('invalid tvmaze response');
      rows = result.map(row => row.show);
    } else {
      const date = clock().toISOString().slice(0, 10);
      const data = (await cached('tvmaze-schedule:' + date, () => request('https://api.tvmaze.com/schedule/web?date=' + date))).value;
      if (!Array.isArray(data)) throw new Error('invalid schedule');
      rows = data.map(row => ({ ...row._embedded?.show, episodeDate: row.airdate, episodeNumber: row.number, episodeSeason: row.season }));
    }
    const shows = [...new Map(rows.filter(row => row?.id).map(row => [row.id, row])).values()];
    const items = shows.filter(row => query.kind !== 'anime' || row.type === 'Animation').filter(row => query.kind !== 'documentary' || row.type === 'Documentary').filter(row => query.kind !== 'variety' || ['Variety', 'Reality', 'Talk Show', 'Game Show'].includes(row.type)).map(row => ({ ...itemBase('tvmaze', row.id, row.name, safeUrl(row.url, ['tvmaze.com'])), poster: safeUrl(row.image?.medium, ['tvmaze.com']), score: score(row.rating?.average), ratingState: score(row.rating?.average) ? 'rated' : 'unrated', year: /^\d{4}/.test(row.premiered) ? +row.premiered.slice(0, 4) : null, date: text(row.episodeDate || row.premiered), genres: strings((row.genres || []).map(genre => EN_GENRES[genre] || genre)), regions: [regionName(row.network?.country?.code || row.webChannel?.country?.code)].filter(Boolean), summary: plain(row.summary), episodes: row.episodeNumber ? `第${row.episodeSeason}季 · 第${row.episodeNumber}集` : '', heat: Number(row.weight) || null, heatLabel: '平台权重' })).filter(item => matches(item, query, clock()));
    items.sort((a, b) => query.sort === 'rating' ? (b.score || 0) - (a.score || 0) : query.sort === 'latest' ? b.date.localeCompare(a.date) : (b.heat || 0) - (a.heat || 0));
    return { items: items.slice((query.page - 1) * PAGE_SIZE, query.page * PAGE_SIZE), hasMore: items.length > query.page * PAGE_SIZE, note: query.keyword ? '使用原文剧名搜索更准确。' : '当前播出作品，热门依据平台权重排序，并非全站热搜榜。' };
  }
  async function bilibili(query) {
    if (query.minScore || query.region || query.year !== 'all' || query.sort === 'rating') return { items: [], hasMore: false, unsupported: true, note: '视频搜索无统一评分、首播年份和制作地区；选择不限和热门/最新后可检索。' };
    const keyword = [query.kind === 'ai' ? 'AI漫剧' : query.kind === 'short' ? '短剧' : query.keyword ? '' : '电视剧', query.keyword, query.genre].filter(Boolean).join(' ');
    const params = new URLSearchParams({ search_type: 'video', keyword, order: query.sort === 'latest' ? 'pubdate' : 'click', page: String(query.page) });
    const data = await request('https://api.bilibili.com/x/web-interface/search/type?' + params);
    if (data.code !== 0 || !Array.isArray(data.data?.result)) throw new Error('bilibili access limited');
    return { items: data.data.result.filter(row => row.bvid && /^BV[a-zA-Z0-9]+$/.test(row.bvid)).map(row => ({ ...itemBase('bilibili', row.bvid, plain(row.title), `https://www.bilibili.com/video/${row.bvid}/`), poster: safeUrl(row.pic, ['hdslb.com']), summary: text(row.description, 600), heat: Number(row.play) || null, heatLabel: '播放', date: row.pubdate ? new Date(row.pubdate * 1000).toISOString().slice(0, 10) : '', cast: [text(row.author)].filter(Boolean) })), hasMore: Number(data.data.numPages) > query.page, note: '平台关键词视频结果，可能包含预告、解说或分集；播放量不作为评分。' };
  }
  const providers = { douban, bangumi, tvmaze, bilibili };
  async function search(input) {
    const query = validateQuery(input, clock());
    const selected = query.source === 'all' ? ['douban', 'bangumi', 'tvmaze', ...(query.kind === 'ai' ? ['bilibili'] : [])] : [query.source];
    const results = await Promise.all(selected.map(async source => {
      try {
        const result = await cached(source + ':' + JSON.stringify(query), () => providers[source](query));
        return { source, label: SOURCES[source], state: result.value.unsupported ? 'unsupported' : result.stale ? 'stale' : 'ok', message: result.value.note || '', updatedAt: new Date(result.time).toISOString(), count: result.value.items.length, ...result.value };
      } catch {
        return { source, label: SOURCES[source], state: 'unavailable', message: source === 'bilibili' ? '平台暂时限制自动检索，可使用下方平台搜索入口。' : '数据源暂时不可用，可稍后重试或切换其他来源。', count: 0, items: [], hasMore: false, updatedAt: null };
      }
    }));
    const items = [];
    // Interleave source rankings; do not invent a comparable cross-platform popularity score.
    for (let index = 0; index < PAGE_SIZE; index++) for (const result of results) if (result.items[index]) items.push(result.items[index]);
    const unique = [...new Map(items.map(item => [item.id, item])).values()];
    if (query.sort === 'rating') unique.sort((a, b) => (b.score || 0) - (a.score || 0));
    return { items: unique, sources: results.map(({ items: _items, ...result }) => result), page: query.page, hasMore: query.page < 50 && results.some(result => result.hasMore), unavailable: results.every(result => ['unavailable', 'unsupported'].includes(result.state)), fetchedAt: clock().toISOString(), notice: '评分来自各自平台，满分10分，不合并计算。热门按来源榜单、收藏量或平台权重交错展示；筛选与收录范围因来源而异。' };
  }
  return { search, detail: async id => { const result = await abstract(id); return { ...result.value, stale: result.stale, updatedAt: new Date(result.time).toISOString() }; } };
}
module.exports = { ...createSeriesService(), createSeriesService, validateQuery, safeUrl, score, SOURCES, KINDS, GENRES, REGIONS };
