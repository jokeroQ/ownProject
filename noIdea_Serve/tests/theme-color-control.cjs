exports.setThemeColor = async (page, color) => {
  await page.locator('.theme-color-picker .el-color-picker__trigger').click();
  const panel = page.locator('.theme-color-options:visible').first();
  await panel.locator('input').fill(color);
  await panel.getByRole('button', { name: '确定', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
};
exports.getThemeColor = async page => {
  const rgb = await page.locator('.theme-color-picker .el-color-picker__color-inner').evaluate(el => getComputedStyle(el).backgroundColor);
  return '#' + rgb.match(/\d+/g).slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('');
};
