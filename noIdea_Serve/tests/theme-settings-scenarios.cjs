const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const selectThemeMode = require('./theme-mode-control.cjs');
const { setThemeColor, getThemeColor } = require('./theme-color-control.cjs');

module.exports = async ({ page, api, artifacts }) => {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const getTheme = async () => (await (await fetch(api + '/theme', { headers: { Authorization: `Bearer ${token}` } })).json()).data;
  const applied = () => page.evaluate(() => {
    const root = document.documentElement, style = getComputedStyle(root);
    return { mode: root.dataset.theme, color: style.getPropertyValue('--el-color-primary').trim(),
      overlay: style.getPropertyValue('--theme-overlay').trim(), background: style.getPropertyValue('--theme-background-image').trim(),
      hasBackground: root.dataset.hasBackground };
  });
  const dialog = page.getByRole('dialog', { name: '我的主题', exact: true });
  const saveButton = () => dialog.getByRole('button', { name: '保存设置', exact: true });
  const open = async () => { await page.getByRole('button', { name: '主题设置', exact: true }).click(); await dialog.waitFor(); };
  const close = async () => { await dialog.getByRole('button', { name: '关闭', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); };
  const waitApplied = async (mode, color, background = false) => page.waitForFunction(expected => {
    const root = document.documentElement;
    return root.dataset.theme === expected.mode && root.style.getPropertyValue('--el-color-primary') === expected.color &&
      root.dataset.hasBackground === String(expected.background);
  }, { mode, color, background });
  const save = async background => {
    const response = page.waitForResponse(res => new URL(res.url()).pathname === (background ? '/api/theme/background' : '/api/theme') && res.request().method() === 'PUT');
    await saveButton().click(); assert.equal((await response).status(), 200);
    await page.waitForFunction(() => !document.querySelector('.theme-settings')?.closest('.el-dialog')?.querySelector('.el-button.is-loading'));
  };
  const baseline = await applied(), initial = await getTheme();
  await open();
  await selectThemeMode(page, 'dark');
  await setThemeColor(page, '#e11d48');
  await page.getByRole('button', { name: '使用主题色 #7c3aed', exact: true }).click();
  await page.locator('#theme-overlay').evaluate(input => { input.value = '0.65'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.deepEqual(await applied(), baseline); assert.deepEqual(await getTheme(), initial);
  await close(); await open();
  assert.equal((await page.locator('.theme-mode-select').innerText()).trim(), '浅色');
  assert.equal(await getThemeColor(page), '#409eff');
  assert.equal(await page.locator('#theme-overlay').inputValue(), '0.35');
  await selectThemeMode(page, 'dark');
  await dialog.getByRole('button', { name: /close|关闭此对话框/i }).click();
  await dialog.waitFor({ state: 'hidden' }); assert.deepEqual(await applied(), baseline);
  await open(); await setThemeColor(page, '#e11d48');
  await dialog.getByRole('button', { name: '关闭', exact: true }).focus(); await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' }); assert.deepEqual(await applied(), baseline);
  console.log('PASS: mode, color, preset and overlay remain drafts; close button, X and Escape discard changes');

  await open(); await selectThemeMode(page, 'dark'); await setThemeColor(page, '#7c3aed');
  const matchTheme = url => url.pathname === '/api/theme';
  let release;
  const held = async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return; }
    await new Promise(resolve => { release = resolve; }); await route.continue();
  };
  await page.route(matchTheme, held); await saveButton().click();
  await page.waitForFunction(() => document.querySelector('.el-dialog .el-button.is-loading'));
  assert.deepEqual(await applied(), baseline); assert.deepEqual(await getTheme(), initial);
  release(); await waitApplied('dark', '#7c3aed'); await page.unroute(matchTheme, held);
  assert.equal((await getTheme()).primaryColor, '#7c3aed');
  await close(); await page.reload(); await page.getByRole('button', { name: '主题设置', exact: true }).waitFor();
  await waitApplied('dark', '#7c3aed'); const saved = await applied();
  console.log('PASS: saved theme only applies after server success and survives reload');

  await open(); await selectThemeMode(page, 'light'); await setThemeColor(page, '#059669');
  const fail = async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return; }
    await route.fulfill({ status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ message: '测试保存失败' }) });
  };
  await page.route(matchTheme, fail); await saveButton().click(); await page.getByText('测试保存失败', { exact: true }).waitFor();
  assert.deepEqual(await applied(), saved); assert.equal((await getTheme()).primaryColor, '#7c3aed');
  assert.equal(await getThemeColor(page), '#059669');
  await page.unroute(matchTheme, fail); await close();
  console.log('PASS: failed save retains the existing theme and keeps the editable draft');

  const image = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#059669' } }).png().toBuffer();
  const selectImage = () => page.locator('#theme-file').setInputFiles({ name: 'background.png', mimeType: 'image/png', buffer: image });
  await open(); await selectImage(); await dialog.locator('.theme-preview').waitFor();
  assert.deepEqual(await applied(), saved); assert.equal((await getTheme()).hasBackground, false);
  await close(); await open(); assert.equal(await dialog.locator('.theme-preview').count(), 0);
  await selectImage(); await selectThemeMode(page, 'light'); await setThemeColor(page, '#059669');
  assert.deepEqual(await applied(), saved); await save(true); await waitApplied('light', '#059669', true);
  assert.deepEqual(await getTheme(), { mode: 'light', primaryColor: '#059669', overlay: 0.35, hasBackground: true });
  const withImage = await applied();
  await dialog.getByRole('button', { name: '移除图片', exact: true }).click();
  assert.deepEqual(await applied(), withImage); assert.equal((await getTheme()).hasBackground, true);
  await close(); await open(); await dialog.locator('.theme-preview').waitFor();
  await dialog.getByRole('button', { name: '移除图片', exact: true }).click(); await save(false); await waitApplied('light', '#059669');
  assert.equal((await getTheme()).hasBackground, false);
  console.log('PASS: image upload and removal are drafts; close discards them and save applies them together with colors');

  await dialog.getByRole('button', { name: '恢复默认', exact: true }).click();
  await page.locator('.el-message-box').getByRole('button', { name: '恢复', exact: true }).click();
  assert.equal((await applied()).color, '#059669'); assert.equal((await getTheme()).primaryColor, '#059669');
  assert.equal(await getThemeColor(page), '#409eff');
  await close(); await open(); assert.equal(await getThemeColor(page), '#059669');
  await dialog.getByRole('button', { name: '恢复默认', exact: true }).click();
  await page.locator('.el-message-box').getByRole('button', { name: '恢复', exact: true }).click();
  await save(false); await waitApplied('light', '#409eff'); assert.deepEqual(await getTheme(), initial);
  console.log('PASS: restore defaults only changes the draft until saved');
  await page.setViewportSize({ width: 390, height: 844 }); await selectThemeMode(page, 'dark');
  assert.equal((await applied()).mode, 'light');
  if (artifacts) {
    fs.mkdirSync(artifacts, { recursive: true });
    await page.waitForFunction(() => ![...document.querySelectorAll('.el-message')].some(element => element.getBoundingClientRect().height > 0));
    await page.screenshot({ path: path.join(artifacts, 'unsaved-mobile.png'), fullPage: true });
  }
  await close(); await page.goto(new URL('/chat', page.url()).href); await waitApplied('light', '#409eff');
  console.log('PASS: mobile and other pages retain the saved theme');
};
