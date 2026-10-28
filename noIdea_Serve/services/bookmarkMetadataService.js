const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');
const ipaddr = require('ipaddr.js');
const { Parser } = require('htmlparser2');

const MAX_BYTES = 1024 * 1024;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const isPublicAddress = address => {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) ip = ip.toIPv4Address();
    return ip.range() === 'unicast';
  } catch { return false; }
};
const parseUrl = input => {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048) throw fail('请输入有效的 http(s) 网站地址');
  let url;
  try { url = new URL(input.trim()); } catch { throw fail('请输入完整的 http(s) 网站地址'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port))) throw fail('仅支持不含账号密码的标准 http(s) 网站地址');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(hostname) ||
      (ipaddr.isValid(hostname) && !isPublicAddress(hostname))) throw fail('自动获取仅支持公网网站，站内页面请使用路由地址');
  url.hash = '';
  return url;
};
const abortable = (promise, signal) => new Promise((resolve, reject) => {
  const abort = () => reject(fail('获取网站信息超时，请稍后重试', 504));
  promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
});

async function publicTarget(input, signal, lookup) {
  const url = parseUrl(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = ipaddr.isValid(hostname)
      ? [{ address: hostname, family: ipaddr.parse(hostname).kind() === 'ipv6' ? 6 : 4 }]
      : await abortable(lookup(hostname, { all: true, verbatim: true }), signal);
  } catch (error) {
    if (error.status) throw error;
    throw fail('无法解析网站地址，请检查网址后重试', 502);
  }
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw fail('自动获取仅支持公网网站');
  return { url, address: addresses.find(item => item.family === 4) || addresses[0] };
}

function requestPage(url, address, signal, request) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error, data) => {
      if (done) return;
      done = true;
      if (error) reject(error); else resolve(data);
    };
    const req = request(url, {
      method: 'GET', agent: false, signal,
      // Pin the validated address; a second DNS resolution must not reach a private host.
      lookup: (_hostname, options, callback) => options.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { 'User-Agent': 'noIdea-Bookmark/1.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
    }, res => {
      res.on('error', error => finish(error));
      const result = { status: res.statusCode, headers: res.headers, body: Buffer.alloc(0) };
      const type = res.headers['content-type'] || '';
      if (res.statusCode < 200 || res.statusCode >= 300 || (type && !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type))) {
        finish(null, result); res.destroy(); return;
      }
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      const decoder = { gzip: zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress }[encoding];
      if (encoding && encoding !== 'identity' && !decoder) { finish(fail('网站使用了不支持的网页编码', 502)); res.destroy(); return; }
      const stream = decoder ? res.pipe(decoder()) : res;
      let received = 0, decoded = 0;
      const chunks = [];
      const stop = error => { finish(error); stream.destroy(); res.destroy(); req.destroy(); };
      if (decoder) res.on('data', chunk => { received += chunk.length; if (received > MAX_BYTES) stop(fail('网页内容过大，请手动填写', 502)); });
      stream.on('error', error => finish(error));
      stream.on('data', chunk => {
        decoded += chunk.length;
        if (decoded > MAX_BYTES) return stop(fail('网页内容过大，请手动填写', 502));
        chunks.push(chunk);
        const body = Buffer.concat(chunks);
        if (/<\/head\s*>/i.test(body.toString('latin1'))) {
          finish(null, { ...result, body }); stream.destroy(); res.destroy(); req.destroy();
        }
      });
      stream.on('end', () => finish(null, { ...result, body: Buffer.concat(chunks) }));
    });
    req.on('error', error => finish(error));
    req.end();
  });
}

