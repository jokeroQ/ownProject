const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readWorkbook, sheetRows, readDocument } = require('./report-export-files.cjs');
module.exports = async ({ page, api, artifacts }) => {
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Report runtime:', error.message); });
  page.on('console', message => { if (message.type() === 'error' || (message.type() === 'warning' && /router|navigation|error|report/i.test(message.text()))) console.error('Report browser:', message.text()); });
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const request = async (method, route, body) => {
    const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await require('../migrations/reports')()).added, 3);
  assert.equal((await require('../migrations/reports')()).added, 0);
  const menus = (await request('GET', '/menu/getMenus')).body.data;
  const category = menus.find(menu => menu.menuLists.some(item => item.targetUrl === '/reports'));
  // Warm the lazily imported date-picker before checking SPA navigation. A cold Vite
  // optimizer can reload the document when it first discovers this dependency.
  const origin = new URL(page.url()).origin;
  await page.goto(origin + '/reports');
  await page.getByText('从今天的第一份记录开始', { exact: true }).waitFor();
  await page.goto(origin + '/home');
  await page.locator(`[data-category="${category.id}"]`).click();
  await page.waitForURL(url => url.pathname === '/home' && url.searchParams.get('category') === String(category.id));
  await page.locator('main.el-main').evaluate(node => new Promise(resolve => {
    let previous = node.scrollTop, stable = 0;
    const check = () => { stable = Math.abs(previous - node.scrollTop) < 0.5 ? stable + 1 : 0; previous = node.scrollTop; if (stable >= 4) resolve(); else requestAnimationFrame(check); };
    requestAnimationFrame(check);
  }));
  await page.locator('.bookmark-title').getByText('工作日报', { exact: true }).click();
  await page.waitForURL(url => url.pathname === '/reports');
  await page.getByText('从今天的第一份记录开始', { exact: true }).waitFor();
  const settle = async () => page.waitForFunction(() => document.querySelector('.report-results')?.getAttribute('aria-busy') === 'false');
  const setDate = async (dialog, name, value) => { const input = dialog.getByRole('combobox', { name, exact: true }); await input.fill(value); await input.press('Enter'); };
  const openNew = async () => {
    await page.getByRole('button', { name: /^写[日周]报$/ }).click();
    const editor = page.getByRole('dialog', { name: '新建报告', exact: true }); await editor.waitFor(); return editor;
  };
  let editor = await openNew();
  assert.ok(await editor.getByRole('button', { name: '保存', exact: true }).isDisabled());
  await setDate(editor, '报告日期', '2026-10-29');
  await editor.getByRole('textbox', { name: '完成工作', exact: true }).fill('完成日报功能联调\n中文,"引号"与多行内容');
  await editor.getByRole('textbox', { name: '后续计划', exact: true }).fill('继续检查手机页面');
  await editor.getByRole('textbox', { name: '问题备注', exact: true }).fill('等待设计确认');
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await editor.waitFor({ state: 'hidden' }); await settle();
  const first = (await request('GET', '/reports')).body.data.items[0];
  assert.equal(first.startDate, '2026-10-29');
  await page.reload(); await settle();
  await page.getByRole('button', { name: '编辑2026-10-29日报', exact: true }).click();
  editor = page.getByRole('dialog', { name: '编辑报告', exact: true });
  assert.equal(await editor.getByRole('textbox', { name: '完成工作', exact: true }).inputValue(), first.accomplishments);
  await editor.getByRole('textbox', { name: '后续计划', exact: true }).fill('未保存的修改');
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  const discard = page.getByRole('dialog', { name: '放弃修改', exact: true });
  await discard.getByRole('button', { name: '继续编辑', exact: true }).click();
  assert.equal(await editor.getByRole('textbox', { name: '后续计划', exact: true }).inputValue(), '未保存的修改');
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  await discard.getByRole('button', { name: '放弃修改', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.equal((await request('GET', '/reports')).body.data.items[0].plans, '继续检查手机页面');
  console.log('PASS: 首页入口、必填约束、日报新增与刷新持久化、全文编辑及放弃修改保护');

  await page.getByRole('button', { name: '编辑2026-10-29日报', exact: true }).click();
  editor = page.getByRole('dialog', { name: '编辑报告', exact: true });
  await editor.getByRole('textbox', { name: '后续计划', exact: true }).fill('修订后的计划');
  const failingRoute = '**/api/reports/' + first.id;
  await page.route(failingRoute, route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: '测试保存失败' }) }) : route.continue());
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('测试保存失败', { exact: true }).waitFor();
  assert.equal(await editor.getByRole('textbox', { name: '后续计划', exact: true }).inputValue(), '修订后的计划');
  await page.unroute(failingRoute);
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await editor.waitFor({ state: 'hidden' }); await settle();
  assert.equal((await request('GET', '/reports')).body.data.items[0].plans, '修订后的计划');
  editor = await openNew();
  await setDate(editor, '报告日期', '2026-10-29');
  await editor.getByRole('textbox', { name: '完成工作', exact: true }).fill('重复日期的内容');
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('这个日期已有同类型报告，请编辑已有记录', { exact: true }).waitFor();
  assert.equal(await editor.getByRole('textbox', { name: '完成工作', exact: true }).inputValue(), '重复日期的内容');
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  await discard.getByRole('button', { name: '放弃修改', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  await page.getByRole('navigation', { name: '报告类型筛选' }).getByRole('button', { name: '周报', exact: true }).click(); await settle();
  editor = await openNew();
  await setDate(editor, '报告日期', '2026-11-01');
  await editor.getByText('本周范围：2026-10-26 — 2026-11-01（周一至周日）', { exact: true }).waitFor();
  await editor.getByRole('textbox', { name: '完成工作', exact: true }).fill('本周完成接口与页面联调');
  await editor.getByRole('textbox', { name: '后续计划', exact: true }).fill('=SUM(1,2)');
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await editor.waitFor({ state: 'hidden' }); await settle();
  await page.getByRole('button', { name: '编辑2026-10-26周报', exact: true }).waitFor();
  console.log('PASS: 保存错误保留输入、重试成功、重复日期冲突反馈及周报周一归档');

  const from = page.getByRole('combobox', { name: '筛选开始日期', exact: true }), to = page.getByRole('combobox', { name: '筛选结束日期', exact: true });
  await from.fill('2026-10-30'); await from.press('Enter'); await settle();
  await to.fill('2026-10-30'); await to.press('Enter'); await settle();
  await page.getByRole('button', { name: '编辑2026-10-26周报', exact: true }).waitFor();
  await page.getByRole('textbox', { name: '搜索报告内容', exact: true }).fill('不存在的工作');
  await page.getByRole('textbox', { name: '搜索报告内容', exact: true }).press('Enter');
  await page.getByText('没有找到匹配的报告', { exact: true }).waitFor();
  await page.getByRole('button', { name: '重置', exact: true }).click(); await settle();
  await page.getByRole('button', { name: '导出报告', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: '导出工作报告', exact: true });
  const chooseFormat = async label => {
    await exportDialog.locator('.el-select').filter({ has: page.getByRole('combobox', { name: '导出文件格式', exact: true }) }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await page.getByRole('option', { name: label, exact: true }).waitFor({ state: 'hidden' });
  };
  assert.ok((await exportDialog.locator('.el-select').first().innerText()).includes('Excel'), 'Excel is the default export format');
  for (const [format, label] of [['xlsx', 'Excel（.xlsx）'], ['docx', 'Word（.docx）'], ['csv', 'CSV（.csv）']]) {
    if (format !== 'xlsx') await page.getByRole('button', { name: '导出报告', exact: true }).click();
    await chooseFormat(label);
    await setDate(exportDialog, '导出开始日期', '2026-10-30');
    await setDate(exportDialog, '导出结束日期', '2026-10-30');
    const [download] = await Promise.all([page.waitForEvent('download'), exportDialog.getByRole('button', { name: '导出', exact: true }).click()]);
    const content = fs.readFileSync(await download.path());
    assert.ok(download.suggestedFilename().endsWith(`2026-10-30_2026-10-30.${format}`));
    if (format === 'xlsx') { const values = sheetRows(await readWorkbook(content)); assert.equal(values.length, 2); assert.equal(values[1][3], '本周完成接口与页面联调'); assert.equal(values[1][4], '=SUM(1,2)'); }
    else if (format === 'docx') { const xml = await readDocument(content); assert.ok(xml.includes('本周完成接口与页面联调')); assert.ok(!xml.includes('完成日报功能联调')); }
    else { const csv = content.toString('utf8'); assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('本周完成接口与页面联调')); assert.ok(csv.includes('"\'=SUM(1,2)"')); assert.ok(!csv.includes('完成日报功能联调')); }
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); fs.writeFileSync(path.join(artifacts, `browser-report.${format}`), content); }
    await exportDialog.waitFor({ state: 'hidden' });
  }
  await page.getByRole('button', { name: '导出报告', exact: true }).click();
  await setDate(exportDialog, '导出开始日期', '2020-01-01');
  await setDate(exportDialog, '导出结束日期', '2020-01-01');
  await exportDialog.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByText('所选范围内没有可导出的报告', { exact: true }).waitFor();
  assert.ok(await exportDialog.isVisible(), 'An empty export keeps its range available for correction');
  await exportDialog.getByRole('button', { name: '取消', exact: true }).click();
  await exportDialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '删除2026-10-26周报', exact: true }).click();
  let confirmation = page.getByRole('dialog', { name: '删除报告', exact: true });
  await confirmation.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '编辑2026-10-26周报', exact: true }).waitFor();
  await page.getByRole('button', { name: '删除2026-10-26周报', exact: true }).click();
  confirmation = page.getByRole('dialog', { name: '删除报告', exact: true });
  await confirmation.getByRole('button', { name: '删除', exact: true }).click(); await settle();
  await page.getByText('从今天的第一份记录开始', { exact: true }).waitFor();
  console.log('PASS: 日期筛选、Excel/Word/CSV格式选择与真实文件下载、空范围反馈、删除确认及取消');

  const { User, UserReport } = require('../models');
  const cara = await User.findOne({ where: { username: 'cara' } });
  await UserReport.bulkCreate(Array.from({ length: 22 }, (_, index) => ({ user_id: cara.id, type: 'daily', period_start: `2026-09-${String(index + 1).padStart(2, '0')}`, period_end: `2026-09-${String(index + 1).padStart(2, '0')}`, accomplishments: `阶段进展${index}：长标题及内容用于检查换行和页面溢出`, plans: '安排下一步', blockers: '' })));
  await page.getByRole('navigation', { name: '报告类型筛选' }).getByRole('button', { name: '全部', exact: true }).click(); await settle();
  await page.getByRole('button', { name: '报告下一页', exact: true }).click(); await settle();
  assert.equal(await page.locator('.report-item').count(), 3);
  await page.goto(origin + '/reports?page=1000&fromCategory=' + category.id);
  await page.waitForURL(url => url.pathname === '/reports' && url.searchParams.get('page') === '2');
  await settle();
  assert.equal(await page.locator('.report-item').count(), 3, 'An out-of-range page goes directly to the final page');
  await page.getByRole('button', { name: '报告上一页', exact: true }).click(); await settle();
  const capture = async name => { if (artifacts) {
    await page.mouse.move(1, 1);
    await page.waitForFunction(() => [...document.querySelectorAll('.el-message')].every(node => getComputedStyle(node).display === 'none' || node.getBoundingClientRect().height === 0), undefined, { timeout: 7000 });
    fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, name + '.png') });
  } };
  for (const mode of ['light', 'dark']) {
    await page.evaluate(async mode => { const theme = await import('/src/utils/theme.ts'); theme.applyTheme({ ...theme.themeState.settings, mode }); }, mode);
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.report-page').evaluate(node => { node.scrollTop = 0; });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.report-header, .report-date-filters, .report-item')].every(node => { const box = node.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; })), `${mode} ${width} fits`);
      await capture(`reports-${mode}-${width}`);
      editor = await openNew();
      await page.waitForFunction(() => !document.querySelector('.dialog-fade-enter-active'));
      assert.ok(await editor.evaluate(node => { const box = node.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1; }));
      assert.ok(await editor.evaluate(node => [...node.querySelectorAll('.app-form-row')].every(row => { const label = row.querySelector('label').getBoundingClientRect(), control = row.children[1].getBoundingClientRect(); return label.right <= control.left && Math.abs(label.top - control.top) < 12; })));
      await capture(`reports-editor-${mode}-${width}`);
      await editor.getByRole('button', { name: '取消', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '导出报告', exact: true }).click();
      await chooseFormat('Word（.docx）');
      await page.waitForFunction(() => !document.querySelector('.dialog-fade-enter-active'));
      assert.ok(await exportDialog.evaluate(node => { const box = node.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1; }));
      assert.ok(await exportDialog.evaluate(node => [...node.querySelectorAll('.app-form-row')].every(row => { const label = row.querySelector('label').getBoundingClientRect(), control = row.children[1].getBoundingClientRect(); return label.right <= control.left && Math.abs(label.top - control.top) < 12; })));
      await capture(`reports-export-${mode}-${width}`);
      await exportDialog.getByRole('button', { name: '取消', exact: true }).click(); await exportDialog.waitFor({ state: 'hidden' });
    }
  }
  console.log('PASS: 分页、320/390/1280/横屏、深浅色、弹窗边界及同行表单');

  await page.setViewportSize({ width: 390, height: 844 });
  const scroller = page.locator('.report-page');
  await scroller.evaluate(node => { node.scrollTop = 0; });
  await page.mouse.move(250, 600); await page.mouse.wheel(0, 550);
  await page.waitForFunction(() => document.querySelector('.report-page').scrollTop > 50);
  assert.equal(await scroller.evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
  await scroller.focus(); await scroller.press('Home'); await scroller.press('PageDown');
  await page.waitForFunction(() => document.querySelector('.report-page').scrollTop > 50);
  await scroller.evaluate(node => { node.scrollTop = 0; });
  editor = await openNew();
  const work = editor.getByRole('textbox', { name: '完成工作', exact: true });
  await work.fill(Array.from({ length: 60 }, (_, index) => '逐行工作记录' + index).join('\n'));
  await work.evaluate(node => { node.scrollTop = 0; });
  await work.press('Control+Home');
  await work.press('Control+End');
  await page.waitForFunction(() => document.querySelector('#report-work').scrollTop > 0);
  assert.equal(await work.evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
  await editor.locator('.el-select').click();
  await page.getByRole('option', { name: '周报', exact: true }).waitFor();
  assert.ok(await page.locator('.el-select-dropdown .el-scrollbar__bar').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => getComputedStyle(node).display === 'none')));
  await page.getByRole('option', { name: '周报', exact: true }).click();
  await editor.getByRole('button', { name: '取消', exact: true }).click(); await discard.getByRole('button', { name: '放弃修改', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '返回收藏', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/home' && url.searchParams.get('category') === String(category.id));
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: 隐藏原生与组件滚动条，页面滚轮/键盘和长文本滚动正常，返回分类及无运行错误');
};
