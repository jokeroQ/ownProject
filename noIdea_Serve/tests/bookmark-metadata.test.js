const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { gzipSync } = require('node:zlib');
const { createMetadataService, extractMetadata, decodeHtml, isPublicAddress } = require('../services/bookmarkMetadataService');

function fixture(pages, lookup = async () => [{ address: '8.8.8.8', family: 4 }]) {
  const calls = [];
  const request = (url, options, callback) => {
    const req = new EventEmitter();
    req.destroy = () => {};
    req.end = () => queueMicrotask(() => {
      calls.push({ url: url.href, options });
      const page = pages[url.href] || {};
      if (page.error) { req.emit('error', page.error); return; }
      const res = new PassThrough();
      res.statusCode = page.status || 200;
      res.headers = { 'content-type': 'text/html; charset=utf-8', ...page.headers };
      callback(res);
      res.end(page.body || '');
    });
    return req;
  };
  return { read: createMetadataService({ lookup, request }), calls };
}

test('解析网站名称、实体字符、base 地址和标准图标', () => {
  const metadata = extractMetadata(`<head><title>文章标题</title>
    <meta property="og:site_name" content=" 示例 &amp; 网站 ">
    <base href="https://assets.example.com/app/">
    <link rel="apple-touch-icon" href="touch.png"><link rel="shortcut icon" href="../icon.svg?v=2">
    <link rel="icon" href="javascript:alert(1)"></head>`, 'https://example.com/path');
  assert.deepEqual(metadata, { title: '示例 & 网站', icons: [
    'https://assets.example.com/icon.svg?v=2', 'https://assets.example.com/app/touch.png',
  ] });
  assert.equal(extractMetadata('<title>  标题\n &lt;b&gt;示例&lt;/b&gt; </title>', 'https://example.com').title, '标题 <b>示例</b>');
  assert.equal(extractMetadata('<meta name="application-name" content="应用名称">', 'https://example.com').title, '应用名称');
  assert.equal(extractMetadata('<meta property="og:title" content="分享标题">', 'https://example.com').title, '分享标题');
  assert.equal(extractMetadata(`<title>${'a'.repeat(254)}😀</title>`, 'https://example.com').title, 'a'.repeat(254));
});

test('支持 UTF-8、GBK 声明和 UTF-16 BOM', () => {
  assert.equal(decodeHtml(Buffer.from('测试网站')), '测试网站');
  const gbk = Buffer.from('b2e2cad4cdf8d5be', 'hex');
  assert.equal(decodeHtml(gbk, 'text/html; charset=gbk'), '测试网站');
  assert.ok(decodeHtml(Buffer.concat([Buffer.from('<meta charset="gb2312">'), gbk])).endsWith('测试网站'));
  assert.equal(decodeHtml(Buffer.concat([Buffer.from([255, 254]), Buffer.from('测试网站', 'utf16le')])), '测试网站');
});

test('读取压缩网页、跟随跳转并固定已验证的 DNS 地址', async () => {
  const { read, calls } = fixture({
    'https://example.com/start': { status: 302, headers: { location: '/page' } },
    'https://example.com/page': { headers: { 'content-encoding': 'gzip' }, body: gzipSync('<head><title>外部网站</title><link rel="icon" href="/site.svg"></head>') },
  });
  assert.deepEqual(await read('https://example.com/start#ignored'), {
    title: '外部网站', icon: 'https://example.com/site.svg', url: 'https://example.com/page',
  });
  assert.equal(calls.length, 2);
  for (const { options } of calls) {
    assert.equal(options.agent, false);
    assert.equal(options.headers.Authorization, undefined);
    options.lookup('example.com', {}, (error, address, family) => {
      assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
    });
    options.lookup('example.com', { all: true }, (error, addresses) => {
      assert.equal(error, null); assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
    });
  }
});

test('缺少图标时回退网站 favicon，非 HTML 或受限页面不伪造标题', async () => {
  for (const page of [{ body: '<title>只有名称</title>' }, { status: 403, body: '<title>Access denied</title>' },
    { headers: { 'content-type': 'image/png' }, body: '<title>不是网页</title>' }]) {
    const { read } = fixture({ 'https://example.com/': page });
    const result = await read('https://example.com');
    assert.equal(result.icon, 'https://example.com/favicon.ico');
    assert.equal(result.title, page.body === '<title>只有名称</title>' ? '只有名称' : '');
  }
});

test('拒绝本地、私有、保留 IP、混合 DNS 和非标准地址', async () => {
  for (const address of ['127.0.0.1', '0.0.0.0', '10.0.0.1', '172.16.0.1', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1'])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  const { read, calls } = fixture({});
  for (const url of [null, {}, '', '/chat', '//example.com', 'file:///etc/passwd', 'javascript:alert(1)',
    'https://user:pass@example.com', 'http://localhost', 'http://foo.local', 'http://host.internal',
    'http://127.0.0.1', 'http://2130706433', 'http://0x7f000001', 'http://[::ffff:127.0.0.1]', 'http://example.com:3306'])
    await assert.rejects(read(url), error => error.status === 400, String(url));
  assert.equal(calls.length, 0);
  const mixed = fixture({}, async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]);
  await assert.rejects(mixed.read('https://example.com'), error => error.status === 400);
  assert.equal(mixed.calls.length, 0);
});

test('每次跳转重新校验地址，图标中的私有地址被忽略', async () => {
  const privateRedirect = fixture({ 'https://example.com/': { status: 302, headers: { location: 'http://169.254.169.254/' } } });
  await assert.rejects(privateRedirect.read('https://example.com'), error => error.status === 400);
  assert.equal(privateRedirect.calls.length, 1);
  const privateIcon = fixture({ 'https://example.com/': { body: '<title>安全网页</title><link rel="icon" href="https://icons.example.com/private.svg">' } },
    async host => [{ address: host === 'icons.example.com' ? '192.168.0.1' : '8.8.8.8', family: 4 }]);
  assert.equal((await privateIcon.read('https://example.com')).icon, 'https://example.com/favicon.ico');
  const loop = fixture({ 'https://example.com/': { status: 302, headers: { location: '/' } } });
  await assert.rejects(loop.read('https://example.com'), error => error.status === 502 && /重定向/.test(error.message));
  assert.equal(loop.calls.length, 4);
});

test('限制网页和解压后体积，网络错误可读', async () => {
  for (const compressed of [false, true]) {
    const oversized = fixture({ 'https://example.com/': { body: compressed ? gzipSync('x'.repeat(1024 * 1024 + 1)) : 'x'.repeat(1024 * 1024 + 1),
      ...(compressed ? { headers: { 'content-encoding': 'gzip' } } : {}) } });
    await assert.rejects(oversized.read('https://example.com'), error => error.status === 502 && /过大/.test(error.message));
  }
  const broken = fixture({ 'https://example.com/': { error: new Error('ECONNRESET') } });
  await assert.rejects(broken.read('https://example.com'), error => error.status === 502 && /手动填写/.test(error.message));
});

test('网络权限拒绝明确提示后端运行环境问题', async () => {
  for (const code of ['EACCES', 'EPERM']) {
    const denied = fixture({ 'https://example.com/': { error: Object.assign(new Error('connect ' + code), { code }) } });
    await assert.rejects(denied.read('https://example.com'), error => error.status === 502 && /后端访问外网被系统拒绝/.test(error.message));
  }
});
