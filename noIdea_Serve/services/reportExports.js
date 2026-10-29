const FORMATS = Object.freeze({
  csv: { extension: 'csv', contentType: 'text/csv; charset=utf-8' },
  xlsx: { extension: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  docx: { extension: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
});
function validateFormat(value = 'csv') {
  if (typeof value !== 'string' || !Object.hasOwn(FORMATS, value)) throw Object.assign(new Error('导出格式仅支持 Excel、Word 或 CSV'), { status: 400 });
  return value;
}
const headers = ['类型', '开始日期', '结束日期', '完成工作', '后续计划', '问题备注', '最后更新（北京时间）'];
const updatedFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const reportValues = row => [row.type === 'daily' ? '日报' : '周报', row.period_start, row.period_end, row.accomplishments, row.plans, row.blockers, updatedFormatter.format(new Date(row.updated_at))];
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function toCsv(rows) {
  return '\uFEFF' + [headers, ...rows.map(reportValues)].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
async function toXlsx(rows) {
  const ExcelJS = require('exceljs');
  // Strings remain text cells, including values beginning with =, +, - or @.
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'noIdea'; workbook.title = '工作报告';
  const sheet = workbook.addWorksheet('工作报告', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [9, 14, 14, 54, 42, 42, 26].map(width => ({ width }));
  sheet.addRows([headers, ...rows.map(reportValues)]);
  sheet.autoFilter = `A1:G${rows.length + 1}`;
  sheet.eachRow((row, index) => {
    row.height = index === 1 ? 26 : Math.min(150, Math.max(36, ...[4, 5, 6].map(column => {
      const text = String(row.getCell(column).value || '');
      return text.split(/\r\n|\r|\n/).reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / 25)), 0) * 16;
    })));
    row.eachCell({ includeEmpty: true }, cell => {
      cell.numFmt = '@';
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.font = { name: 'Microsoft YaHei', size: 11, bold: index === 1, color: { argb: 'FF232A35' } };
      if (index === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
async function toDocx(rows, query) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, TableLayoutType, HeadingLevel } = require('docx');
  const cleanText = value => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uFFFE\uFFFF]/g, '\uFFFD');
  const paragraph = value => new Paragraph({
    spacing: { after: 0, line: 300 },
    children: cleanText(value || '—').split('\n').map((text, index) => new TextRun({ text, break: index ? 1 : 0 })),
  });
  const cell = (text, label = false) => new TableCell({
    width: { size: label ? 1440 : 8198, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    ...(label ? { shading: { fill: 'F5F6F8' } } : {}),
    children: [paragraph(text)],
  });
  const children = [
    new Paragraph({ text: '工作报告', heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `${query.from} — ${query.to} · 共 ${rows.length} 篇`, spacing: { after: 120 } }),
  ];
  if (query.keyword) children.push(new Paragraph({ text: `搜索关键词：${cleanText(query.keyword)}`, spacing: { after: 180 } }));
  for (const row of rows) {
    const title = `${row.type === 'daily' ? '日报' : '周报'} · ${row.period_start}${row.type === 'weekly' ? ` — ${row.period_end}` : ''}`;
    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 300, after: 120 } }));
    children.push(new Paragraph({ text: `最后更新：${updatedFormatter.format(new Date(row.updated_at))}（北京时间）`, keepNext: true, spacing: { after: 120 } }));
    children.push(new Table({
      width: { size: 9638, type: WidthType.DXA }, columnWidths: [1440, 8198], layout: TableLayoutType.FIXED,
      rows: [['完成工作', row.accomplishments], ['后续计划', row.plans], ['问题备注', row.blockers]].map(([label, text]) => new TableRow({ children: [cell(label, true), cell(text)], cantSplit: false })),
    }));
  }
  const document = new Document({
    creator: 'noIdea', title: '工作报告', description: `${query.from} 至 ${query.to} 的日报与周报`,
    styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 22, color: '232A35' }, paragraph: { spacing: { after: 120, line: 300 } } }, title: { run: { size: 36, bold: true, color: '232A35' } }, heading1: { run: { size: 26, bold: true, color: '232A35' } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }],
  });
  return Packer.toBuffer(document);
}
async function buildExport(rows, query, value) {
  const format = validateFormat(value), metadata = FORMATS[format];
  const content = format === 'xlsx' ? await toXlsx(rows) : format === 'docx' ? await toDocx(rows, query) : Buffer.from(toCsv(rows), 'utf8');
  return { content, ...metadata, filename: `工作报告_${query.from}_${query.to}.${metadata.extension}` };
}
module.exports = { FORMATS, validateFormat, toCsv, buildExport };
