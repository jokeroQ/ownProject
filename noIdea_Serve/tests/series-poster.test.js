const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePosterUrl, imageType, createPosterService } = require('../services/seriesPosterService');
test('海报只允许已接入CDN的固定图片路径，拒绝内网、任意端口与非图片', () => {
  const valid = 'https://img2.doubanio.com/view/photo/s_ratio_poster/public/p2886376181.jpg';
  assert.equal(validatePosterUrl(valid), valid);
  for (const value of ['http://127.0.0.1/x', valid + '?url=http://localhost', valid.replace('.com/', '.com:8443/'), 'https://img2.doubanio.com.evil.test/a.jpg', 'https://img2.doubanio.com/admin', ['x'], 'file:///tmp/x']) assert.throws(() => validatePosterUrl(value), { status: 400 });
  assert.throws(() => imageType(Buffer.from('<html>captcha</html>')), { status: 502 });
});
test('切换筛选后取消的排队海报不再下载，不拖慢新列表', async () => {
  let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const service = createPosterService({ download: async () => { calls++; await gate; return { body: Buffer.from([255, 216, 255]) }; } });
  const first = Array.from({ length: 4 }, (_, index) => service.get(`https://static.tvmaze.com/uploads/images/medium_portrait/1/${index}.jpg`));
  const controller = new AbortController();
  const cancelled = assert.rejects(service.get('https://static.tvmaze.com/uploads/images/medium_portrait/1/9.jpg', controller.signal), { status: 499 });
  controller.abort(); release(); await Promise.all([...first, cancelled]);
  assert.equal(calls, 4);
});
test('滚动加载多个海报时下载并发受限，队列正常释放', async () => {
  let active = 0, peak = 0;
  const service = createPosterService({ download: async () => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return { body: Buffer.from([255, 216, 255]) }; } });
  const result = await Promise.all(Array.from({ length: 12 }, (_, index) => service.get(`https://static.tvmaze.com/uploads/images/medium_portrait/1/${index}.jpg`)));
  assert.equal(result.length, 12); assert.ok(peak <= 4); assert.equal(active, 0);
});
test('海报请求缓存与并发合并，不将错误页当图片展示', async () => {
  let calls = 0;
  const service = createPosterService({ download: async () => { calls++; await new Promise(resolve => setImmediate(resolve)); return { body: Buffer.from([255, 216, 255, 0]), type: 'text/html' }; } });
  const url = 'https://static.tvmaze.com/uploads/images/medium_portrait/1/2.jpg';
  const [first, second] = await Promise.all([service.get(url), service.get(url)]);
  assert.equal(calls, 1); assert.deepEqual(first.body, second.body); assert.equal(first.type, 'image/jpeg');
  await service.get(url); assert.equal(calls, 1);
  await assert.rejects(createPosterService({ download: async () => ({ body: Buffer.from('denied') }) }).get(url), { status: 502 });
});
