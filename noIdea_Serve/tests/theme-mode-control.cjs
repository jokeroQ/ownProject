module.exports = async (page, mode) => {
  await page.locator('.theme-mode-select .el-select__wrapper').click();
  await page.locator('.theme-mode-options.el-popper').getByRole('option', {
    name: mode === 'dark' ? '深色' : '浅色', exact: true,
  }).click();
};
