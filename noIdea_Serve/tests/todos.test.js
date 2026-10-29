const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDate, validateInput, validateQuery } = require('../services/todoService');
const { getCalendar, isCompleted, periodKey } = require('../services/todoPeriods');
test('待办只接受有效标题、备注和布尔状态，不接受跨账号或只读字段', () => {
  assert.deepEqual(validateInput({ title: '  读一本书  ', notes: '第一步\n第二步', important: true, dueDate: '' }, true), { title: '读一本书', notes: '第一步\n第二步', important: true, due_date: null });
  assert.deepEqual(validateInput({ completed: false }), { completed: false });
  for (const value of [null, [], {}, { title: '' }, { title: ' '.repeat(2) }, { title: 'a'.repeat(121) }, { title: 'a\nb' }, { notes: 'a'.repeat(2001) }, { notes: '\0' }, { completed: 'true' }, { important: 1 }, { userId: 2 }, { user_id: 2 }, { completed_at: '2026-01-01' }]) assert.throws(() => validateInput(value), { status: 400 });
  assert.throws(() => validateInput({ title: '事项', completed: true }, true), { status: 400 });
  assert.throws(() => validateInput({ notes: '' }, true), { status: 400 });
});
test('待办日期校验闰年与真实日历，允许过去的计划并支持清除', () => {
  assert.equal(validateDate('2028-02-29'), '2028-02-29');
  assert.equal(validateDate('2020-01-01'), '2020-01-01');
  assert.equal(validateDate(null), null);
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-1', '2101-01-01', '1899-01-01', '2026-01-01T00:00:00Z', 20261028, []]) assert.throws(() => validateDate(value), { status: 400 });
});
test('待办筛选限制状态、排序、关键词和页码，拒绝数组及越界参数', () => {
  assert.deepEqual(validateQuery(), { status: 'all', keyword: '', sort: 'recent', page: 1, recurrence: 'all' });
  assert.equal(validateQuery({ status: 'done', sort: 'due', keyword: '  周末  ', page: '2' }).keyword, '周末');
  for (const value of [{ status: 'unknown' }, { status: [] }, { sort: 'drop' }, { keyword: 'a'.repeat(121) }, { keyword: {} }, { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: '1001' }, { page: ['1'] }]) assert.throws(() => validateQuery(value), { status: 400 });
});
test('每日完成状态在北京时间零点重置，UTC日期和设备时区不影响周期', () => {
  const before = getCalendar(new Date('2026-10-28T15:59:59.999Z'));
  const after = getCalendar(new Date('2026-10-28T16:00:00.000Z'));
  assert.equal(before.today, '2026-10-28');
  assert.equal(after.today, '2026-10-29');
  assert.equal(before.nextResetAt, '2026-10-28T16:00:00.000Z');
  const row = { recurrence: 'daily', completed: true, completed_period: before.today };
  assert.ok(isCompleted(row, before));
  assert.equal(isCompleted(row, after), false);
  assert.equal(isCompleted({ ...row, completed: false }, before), false);
  assert.equal(isCompleted({ ...row, completed_period: null }, before), false);
  assert.notEqual(periodKey('daily', before), periodKey('daily', after));
});
test('每周从周一开始，跨日保持完成、跨周和跨年恢复待办；普通待办不重置', () => {
  const monday = getCalendar(new Date('2026-12-28T00:00:00+08:00'));
  const sunday = getCalendar(new Date('2027-01-03T23:59:59+08:00'));
  const next = getCalendar(new Date('2027-01-04T00:00:00+08:00'));
  assert.equal(monday.weekStart, '2026-12-28');
  assert.equal(sunday.weekStart, monday.weekStart);
  assert.equal(next.weekStart, '2027-01-04');
  const row = { recurrence: 'weekly', completed: true, completed_period: monday.weekStart };
  assert.ok(isCompleted(row, sunday));
  assert.equal(isCompleted(row, next), false);
  assert.ok(isCompleted({ ...row, recurrence: 'none' }, next));
  assert.equal(periodKey('none', next), null);
  assert.notEqual(periodKey('daily', monday), periodKey('weekly', monday));
  assert.equal(getCalendar(new Date('2028-03-01T00:00:00+08:00')).today, '2028-03-01');
});
test('重复类型和周期保护参数必须有效，周期不能作为普通编辑字段提交', () => {
  for (const recurrence of ['none', 'daily', 'weekly']) {
    assert.equal(validateInput({ recurrence }).recurrence, recurrence);
    assert.equal(validateQuery({ recurrence }).recurrence, recurrence);
  }
  assert.deepEqual(validateInput({ completed: true, periodKey: 'daily:2026-10-28' }), { completed: true, periodKey: 'daily:2026-10-28' });
  for (const body of [{ recurrence: 'monthly' }, { recurrence: null }, { recurrence: [] }, { periodKey: 'daily:2026-10-28' }, { completed: true, periodKey: '2026-10-28' }, { completed: false, periodKey: {} }]) assert.throws(() => validateInput(body), { status: 400 });
  for (const recurrence of ['monthly', [], {}]) assert.throws(() => validateQuery({ recurrence }), { status: 400 });
  assert.throws(() => validateInput({ title: 'x', periodKey: null }, true), { status: 400 });
});
