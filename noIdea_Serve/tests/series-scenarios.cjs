const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({ page, api, artifacts }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(25000);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const request = async (route, auth = token) => {
    const response = await fetch(api + route, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await request('/series', null)).status, 401);
  assert.equal((await request('/series/poster?url=https%3A%2F%2Flocalhost%2Fx', null)).status, 401);
  assert.equal((await request('/series/poster?url=https%3A%2F%2Flocalhost%2Fx')).status, 400);
  assert.equal((await request('/series?source=invalid')).status, 400);
  assert.equal((await request('/series?page=-1')).status, 400);
  assert.equal((await require('../migrations/series')()).added, 3);
  assert.equal((await require('../migrations/series')()).added, 0);
  const menus = (await request('/menu/getMenus')).body.data;
  const category = menus.find(menu => menu.menuLists.some(item => item.targetUrl === '/series'));
  assert.ok(category);
  const registered = await fetch(api + '/users/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'series-new-user', password: 'browser-password', email: 'series-new@example.test' }) });
  assert.equal(registered.status, 201);
  const login = await fetch(api + '/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'series-new-user', password: 'browser-password' }) });
  const newToken = (await login.json()).token;
  assert.ok((await request('/menu/getMenus', newToken)).body.data.some(menu => menu.menuLists.some(item => item.targetUrl === '/series')));
  console.log('PASS: 登录保护、参数校验、入口迁移幂等与新用户继承');
  await page.reload();
  await page.locator(`[data-category="${category.id}"]`).click();
  const requestedPosters = new Set();
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/series/poster') requestedPosters.add(url.searchParams.get('url')); });
  const initial = page.waitForResponse(response => new URL(response.url()).pathname === '/api/series' && response.status() === 200);
  await page.locator('.bookmark-title').getByText('最新剧集检索', { exact: true }).click();
  await page.waitForURL(url => url.pathname === '/series');
  const live = (await (await initial).json()).data;
  assert.ok(live.items.length > 0, 'Real network results are required');
  assert.ok(live.sources.filter(source => source.state === 'ok').length >= 2, JSON.stringify(live.sources));
  assert.ok(live.items.some(item => item.score !== null));
  await page.locator('.series-card').first().waitFor();
  const settle = async () => page.waitForFunction(() => document.querySelector('.series-results')?.getAttribute('aria-busy') === 'false');
  const capture = async name => { if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, name + '.png') }); } };
  await settle();
  const posterSources = live.sources.filter(source => source.state === 'ok' && live.items.some(item => item.source === source.source && item.poster)).map(source => source.source);
  await page.waitForFunction(sources => sources.every(source => [...document.querySelectorAll(`[data-series-id^="${source}:"] img`)].some(img => img.complete && img.naturalWidth > 0 && img.getBoundingClientRect().height > 100)), posterSources, { timeout: 25000 });
  const distant = [...live.items].reverse().find(item => item.poster && !requestedPosters.has(item.poster));
  assert.ok(distant, 'Offscreen posters are not requested on first render');
  const scrolledRequest = page.waitForRequest(request => { const url = new URL(request.url()); return url.pathname === '/api/series/poster' && url.searchParams.get('url') === distant.poster; });
  await page.locator(`[data-series-id="${distant.id}"]`).scrollIntoViewIfNeeded();
  await scrolledRequest;
  await page.locator('.series-page').evaluate(node => node.scrollTo({ top: 0, behavior: 'instant' }));
  console.log('PASS: 屏外海报不提前请求，滚动接近后才加载');
  await capture('series-desktop-live');
  assert.equal(new URL(page.url()).searchParams.get('fromCategory'), String(category.id));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('PASS: 首页入口、真实多源结果、现有评分、来源标签与返回分类参数');

  async function select(index, label) {
    await page.locator('.filter-field').nth(index).locator('.el-select__wrapper').click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await settle();
  }
  await select(0, '豆瓣');
  await select(3, '不限年份');
  const search = page.waitForResponse(response => new URL(response.url()).pathname === '/api/series' && new URL(response.url()).searchParams.get('keyword') === '狂飙');
  await page.getByRole('textbox', { name: '剧集关键词' }).fill('狂飙');
  await page.getByRole('button', { name: '检索', exact: true }).click();
  const searched = (await (await search).json()).data;
  assert.ok(searched.items.some(item => item.title === '狂飙' && item.score > 0), JSON.stringify(searched));
  await settle();
  await page.getByRole('button', { name: '查看狂飙详情', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '作品详情', exact: true });
  await dialog.locator('dd').first().waitFor();
  assert.ok(await dialog.getByText('2023', { exact: true }).isVisible());
  assert.equal(new URL(await dialog.getByRole('link', { name: '前往豆瓣' }).getAttribute('href')).hostname, 'movie.douban.com');
  for (const [width, height] of [[1280, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => !document.querySelector('.dialog-fade-enter-active'));
    const box = await dialog.boundingBox();
    assert.ok(box.width <= width && box.x >= -1 && box.x + box.width <= width + 1, `Dialog fits ${width}`);
    await capture(`series-detail-${width}`);
  }
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  console.log('PASS: 全站关键词检索、真实评分补全、详情来源链接及桌面/手机/横屏弹窗');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('textbox', { name: '剧集关键词' }).fill('');
  await page.getByRole('button', { name: '短剧', exact: true }).click();
  await settle();
  assert.ok(await page.getByLabel('拓展平台搜索').isVisible());
  await select(4, '7 分及以上');
  const shortResult = (await request('/series?source=douban&kind=short&year=all&minScore=7')).body.data;
  assert.ok(shortResult.items.length > 0);
  assert.ok(shortResult.items.every(item => item.score >= 7));
  await settle();
  await page.getByRole('button', { name: '最新', exact: true }).click();
  await settle();
  assert.equal(new URL(page.url()).searchParams.get('sort'), 'latest');
  await page.getByRole('button', { name: 'AI剧', exact: true }).click();
  await settle();
  assert.ok((await page.getByRole('link', { name: 'B站检索' }).getAttribute('href')).includes('search.bilibili.com'));
  assert.ok(decodeURIComponent(await page.getByRole('link', { name: '抖音 / 红果相关' }).getAttribute('href')).includes('AI短剧'));
  await capture('series-ai-coverage');
  console.log('PASS: 短剧分类、最低评分过滤、最新排序与 AI 跨平台检索入口');

  await page.getByRole('button', { name: '重置筛选', exact: true }).first().click();
  await settle();
  // The app's normal theme function renders both themes without modifying real account preferences.
  for (const mode of ['light', 'dark']) {
    await page.evaluate(async mode => { const theme = await import('/src/utils/theme.ts'); theme.applyTheme({ ...theme.themeState.settings, mode }); }, mode);
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.filter-field, .series-card, .results-toolbar')].every(node => { const box = node.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; })), `No overflow ${mode} ${width}`);
      await capture(`series-${mode}-${width}`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: '返回收藏', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/home');
  assert.equal(new URL(page.url()).searchParams.get('category'), String(category.id));
  assert.deepEqual(errors, []);
  console.log('PASS: 四种视口、深浅色、无横向溢出及返回原分类，无运行时错误');
};
