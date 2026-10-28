const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = async ({ page, api, artifacts }) => {
  artifacts ||= fs.mkdtempSync(path.join(os.tmpdir(), 'map-continuous-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const origin = new URL(page.url()).origin, results = [], errors = [], external = [];
  const pendingRequests = new Set();
  page.on('request', request => pendingRequests.add(request.url()));
  page.on('requestfinished', request => pendingRequests.delete(request.url()));
  page.on('requestfailed', request => pendingRequests.delete(request.url()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const user = await page.evaluate(() => JSON.parse(localStorage.getItem('user')));
  const storageKey = 'ownproject:map-markers:v1:' + user.id;
  page.on('pageerror', error => errors.push(error.message));
  const record = (check, metrics = {}) => { results.push({ check, passed: true, ...metrics }); console.log('PASS: ' + check); };
  const request = async (method, route, body) => {
    const response = await fetch(api + route, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, route); return response.json();
  };
  const ready = async () => {
    await page.locator('.map-page[data-map-code="100000"][data-map-ready="true"]').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-map-canvas] svg path').length > 0);
  };
  const cityReady = async () => { await page.locator('.map-page[data-map-level="city"][data-city-loading="false"]').waitFor(); };
  const mapText = name => page.locator('[data-map-canvas] svg text').filter({ hasText: new RegExp('^' + name + '$') }).first();
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), storageKey);
  const state = () => page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(url => url.includes('/echarts_core.js'));
    const echarts = await import(url);
    const chart = echarts.getInstanceByDom(document.querySelector('[data-map-canvas]')), geo = chart.getOption().geo[0];
    const source = echarts.getMap(geo.map).geoJSON;
    return { map: geo.map, zoom: geo.zoom, center: geo.center, bounds: geo.boundingCoords,
      point: chart.convertToPixel({ geoId: 'china' }, [113.2644, 23.1291]),
      regions: source.features.filter(feature => feature.properties.name).map(feature => ({ name: feature.properties.name, provinceCode: feature.properties.provinceCode })),
      series: chart.getOption().series[0].data.length };
  });
  const sameView = (a, b) => { assert.equal(a.zoom, b.zoom); assert.deepEqual(a.center, b.center); assert.deepEqual(a.bounds, b.bounds); assert.ok(Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]) < 1, 'Switching detail preserves geographic pixel coordinates'); };
  const openList = async () => { await page.getByRole('button', { name: '标记点列表', exact: true }).click(); await page.getByRole('dialog').filter({ hasText: '标记点（' }).waitFor(); };
  const listDialog = () => page.getByRole('dialog').filter({ hasText: '标记点（' });
  const closeList = async () => { await listDialog().getByRole('button', { name: '关闭', exact: true }).click(); await listDialog().waitFor({ state: 'hidden' }); };
  const province = async name => { await page.locator('.province-select .el-select__wrapper').click(); await page.locator('.map-province-options').getByRole('option', { name, exact: true }).click(); };
  const city = async name => { await page.locator('.city-select .el-select__wrapper').click(); await page.locator('.map-city-options').getByRole('option', { name, exact: true }).click(); };
  const layout = async label => {
    const metrics = await page.evaluate(() => {
      const r = document.querySelector('[data-map-canvas]').getBoundingClientRect(), footer = document.querySelector('.map-footer').getBoundingClientRect(), workspace = getComputedStyle(document.querySelector('.map-workspace'));
      return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight, mapHeight: r.height, transparent: workspace.backgroundColor === 'rgba(0, 0, 0, 0)' && workspace.borderWidth === '0px', footerVisible: footer.top >= 0 && footer.bottom <= innerHeight && footer.right <= innerWidth };
    });
    assert.ok(metrics.transparent && metrics.footerVisible && metrics.mapHeight > 100 && metrics.pageWidth <= metrics.width + 1 && metrics.pageHeight <= metrics.height + 1, label + ': ' + JSON.stringify(metrics));
    record(label, metrics);
  };
  const settle = async () => { await page.mouse.move(0, 0); await page.waitForTimeout(220); };
  const screenshot = async name => { await settle(); await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true }); };
  try {
    const menus = (await request('GET', '/menu/getMenus')).data;
    const category = menus.find(menu => menu.menuLists.some(item => item.targetUrl === '/map'));
    let release;
    const gate = new Promise(resolve => { release = resolve; }), requests = [];
    let fail = true;
    const subdivisionUrl = url => /\/maps\/provinces\/\d+\.json$/.test(url.pathname);
    await page.route(subdivisionUrl, async route => {
      // Vite also serves ?url imports at these paths; only delay the actual GeoJSON fetches.
      if (route.request().resourceType() !== 'fetch') return route.continue();
      requests.push(new URL(route.request().url()).pathname);
      await gate;
      if (fail && new URL(route.request().url()).pathname.endsWith('/440000.json')) return route.fulfill({ status: 503, body: 'Intentional city boundary failure' });
      return route.continue();
    });
    await page.locator('[data-category="' + category.id + '"]').click();
    await page.locator('.draggable-item').filter({ hasText: '可视化地图' }).click(); await ready();
    assert.equal((await state()).regions.length, 34); assert.equal(requests.length, 0);
    await mapText('四川').click();
    assert.equal((await state()).zoom, 1); assert.equal((await state()).map, 'china-provinces'); assert.equal(requests.length, 0);
    await layout('national transparent map; province click selects without drilling down');
    if (process.env.MAP_DIAGNOSE_ONLY === '1') { await screenshot('runtime-map'); return; }
    await page.evaluate(({ key }) => localStorage.setItem(key, JSON.stringify([{ id: 'legacy-guangzhou', name: '旧广州标记', lng: 113.2644, lat: 23.1291, provinceCode: 440000, provinceName: '广东省', regionName: '广州市' }])), { key: storageKey });
    await page.reload(); await ready();
    await mapText('旧广州标记').waitFor();
    for (let index = 0; index < 5; index++) await page.getByRole('button', { name: '放大', exact: true }).click();
    await page.locator('.map-page[data-city-loading="true"]').waitFor();
    assert.equal((await state()).map, 'china-provinces');
    const mapBounds = await page.locator('[data-map-canvas]').boundingBox();
    await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
    await page.mouse.down(); await page.mouse.move(mapBounds.x + mapBounds.width / 2 + 50, mapBounds.y + mapBounds.height / 2 + 25, { steps: 8 }); await page.mouse.up();
    await settle();
    const pendingView = await state();
    assert.ok(pendingView.center, 'Panning changes the actual geographic center while details are loading');
    release();
    await page.getByRole('alert').filter({ hasText: '市级边界加载失败' }).waitFor();
    sameView(pendingView, await state());
    fail = false;
    await page.getByRole('button', { name: '重试', exact: true }).click(); await cityReady();
    const detailedView = await state();
    sameView(pendingView, detailedView); assert.equal(detailedView.regions.length, 370);
    assert.equal(detailedView.series, 1);
    assert.equal(requests.filter(url => url.endsWith('/440000.json')).length, 2);
    const downloadCount = requests.length;
    await page.getByRole('button', { name: '缩小', exact: true }).click();
    await page.locator('.map-page[data-map-level="province"]').waitFor();
    assert.deepEqual((await state()).center, detailedView.center);
    await page.getByRole('button', { name: '放大', exact: true }).click(); await cityReady();
    assert.equal(requests.length, downloadCount, 'City data is reused across threshold crossings');
    record('continuous zoom retains center, zoom and marker pixel position; failed details retain the map and retry; boundary files load lazily and are cached', { requests: downloadCount, regions: detailedView.regions.length });
    await page.unroute(subdivisionUrl);
    await page.context().route(/^https?:\/\//, route => {
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(route.request().url()).hostname)) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const beforeWheel = (await state()).zoom;
    await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
    await page.mouse.wheel(0, -220);
    await page.waitForFunction(zoom => Number(document.querySelector('.map-page').dataset.mapZoom) > zoom, beforeWheel);
    assert.equal(await page.locator('.map-page').getAttribute('data-map-code'), '100000');
    record('real mouse-wheel zoom and pan stay in the same national coordinate system');
    await province('广东省'); await city('广州市'); await cityReady(); await settle();
    assert.equal((await state()).zoom, 12); assert.equal((await state()).map, 'china-cities');
    await page.getByRole('button', { name: '添加标记', exact: true }).click();
    await mapText('广州市').click(); await mapText('深圳市').click(); await page.keyboard.press('Escape');
    assert.equal((await stored()).length, 3); assert.equal((await state()).series, 3);
    await mapText('旧广州标记').click();
    const editor = page.getByRole('dialog', { name: '编辑标记', exact: true }); await editor.waitFor();
    assert.equal(await editor.getByRole('textbox', { name: '标记地址', exact: true }).inputValue(), '');
    assert.equal(await editor.getByRole('textbox', { name: '标记备注', exact: true }).inputValue(), '');
    await editor.getByRole('textbox', { name: '标记名称', exact: true }).fill('不保存的名字');
    await editor.getByRole('button', { name: '取消', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
    assert.equal((await stored()).find(marker => marker.id === 'legacy-guangzhou').name, '旧广州标记');
    await mapText('旧广州标记').click(); await editor.waitFor();
    await editor.getByRole('textbox', { name: '标记名称', exact: true }).fill('广州办公室');
    await editor.getByRole('textbox', { name: '标记地址', exact: true }).fill('天河区测试路88号');
    await editor.getByRole('textbox', { name: '标记备注', exact: true }).fill('项目现场\n开放时间 09:00–18:00');
    const longitude = editor.getByRole('spinbutton').nth(0), latitude = editor.getByRole('spinbutton').nth(1);
    await longitude.fill('0'); await latitude.fill('0');
    await editor.getByRole('button', { name: '保存标记', exact: true }).click();
    await page.getByText('坐标需要位于中国地图区域内', { exact: true }).waitFor();
    assert.ok(await editor.isVisible());
    await longitude.fill('113.544372'); await latitude.fill('23.329249');
    await editor.getByRole('button', { name: '保存标记', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
    const saved = (await stored()).find(marker => marker.id === 'legacy-guangzhou');
    assert.equal(saved.name, '广州办公室'); assert.equal(saved.address, '天河区测试路88号'); assert.equal(saved.description, '项目现场\n开放时间 09:00–18:00');
    assert.equal(saved.lng, 113.544372); assert.equal(saved.regionName, '广州市');
    await settle();
    const officeLabel = await mapText('广州办公室').boundingBox(), nearbyLabel = await mapText('标记 1').boundingBox();
    assert.ok(officeLabel && nearbyLabel && (officeLabel.y + officeLabel.height <= nearbyLabel.y + 1 || nearbyLabel.y + nearbyLabel.height <= officeLabel.y + 1 || officeLabel.x + officeLabel.width <= nearbyLabel.x || nearbyLabel.x + nearbyLabel.width <= officeLabel.x), 'Nearby marker names remain readable without overlapping');
    await screenshot('cities-and-markers');
    await page.reload(); await ready(); await openList();
    assert.equal(await page.locator('[data-marker-row]').count(), 3);
    assert.match(await page.locator('[data-marker-row="legacy-guangzhou"]').innerText(), /测试路88号/);
    assert.match(await page.locator('[data-marker-row="legacy-guangzhou"]').innerText(), /开放时间/);
    await page.getByRole('button', { name: '定位 广州办公室', exact: true }).click(); await cityReady();
    assert.equal((await state()).zoom, 8); assert.deepEqual((await state()).center, [saved.lng, saved.lat]);
    await openList(); await page.getByRole('button', { name: '删除 标记 2', exact: true }).click(); await closeList();
    assert.equal((await stored()).length, 2);
    record('legacy marker compatibility, multiple points, cancellation, coordinate validation, editable name/address/notes, refresh persistence, focus and deletion');
    await province('北京市'); await cityReady();
    assert.equal(await page.locator('.city-select').count(), 0);
    while (await page.getByRole('button', { name: '放大', exact: true }).isEnabled()) await page.getByRole('button', { name: '放大', exact: true }).click();
    const maximum = await state(); assert.equal(maximum.zoom, 24);
    assert.deepEqual(maximum.regions.filter(region => region.provinceCode === 110000).map(region => region.name), ['北京市']);
    assert.deepEqual(maximum.regions.filter(region => region.provinceCode === 810000).map(region => region.name), ['香港特别行政区']);
    assert.ok(!maximum.regions.some(region => region.name === '东城区'));
    await mapText('北京市').click(); assert.equal((await state()).zoom, 24);
    await page.getByRole('button', { name: '适配当前地图', exact: true }).click();
    await page.locator('.map-page[data-map-level="province"][data-map-zoom="1"]').waitFor();
    assert.equal((await state()).regions.length, 34);
    record('maximum zoom stops at city geometry; municipalities remain whole cities; region click never drills down; fit returns to national view');
    const bobResponse = await fetch(api + '/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'browser-bob', password: 'browser-password' }) });
    assert.ok(bobResponse.ok); const bob = await bobResponse.json();
    await page.evaluate(login => { localStorage.setItem('token', login.token); localStorage.setItem('user', JSON.stringify(login.user)); }, bob);
    await page.goto(origin + '/map'); await ready(); await openList(); assert.equal(await page.locator('[data-marker-row]').count(), 0); await closeList();
    await page.evaluate(login => { localStorage.setItem('token', login.token); localStorage.setItem('user', JSON.stringify(login.user)); }, { token, user });
    await page.goto(origin + '/map'); await ready(); await openList(); assert.equal(await page.locator('[data-marker-row]').count(), 2); await closeList();
    record('marker information remains isolated by account');
    const settings = (await request('GET', '/theme')).data;
    for (const mode of ['light', 'dark']) {
      await request('PUT', '/theme', { ...settings, mode });
      for (const [width, height] of [[320, 568], [390, 844], [1366, 768], [844, 390]]) {
        await page.setViewportSize({ width, height }); await page.goto(origin + '/map'); await ready();
        await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
        await layout(mode + '-' + width + ' national map');
        await province('广东省'); await city('广州市'); await cityReady(); await settle();
        await layout(mode + '-' + width + ' continuously zoomed city map');
        await openList(); await page.getByRole('button', { name: '编辑 广州办公室', exact: true }).click(); await editor.waitFor();
        await page.waitForFunction(() => !document.querySelector('.dialog-fade-enter-active'));
        const box = await editor.boundingBox();
        assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
        assert.equal(await editor.getByRole('textbox', { name: '标记地址', exact: true }).inputValue(), saved.address);
        const save = editor.getByRole('button', { name: '保存标记', exact: true }); await save.click({ trial: true });
        if (width === 320 || width === 1366) await screenshot('marker-editor-' + mode + '-' + width);
        await editor.getByRole('button', { name: '取消', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
        if (width === 390 || width === 1366) await screenshot('city-map-' + mode + '-' + width);
        await page.setViewportSize({ width: width + 20, height: height + 15 }); await layout(mode + '-' + width + ' live resize');
      }
    }
    await page.getByRole('button', { name: '返回收藏', exact: true }).click(); await page.waitForURL(url => url.pathname === '/home');
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    record('local assets, clean unmount and runtime health');
  } catch (error) {
    console.error('Map browser context:', page.url(), errors);
    console.error('Pending frontend resources:', [...pendingRequests].slice(0, 12));
    console.error('Frontend root:', await page.locator('#app').innerHTML().then(html => html.slice(0, 300)));
    results.push({ check: 'continuous city map scenario', passed: false, message: error.message });
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); throw error;
  } finally { fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(results, null, 2)); }
  console.log('Continuous city map browser audit: ' + results.length + ' checks passed');
};