function decodeHtml(body, contentType = '') {
  const beginning = body.subarray(0, 8192).toString('latin1');
  const declared = /charset\s*=\s*["']?\s*([^\s;"'/>]+)/i.exec(contentType)?.[1] ||
    /<meta\b[^>]*charset\s*=\s*["']?\s*([^\s;"'/>]+)/i.exec(beginning)?.[1];
  const encoding = body[0] === 0xff && body[1] === 0xfe ? 'utf-16le'
    : body[0] === 0xfe && body[1] === 0xff ? 'utf-16be' : declared || 'utf-8';
  try { return new TextDecoder(encoding).decode(body); }
  catch { return new TextDecoder('utf-8').decode(body); }
}
const cleanTitle = value => value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, 255).replace(/[\uD800-\uDBFF]$/, '');

function extractMetadata(html, pageUrl) {
  let title = '', siteName = '', applicationName = '', ogTitle = '', inTitle = false, sawTitle = false, base = pageUrl;
  const icons = [];
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'title' && !sawTitle) { inTitle = true; sawTitle = true; }
      if (name === 'base' && attrs.href && base === pageUrl) {
        try { base = parseUrl(new URL(attrs.href, pageUrl).href).href; } catch { /* Ignore unsafe base URLs. */ }
      }
      if (name === 'meta' && attrs.content) {
        const key = (attrs.property || attrs.name || '').toLowerCase();
        if (key === 'og:site_name' && !siteName) siteName = attrs.content;
        if (key === 'application-name' && !applicationName) applicationName = attrs.content;
        if (key === 'og:title' && !ogTitle) ogTitle = attrs.content;
      }
      if (name === 'link' && attrs.href && icons.length < 20) {
        const rel = (attrs.rel || '').toLowerCase().split(/\s+/);
        const rank = rel.includes('icon') ? 3 : rel.includes('apple-touch-icon') ? 2 : rel.includes('mask-icon') ? 1 : 0;
        if (rank) icons.push({ href: attrs.href, rank });
      }
    },
    ontext(text) { if (inTitle) title += text; },
    onclosetag(name) { if (name === 'title') inTitle = false; },
  }, { decodeEntities: true });
  parser.end(html);
  const candidates = icons.sort((a, b) => b.rank - a.rank).flatMap(icon => {
    try { const url = parseUrl(new URL(icon.href, base).href).href; return url.length <= 255 ? [url] : []; }
    catch { return []; }
  });
  return { title: cleanTitle(siteName || applicationName || title || ogTitle), icons: candidates };
}

function createMetadataService({ lookup = dns.lookup.bind(dns), request = (url, options, callback) =>
  (url.protocol === 'https:' ? https : http).request(url, options, callback) } = {}) {
  return async input => {
    const signal = AbortSignal.timeout(8000);
    try {
      let target = await publicTarget(input, signal, lookup);
      for (let redirects = 0; redirects <= 3; redirects++) {
        const response = await requestPage(target.url, target.address, signal, request);
        if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
          if (redirects === 3) throw fail('网站重定向次数过多，请手动填写', 502);
          target = await publicTarget(new URL(response.headers.location, target.url).href, signal, lookup);
          continue;
        }
        const metadata = extractMetadata(decodeHtml(response.body, response.headers['content-type']), target.url.href);
        let icon = new URL('/favicon.ico', target.url).href;
        for (const candidate of metadata.icons) {
          try { await publicTarget(candidate, signal, lookup); icon = candidate; break; }
          catch (error) { if (signal.aborted) throw error; }
        }
        return { title: metadata.title, icon: icon.length <= 255 ? icon : '', url: target.url.href };
      }
    } catch (error) {
      if (error.status) throw error;
      if (signal.aborted) throw fail('获取网站信息超时，请稍后重试', 504);
      if (['EACCES', 'EPERM'].includes(error.code)) throw fail('后端访问外网被系统拒绝，请检查后端运行权限或防火墙设置', 502);
      throw fail('暂时无法读取网站信息，请稍后重试或手动填写', 502);
    }
  };
}

module.exports = { readMetadata: createMetadataService(), createMetadataService, extractMetadata, decodeHtml, isPublicAddress };
