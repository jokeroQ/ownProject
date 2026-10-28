const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ page, api, artifacts }) => {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function request(method, route, body, expected = 200, auth = token) {
    const response = await fetch(api + route, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${route}: ${result.message || ''}`);
    return result.data || result;
  }
  const menus = () => request('GET', '/menu/getMenus');
  const source = await request('POST', '/menu/addMenus', { title: '框选来源' }, 201);
  const target = await request('POST', '/menu/addMenus', { title: '整组目标' }, 201);
  const cards = [], anchors = [];
  for (const name of ['甲', '乙', '丙', '丁']) cards.push(await request('POST', `/menu/addSubmenus/${source.id}`, { title: '框选书签' + name, targetUrl: '/test' }, 201));
  for (const name of ['前', '后']) anchors.push(await request('POST', `/menu/addSubmenus/${target.id}`, { title: '目标书签' + name, targetUrl: '/test' }, 201));
  await request('PUT', '/menu/order', { ids: [source.id, target.id, ...(await menus()).map(menu => menu.id).filter(id => ![source.id, target.id].includes(id))] });
  const card = id => page.locator(`[data-bookmark-id="${id}"]`);
  const selected = () => page.locator('[data-bookmark-id].is-selected').evaluateAll(nodes => nodes.map(node => Number(node.dataset.bookmarkId)));
  const check = async ids => assert.deepEqual((await selected()).sort((a, b) => a - b), [...ids].sort((a, b) => a - b));
  const toolbar = page.getByLabel('批量书签操作');
  async function marquee(ids, key, cancel = false) {
    const boxes = await Promise.all(ids.map(id => card(id).boundingBox()));
    assert.ok(boxes.every(Boolean));
    const left = Math.min(...boxes.map(box => box.x)) - 5;
    const top = Math.min(...boxes.map(box => box.y)) - 5;
    const right = Math.max(...boxes.map(box => box.x + box.width)) + 4;
    const bottom = Math.max(...boxes.map(box => box.y + box.height)) + 4;
    if (key) await page.keyboard.down(key);
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, bottom, { steps: 12 });
    assert.equal(await page.locator('[data-bookmark-marquee]').count(), 1);
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
    if (key) await page.keyboard.up(key);
    assert.equal(await page.locator('[data-bookmark-marquee]').count(), 0);
  }
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.goto(new URL('/home', page.url()).toString());
  await page.locator(`[data-category="${source.id}"]`).click();
  await page.getByRole('button', { name: '编辑书签', exact: true }).click();
  await card(cards[0].id).locator('.edit').waitFor();
  assert.equal(await page.locator('main input[type="checkbox"]').count(), 0, 'No card or select-all checkboxes');
  await marquee(cards.slice(0, 2).map(item => item.id));
  await check(cards.slice(0, 2).map(item => item.id));
  const appearance = await card(cards[0].id).evaluate(node => ({ border: getComputedStyle(node).borderTopColor, primary: getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim(), shadow: getComputedStyle(node).boxShadow }));
  assert.match(appearance.shadow, /inset/, 'Selection highlights the original card border');
  await marquee([cards[2].id], 'Control');
  await check(cards.slice(0, 3).map(item => item.id));
  await marquee([cards[3].id], undefined, true);
  await check(cards.slice(0, 3).map(item => item.id));
  await card(cards[2].id).locator('.bookmark-title').click();
  await check(cards.slice(0, 2).map(item => item.id));
  if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'home-border-selection.png') }); }
  console.log('PASS: 鼠标框选、Ctrl 追加、Escape 取消、点击增减选择及无复选框边框高亮');

  // A real native drag must send the full selection in one request, ahead of the anchor.
  const moved = page.waitForResponse(response => response.url().includes('/menu/subMenus/batch') && response.request().method() === 'POST');
  await card(cards[1].id).dragTo(card(anchors[1].id));
  const response = await moved;
  assert.equal(response.status(), 200);
  assert.deepEqual(response.request().postDataJSON().ids.sort((a, b) => a - b), cards.slice(0, 2).map(item => item.id).sort((a, b) => a - b));
  await page.getByText('已移动 2 个书签', { exact: true }).waitFor();
  let all = await menus();
  assert.deepEqual(all.find(menu => menu.id === source.id).menuLists.map(item => item.id), cards.slice(2).map(item => item.id));
  assert.deepEqual(all.find(menu => menu.id === target.id).menuLists.map(item => item.id), [anchors[0].id, cards[0].id, cards[1].id, anchors[1].id]);
  await check(cards.slice(0, 2).map(item => item.id));
  assert.equal(await page.locator('.is-dragging').count(), 0);
  console.log('PASS: 拖动已选卡片时整组跨分类插入、顺序一致且保留选择');

  const sorted = page.waitForResponse(response => response.url().includes('/menu/subMenus/batch') && response.request().method() === 'POST');
  await card(cards[0].id).dragTo(card(anchors[0].id));
  assert.equal((await sorted).status(), 200);
  await page.getByText('已移动 2 个书签', { exact: true }).last().waitFor();
  assert.deepEqual((await menus()).find(menu => menu.id === target.id).menuLists.map(item => item.id), [cards[0].id, cards[1].id, anchors[0].id, anchors[1].id]);
  await card(cards[0].id).dragTo(card(cards[1].id));
  await check(cards.slice(0, 2).map(item => item.id));
  assert.deepEqual((await menus()).find(menu => menu.id === target.id).menuLists.map(item => item.id), [cards[0].id, cards[1].id, anchors[0].id, anchors[1].id]);

  // Backend insertion is atomic; a foreign/missing anchor must not move any selected card.
  await request('POST', '/menu/subMenus/batch', { action: 'move', ids: cards.slice(2).map(item => item.id), menuId: target.id, beforeId: 2147483647 }, 404);
  assert.deepEqual((await menus()).find(menu => menu.id === source.id).menuLists.map(item => item.id), cards.slice(2).map(item => item.id));
  await request('POST', '/menu/subMenus/batch', { action: 'move', ids: [cards[1].id, cards[0].id], menuId: target.id, beforeId: anchors[0].id });
  assert.deepEqual((await menus()).find(menu => menu.id === target.id).menuLists.map(item => item.id), [cards[0].id, cards[1].id, anchors[0].id, anchors[1].id]);
  await request('POST', '/menu/subMenus/batch', { action: 'move', ids: cards.slice(0, 2).map(item => item.id), menuId: target.id, beforeId: cards[0].id });
  assert.deepEqual((await menus()).find(menu => menu.id === target.id).menuLists.map(item => item.id), [cards[0].id, cards[1].id, anchors[0].id, anchors[1].id]);
  console.log('PASS: 同分类整组排序、选中项作为落点无副作用、无效落点事务回滚');

  await page.reload();
  await page.getByRole('button', { name: '编辑书签', exact: true }).click();
  const editable = (await menus()).flatMap(menu => menu.menuLists).filter(item => item.can_edit).map(item => item.id);
  await toolbar.getByRole('button', { name: '全选', exact: true }).click();
  await check(editable);
  await toolbar.getByRole('button', { name: '取消全选', exact: true }).click();
  await check([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(`[data-category="${target.id}"]`).click();
  await card(cards[0].id).locator('.bookmark-title').click();
  await check([cards[0].id]);
  await toolbar.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).last().click();
  assert.ok((await menus()).find(menu => menu.id === target.id).menuLists.some(item => item.id === cards[0].id));
  await check([cards[0].id]);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile has no horizontal overflow');
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'home-mobile-selection.png') });
  console.log('PASS: 全选/取消全选、手机点击选择、批量删除取消保留内容及窄屏布局');

  // A regular user must never select locked cards, including when marquee scrolling.
  const alice = await request('POST', '/users/login', { username: 'browser-alice', password: 'browser-password' });
  const aliceMenus = await request('GET', '/menu/getMenus', undefined, 200, alice.token);
  const first = aliceMenus[0];
  const locked = first.menuLists.filter(item => !item.can_edit);
  assert.ok(locked.length);
  const own = [];
  for (let index = 0; index < 12; index++) own.push(await request('POST', `/menu/addSubmenus/${first.id}`, { title: '滚动框选' + index, targetUrl: '/test' }, 201, alice.token));
  await page.evaluate(login => { localStorage.setItem('token', login.token); localStorage.setItem('user', JSON.stringify(login.user)); }, alice);
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto(new URL('/home', page.url()).toString());
  await page.locator(`[data-category="${first.id}"]`).click();
  await page.getByRole('button', { name: '编辑书签', exact: true }).click();
  await marquee([locked[0].id]);
  await check([]);
  const box = await card(locked[0].id).boundingBox();
  const viewport = await page.locator('main.el-main').boundingBox();
  const initialScroll = await page.locator('main.el-main').evaluate(node => node.scrollTop);
  await page.mouse.move(box.x - 5, box.y - 5);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width - 8, viewport.y + viewport.height - 8, { steps: 10 });
  await page.waitForFunction(start => document.querySelector('main.el-main').scrollTop > start + 160 && document.querySelectorAll('[data-bookmark-id].is-selected').length > 0, initialScroll);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, 'home-marquee-scrolling.png') });
  await page.mouse.up();
  assert.equal(await page.locator('[data-bookmark-marquee]').count(), 0);
  assert.ok((await selected()).every(id => own.some(item => item.id === id)), 'Marquee only selects editable cards');
  await toolbar.getByRole('button', { name: '全选', exact: true }).click();
  await check(own.map(item => item.id));
  await page.setViewportSize({ width: 320, height: 568 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px viewport has no horizontal overflow');
  console.log('PASS: 框选自动滚动、只读项目排除、普通用户全选权限及 320px 适配');
  assert.deepEqual(errors, []);
};
