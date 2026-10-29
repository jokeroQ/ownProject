const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateInput, validateQuery, period, toCsv } = require('../services/reportService');

test('报告日期按日历校验，周报在跨月跨年时仍归入周一至周日', () => {
  assert.deepEqual(period('daily', '2028-02-29'), { period_start: '2028-02-29', period_end: '2028-02-29' });
  assert.deepEqual(period('weekly', '2027-01-03'), { period_start: '2026-12-28', period_end: '2027-01-03' });
  assert.deepEqual(period('weekly', '2027-01-04'), { period_start: '2027-01-04', period_end: '2027-01-10' });
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-1', '2101-01-01', '1899-12-31', null, [], 20261029]) assert.throws(() => period('daily', date), { status: 400 });
});
test('报告只接受支持的字段、真实日期和有内容的完成工作', () => {
  const input = { type: 'daily', date: '2026-10-29', accomplishments: ' 完成联调\n修复问题 ', plans: ' 验证 ', blockers: '' };
  assert.deepEqual(validateInput(input), { type: 'daily', period_start: '2026-10-29', period_end: '2026-10-29', accomplishments: '完成联调\n修复问题', plans: '验证', blockers: '' });
  for (const body of [null, [], {}, { ...input, type: 'monthly' }, { ...input, accomplishments: '' }, { ...input, accomplishments: 'a'.repeat(10001) }, { ...input, plans: '\0' }, { ...input, blockers: {} }, { ...input, user_id: 2 }, { ...input, id: 3 }, { ...input, updated_at: '2026-10-01' }]) assert.throws(() => validateInput(body), { status: 400 });
});
test('报告筛选校验区间顺序、类型、关键词与分页，不接受数组', () => {
  assert.deepEqual(validateQuery(), { type: 'all', from: '', to: '', keyword: '', page: 1 });
  assert.equal(validateQuery({ keyword: '  100%_  ', page: '2' }).keyword, '100%_');
  for (const query of [{ type: 'other' }, { from: '2026-10-30', to: '2026-10-29' }, { to: '2026-99-99' }, { from: [] }, { keyword: 'x'.repeat(121) }, { page: '-1' }, { page: '1.2' }, { page: '1001' }, { page: ['1'] }]) assert.throws(() => validateQuery(query), { status: 400 });
});
test('CSV 保留中文换行、引号与逗号，公式及前置空白按文本导出', () => {
  const row = { type: 'daily', period_start: '2026-10-29', period_end: '2026-10-29', accomplishments: '完成"测试",中文\n第二行', plans: '=SUM(1,2)', blockers: ' \t@危险公式', updated_at: '2026-10-29T00:00:00.000Z' };
  const csv = toCsv([row]);
  assert.ok(csv.startsWith('\uFEFF"类型"'));
  assert.ok(csv.includes('"完成""测试"",中文\n第二行"'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"\' \t@危险公式"'));
  assert.ok(csv.includes('"2026-10-29 08:00:00"'));
  assert.ok(csv.endsWith('\r\n'));
  for (const value of ['+1', '-1', '@SUM(1)', '\t =1', '\n=1', '\uFEFF=1']) assert.ok(toCsv([{ ...row, plans: value }]).includes('"\'' + value + '"'));
});
