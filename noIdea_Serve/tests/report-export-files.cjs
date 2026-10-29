const { createRequire } = require('node:module');
const ExcelJS = require('exceljs');
// Inspect the actual OOXML entries rather than treating a renamed text file as a document.
const JSZip = createRequire(require.resolve('exceljs'))('jszip');
exports.readWorkbook = async content => { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(content); return workbook; };
exports.sheetRows = workbook => workbook.worksheets[0].getSheetValues().slice(1).map(row => Array.from({ length: 7 }, (_, index) => row[index + 1] ?? ''));
exports.readDocument = async content => {
  const zip = await JSZip.loadAsync(content);
  if (!zip.file('[Content_Types].xml') || !zip.file('word/document.xml')) throw new Error('文件不是完整的 Word OOXML 文档');
  return zip.file('word/document.xml').async('string');
};
