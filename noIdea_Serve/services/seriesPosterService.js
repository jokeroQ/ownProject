const https = require('node:https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function validatePosterUrl(value) {
  if (typeof value !== 'string' || value.length > 1024) throw fail('海报地址不正确');
  let url;
  try { url = new URL(value); } catch { throw fail('海报地址不正确'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw fail('不支持的海报地址');
  const patterns = {
    'img1.doubanio.com': /^\/view\/photo\/s_ratio_poster\/public\/p\d{4,12}\.jpg$/,
    'img2.doubanio.com': /^\/view\/photo\/s_ratio_poster\/public\/p\d{4,12}\.jpg$/,
    'img3.doubanio.com': /^\/view\/photo\/s_ratio_poster\/public\/p\d{4,12}\.jpg$/,
    'img9.doubanio.com': /^\/view\/photo\/s_ratio_poster\/public\/p\d{4,12}\.jpg$/,
    'lain.bgm.tv': /^\/(?:r\/\d+\/)?pic\/cover\/[a-z]\/\w{2}\/\w{2}\/[\w-]+\.(?:jpg|jpeg|png|webp)$/,
    'static.tvmaze.com': /^\/uploads\/images\/(?:medium_portrait|medium_landscape|original_untouched)\/\d+\/\d+\.(?:jpg|jpeg|png|webp)$/,
  };
  if (!patterns[url.hostname]?.test(url.pathname) || url.search || url.hash) throw fail('只支持已接入来源的海报');
  return url.href;
}
function imageType(body) {
  if (body.length >= 3 && body[0] === 255 && body[1] === 216 && body[2] === 255) return 'image/jpeg';
  if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  throw fail('来源未返回有效海报', 502);
}
function downloadImage(url) {
  const signal = AbortSignal.timeout(6000);
  const proxyHosts = (process.env.SERIES_PROXY_HOSTS || 'api.bgm.tv,lain.bgm.tv').split(',').map(value => value.trim());
  const proxy = proxyHosts.includes(new URL(url).hostname) ? process.env.SERIES_PROXY_URL : '';
  return new Promise((resolve, reject) => {
    const request = https.get(url, { signal, agent: proxy ? new HttpsProxyAgent(proxy) : false, headers: { 'User-Agent': 'noIdea-Series/1.0', Referer: url.includes('doubanio.com') ? 'https://movie.douban.com/' : url.includes('bgm.tv') ? 'https://bgm.tv/' : 'https://www.tvmaze.com/', Accept: 'image/jpeg,image/png,image/webp' } }, response => {
      response.on('error', reject);
      if (response.statusCode !== 200 || Number(response.headers['content-length']) > 1024 * 1024) { response.destroy(); reject(fail('海报来源暂时不可用', 502)); return; }
      const chunks = []; let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 1024 * 1024) { request.destroy(fail('海报过大', 502)); return; } chunks.push(chunk); });
      response.on('end', () => { const body = Buffer.concat(chunks); try { resolve({ body, type: imageType(body) }); } catch (error) { reject(error); } });
    });
    request.on('error', reject);
  });
}
function createPosterService({ download = downloadImage, clock = Date.now } = {}) {
  const cache = new Map(), pending = new Map(), queue = [];
  let active = 0, cacheBytes = 0;
  async function get(value, signal) {
    const url = validatePosterUrl(value);
    const existing = cache.get(url);
    if (existing && clock() - existing.time < 60 * 60 * 1000) return existing;
    if (pending.has(url)) { const work = pending.get(url); work.readers.push(() => !signal?.aborted); return work.promise; }
    if (queue.length >= 48) throw fail('海报加载繁忙，请稍后重试', 429);
    const work = { readers: [() => !signal?.aborted], promise: null };
    pending.set(url, work);
    work.promise = (async () => {
      if (active >= 4) await new Promise(resolve => queue.push(resolve));
      else active++;
      try {
        if (!work.readers.some(reader => reader())) throw fail('海报请求已取消', 499);
        const image = await Promise.resolve().then(() => download(url));
        const result = { ...image, type: imageType(image.body), time: clock() };
        if (image.body.length > 1024 * 1024) throw fail('海报过大', 502);
        const replacing = cache.get(url);
        if (replacing) cacheBytes -= replacing.body.length;
        cache.delete(url); cache.set(url, result); cacheBytes += image.body.length;
        while (cache.size > 128 || cacheBytes > 16 * 1024 * 1024) { const key = cache.keys().next().value; cacheBytes -= cache.get(key).body.length; cache.delete(key); }
        return result;
      } finally { pending.delete(url); const next = queue.shift(); if (next) next(); else active--; }
    })();
    return work.promise;
  }
  return { get };
}
module.exports = { ...createPosterService(), createPosterService, validatePosterUrl, imageType };
