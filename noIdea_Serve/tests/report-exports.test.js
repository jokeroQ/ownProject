const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateFormat, buildExport } = require('../services/reportExports');
const { readWorkbook, sheetRows, readDocument } = require('./report-export-files.cjs');
const row = { type: 'daily', period_start: '2026-10-29', period_end: '2026-10-29', accomplishments: '完成"测试",中文\n第二行 & <保留>', plans: '=SUM(1,2)', blockers: '+literal', updated_at: '2026-10-29T00:00:00.000Z' };
const query = { from: '2026-10-01', to: '2026-11-01', keyword: '测试' };

test('文件格式仅接受明确的三个值，旧接口不指定格式时仍为CSV', () => {
  assert.equal(validateFormat(), 'csv');
  for (const format of ['xlsx', 'docx', 'csv']) assert.equal(validateFormat(format), format);
  for (const format of ['', 'word', 'xls', 'pdf', 'constructor', '__proto__', ['xlsx'], {}, null]) assert.throws(() => validateFormat(format), { status: 400 });
});
test('Excel 为可读取的真实工作簿，中文多行与日期完整，公式形态内容保持文本', async () => {
  const result = await buildExport([row], query, 'xlsx');
  assert.ok(Buffer.isBuffer(result.content)); assert.equal(result.content.subarray(0, 2).toString(), 'PK');
  assert.equal(result.extension, 'xlsx'); assert.match(result.contentType, /spreadsheetml/); assert.match(result.filename, /\.xlsx$/);
  const workbook = await readWorkbook(result.content), sheet = workbook.getWorksheet('工作报告'), values = sheetRows(workbook);
  assert.deepEqual(values[0], ['类型', '开始日期', '结束日期', '完成工作', '后续计划', '问题备注', '最后更新（北京时间）']);
  assert.deepEqual(values[1], ['日报', '2026-10-29', '2026-10-29', row.accomplishments, row.plans, row.blockers, '2026-10-29 08:00:00']);
  assert.equal(sheet.getCell('E2').value, '=SUM(1,2)'); assert.equal(sheet.getCell('E2').formula, undefined); assert.equal(sheet.getCell('F2').formula, undefined);
  assert.equal(sheet.autoFilter, 'A1:G2'); assert.equal(sheet.views[0].ySplit, 1); assert.equal(sheet.getCell('D2').alignment.wrapText, true);
});
test('Word 为独立DOCX文档，按篇包含日期、完整内容、分行与XML转义', async () => {
  const weekly = { ...row, type: 'weekly', period_start: '2026-10-26', period_end: '2026-11-01', accomplishments: '本周总结', plans: '', blockers: '' };
  const result = await buildExport([row, weekly], query, 'docx');
  assert.equal(result.content.subarray(0, 2).toString(), 'PK'); assert.equal(result.extension, 'docx'); assert.match(result.contentType, /wordprocessingml/); assert.match(result.filename, /\.docx$/);
  const xml = await readDocument(result.content);
  for (const text of ['工作报告', '日报 · 2026-10-29', '周报 · 2026-10-26 — 2026-11-01', '完成工作', '后续计划', '问题备注', '本周总结', '=SUM(1,2)', '第二行 &amp; &lt;保留&gt;', '2026-10-29 08:00:00', '搜索关键词：测试']) assert.ok(xml.includes(text), text);
  assert.equal((xml.match(/<w:tbl>/g) || []).length, 2); assert.match(xml, /<w:br\s*\/>/);
  assert.match(xml, /w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);
});
test('CSV 保留原有BOM及公式文本规则，扩展名和响应类型一致', async () => {
  const result = await buildExport([row], query);
  assert.equal(result.extension, 'csv'); assert.match(result.contentType, /text\/csv/);
  assert.equal(result.content.subarray(0, 3).toString('hex'), 'efbbbf');
  assert.ok(result.content.toString().includes('"\'=SUM(1,2)"'));
});
