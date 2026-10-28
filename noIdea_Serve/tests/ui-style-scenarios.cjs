const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

module.exports = async ({ page, api, artifacts }) => {
  artifacts ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ui-style-audit-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const results = [], token = await page.evaluate(() => localStorage.getItem('token'));
  const origin = new URL(page.url()).origin;
  const request = async (method, route, body) => {
    const response = await fetch(api + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok); return (await response.json()).data;
  };
  const sizes = (process.env.UI_AUDIT_VIEWPORTS || '1366x768,390x844,320x568,844x390').split(',')
    .map(value => { const [width, height] = value.split('x').map(Number); return { width, height }; });
  let mode, size;
  page.setDefaultTimeout(7000);
  page.on('dialog', dialog => dialog.accept());
  const go = async route => {
    await page.goto(origin + route);
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
  };
  const cancel = async element => {
    await element.getByRole('button', { name: '取消', exact: true }).click(); await element.waitFor({ state: 'hidden' });
  };
  const ownCategory = await request('POST', '/menu/addMenus', { title: '弹出控件样式检查' });
  const inspect = async (name, element, kind = 'form') => {
    await element.waitFor();
    await element.evaluate(async el => {
      const animations = [];
      for (let node = el; node && node !== document.body; node = node.parentElement) animations.push(...node.getAnimations());
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    });
    const data = await element.evaluate(el => {
      const rect = target => { const r = target.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, cy: r.y + r.height / 2 }; };
      const title = el.querySelector('.el-message-box__title,.el-dialog__title');
      const close = el.querySelector('.el-message-box__headerbtn,.el-dialog__headerbtn');
      const footer = el.querySelector('.el-message-box__btns,.el-dialog__footer');
      return { bounds: rect(el), title: title && rect(title), close: close && rect(close), footer: footer && rect(footer),
        actions: footer ? [...footer.querySelectorAll('.el-button')].filter(button => button.getBoundingClientRect().height).map(rect) : [],
        background: getComputedStyle(el).backgroundColor,
        border: footer && getComputedStyle(footer).borderTopWidth,
        overflow: el.scrollWidth > el.clientWidth + 1 };
    });
    assert.ok(data.bounds.x >= -1 && data.bounds.right <= size.width + 1 && data.bounds.y >= -1 && data.bounds.bottom <= size.height + 1, name + ' must fit the screen');
    assert.equal(data.overflow, false, name + ' must not overflow horizontally');
    if (kind === 'confirmation') {
      assert.ok(data.bounds.width <= 400.5, name + ' must remain compact');
      assert.ok(data.bounds.height <= Math.min(size.height - 20, 300), name + ' must not be oversized');
      assert.ok(data.actions.every(action => Math.abs(action.height - 32) <= 1));
    }
    if (data.title && data.close) assert.ok(Math.abs(data.title.cy - data.close.cy) <= 2, name + ' title and close action must align');
    if (data.footer) assert.equal(data.border, '0px', name + ' footer must not add a divider');
    if ([390, 1366].includes(size.width) && ['restore', 'bookmark', 'admin-edit', 'flow-leave', 'theme-color'].includes(name))
      await page.screenshot({ path: path.join(artifacts, `${mode}-${size.width}-${name}.png`), fullPage: true });
    results.push({ check: `${mode}-${size.width}x${size.height}-${name}`, passed: true, ...data });
  };
  const run = async (name, action) => {
    try { await action(); console.log(`PASS: ${mode}-${size.width}x${size.height} ${name}`); }
    catch (error) {
      results.push({ check: `${mode}-${size.width}x${size.height}-${name}`, passed: false, message: error.message });
      await page.screenshot({ path: path.join(artifacts, `failure-${mode}-${size.width}-${name}.png`), fullPage: true });
      console.log(`FAIL: ${mode}-${size.width} ${name}: ${error.message.split('\n')[0]}`);
    }
  };
  try {
    for (mode of ['light', 'dark']) {
      await request('PUT', '/theme', { mode, primaryColor: '#409eff', overlay: 0.35 });
      for (size of sizes) {
        await page.setViewportSize(size);
        await run('home-forms', async () => {
          await go('/home'); await page.locator('[data-home-add-category]').click();
          const category = page.locator('.el-dialog:visible'); await inspect('category', category); await cancel(category);
          await page.locator('[data-home-edit-mode]').click(); await page.locator('[data-home-add-bookmark]').first().click();
          const bookmark = page.locator('.bookmark-edit-dialog'); await inspect('bookmark', bookmark); await cancel(bookmark);
          const ownCategoryItem = page.locator(`[data-category="${ownCategory.id}"]`);
          await ownCategoryItem.hover();
          await ownCategoryItem.locator('.edit svg').last().click();
          const popover = page.locator('.el-popover.el-popper:visible'); await inspect('delete-category', popover, 'popover');
          assert.ok((await popover.locator('.el-button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height))).every(height => height === 32));
          await popover.getByRole('button', { name: '取消', exact: true }).click(); await popover.waitFor({ state: 'hidden' });
        });
        await run('theme-and-restore', async () => {
          await go('/home'); await page.getByRole('button', { name: '主题设置', exact: true }).click();
          const theme = page.locator('.theme-settings-dialog'); await inspect('theme', theme);
          await page.locator('.theme-mode-select .el-select__wrapper').click();
          const options = page.locator('.theme-mode-options.el-popper:visible'); await inspect('theme-options', options, 'popover');
          await options.getByRole('option', { name: mode === 'dark' ? '浅色' : '深色', exact: true }).click();
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), mode);
          await page.locator('.theme-color-picker .el-color-picker__trigger').click();
          const colorPanel = page.locator('.theme-color-options:visible').first();
          await inspect('theme-color', colorPanel, 'popover');
          await colorPanel.locator('input').press('Escape'); await colorPanel.waitFor({ state: 'hidden' });
          await theme.getByRole('button', { name: '恢复默认', exact: true }).click();
          const confirmation = page.locator('.el-message-box'); await inspect('restore', confirmation, 'confirmation');
          await cancel(confirmation); assert.ok(await theme.isVisible());
          await theme.getByRole('button', { name: '关闭', exact: true }).click();
        });
        await run('logout', async () => {
          await go('/home'); await page.locator('[data-home-logout]').click();
          const confirmation = page.locator('.el-message-box'); await inspect('logout', confirmation, 'confirmation'); await cancel(confirmation);
        });
        await run('admin', async () => {
          await go('/admin/users'); await page.locator('[data-admin-edit]').first().click();
          const edit = page.locator('.admin-user-dialog:visible'); await inspect('admin-edit', edit);
          await edit.locator('.el-select__wrapper').click();
          const roles = page.locator('.admin-role-dropdown.el-popper:visible'); await inspect('admin-role', roles, 'popover');
          await edit.getByRole('textbox', { name: '用户名', exact: true }).click(); await cancel(edit);
          await page.locator('[data-admin-reset-password]').first().click();
          const password = page.locator('.admin-user-dialog:visible'); await inspect('password', password); await cancel(password);
          await page.locator('.admin-page-size .el-select__wrapper').click();
          const options = page.locator('.el-select__popper:visible'); await inspect('pagination-options', options, 'popover');
          await options.getByRole('option', { name: '10 条', exact: true }).click();
        });
        await run('flow-confirmations', async () => {
          await go('/flowchart'); await page.locator('[data-node]').first().waitFor();
          const document = (await request('GET', '/flowchart')).document;
          await page.locator('input[type=file]').setInputFiles({ name: 'style-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
          const imported = page.locator('.el-message-box'); await inspect('flow-import', imported, 'confirmation'); await cancel(imported);
          await page.getByRole('button', { name: '+ 步骤', exact: true }).click();
          await page.getByRole('button', { name: '返回收藏', exact: true }).click();
          const leave = page.locator('.el-message-box'); await inspect('flow-leave', leave, 'confirmation');
          await leave.getByRole('button', { name: '继续编辑', exact: true }).click();
          await page.getByRole('button', { name: '撤销', exact: true }).click();
        });
      }
    }
  } finally { fs.writeFileSync(path.join(artifacts, 'ui-style-report.json'), JSON.stringify(results, null, 2)); }
  const failed = results.filter(result => !result.passed);
  assert.equal(failed.length, 0, failed.map(result => result.check + ': ' + result.message).join('\n'));
  console.log(`UI style audit: ${results.length} overlay checks passed`);
};
