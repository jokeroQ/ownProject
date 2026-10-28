const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateColorCards } = require('../services/colorCards');
const { validateOptions } = require('../services/dinnerService');
test('色卡限制为安全颜色和独立自定义变量，分别保留深浅色', () => {
  assert.deepEqual(validateColorCards([{ label: '品牌', variable: '--custom-brand', light: '#ABCDEF', dark: '#123456ff' }]), [{ label: '品牌', variable: '--custom-brand', light: '#abcdef', dark: '#123456ff' }]);
  for (const variable of ['--app-height', '--theme-background-image', '--el-color-primary', '--custom-', 'color:red', '--custom-中']) assert.throws(() => validateColorCards([{ label: '颜色', variable, light: '#ffffff' }]), { status: 400 });
  for (const light of ['url(https://example.test)', 'red;display:none', 'var(--custom-b)', '', '#fff', '#invalid']) assert.throws(() => validateColorCards([{ label: '颜色', variable: '--custom-brand', light }]), { status: 400 });
  const card = { label: '辅助文字', variable: '--theme-muted', light: '#445566' };
  assert.throws(() => validateColorCards([card, card]), { status: 400 });
  assert.throws(() => validateColorCards(Array(61).fill(card)), { status: 400 });
  assert.deepEqual(validateColorCards([card]), [card]);
});
test('晚餐选项去除空白并限制数量、长度和重复', () => {
  assert.deepEqual(validateOptions([' 火锅 ', '饺子']), ['火锅', '饺子']);
  for (const options of [null, [], ['火锅'], ['火锅', ' 火锅 '], ['火锅', ''], ['火锅', 3], ['火锅', '面'.repeat(13)], Array.from({ length: 17 }, (_, index) => String(index))]) assert.throws(() => validateOptions(options), { status: 400 });
});
