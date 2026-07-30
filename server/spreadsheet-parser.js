import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import {
  cellToText,
  makeImageValue,
  parseDispimgId,
  rowToRecord,
} from "./message-record-parser.js";
import { readFieldMap } from "./runtime-config.js";

const execFileAsync = promisify(execFile);
export const spreadsheetLimits = Object.freeze({
  fileBytes: 50 * 1024 * 1024,
  uncompressedBytes: 512 * 1024 * 1024,
  archiveEntries: 5000,
  rows: 100000,
  importRows: 200,
  columns: 500,
  cells: 2_000_000,
});

export async function parseSpreadsheetBuffer(buffer, { fileName = "" } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("上传的表格文件为空。");
  if (buffer.length > spreadsheetLimits.fileBytes) {
    throw new Error(`上传的表格超过 ${spreadsheetLimits.fileBytes / 1024 / 1024}MB 大小限制。`);
  }

  const ExcelJS = (await import("exceljs")).default;
  const format = detectSpreadsheetFormat(buffer, fileName);
  const workbook = new ExcelJS.Workbook();
  let imageMap = new Map();

  if (format === "csv") {
    await workbook.csv.read(Readable.from([buffer]));
  } else if (format === "xls" && process.platform !== "win32") {
    return parseLegacySpreadsheetBuffer(buffer);
  } else {
    let xlsxBuffer = buffer;
    if (format === "xls") {
      try {
        xlsxBuffer = await convertLegacySpreadsheetToXlsx(buffer);
      } catch (error) {
        console.warn(`Excel/WPS conversion failed; using legacy .xls fallback: ${error.message}`);
        return parseLegacySpreadsheetBuffer(buffer);
      }
    }
    const zip = await loadSpreadsheetArchive(xlsxBuffer);
    imageMap = await extractWpsCellImages(zip);
    await workbook.xlsx.load(xlsxBuffer, {
      ignoreNodes: ["dataValidations", "extLst"],
    });
  }

  const sheet = getActiveExcelJsWorksheet(workbook);
  if (!sheet) throw new Error("上传的表格中没有工作表。");
  const bounds = assertWorksheetLimits(sheet);

  const matrix = sheetToMatrix(sheet, imageMap, bounds);
  return recordsFromSpreadsheetMatrix(matrix);
}

function recordsFromSpreadsheetMatrix(matrix) {
  const fieldMap = readFieldMap();
  const fieldNames = new Set([...Object.keys(fieldMap), ...Object.values(fieldMap)]);
  const headerIndex = findHeaderRowIndex(matrix, fieldNames);
  if (headerIndex < 0) throw new Error("未在表格中找到标题行。");

  const headers = matrix[headerIndex].map((cell) => String(cell || "").trim());
  const sheetMeta = extractQuoteSheetMeta(matrix, headerIndex);
  const dataRows = matrix
    .slice(headerIndex + 1)
    .filter((row) => isSpreadsheetDataRow(headers, row));
  if (dataRows.length === 0) throw new Error("表格中没有可写入的数据行。");
  if (dataRows.length > spreadsheetLimits.importRows) {
    throw new Error(
      `清单共有 ${dataRows.length} 行，单次最多允许 ${spreadsheetLimits.importRows} 行，请拆分文件后重试。`,
    );
  }

  return dataRows.map((row) => rowToRecord(headers, row, sheetMeta));
}

export async function parseLegacySpreadsheetBuffer(buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellFormula: true,
    cellHTML: false,
    cellStyles: false,
  });
  const sheetName = getActiveLegacyWorksheetName(workbook);
  if (!sheetName) throw new Error("上传的表格中没有工作表。");
  const sheet = workbook.Sheets[sheetName];
  const populatedCells = Object.keys(sheet)
    .filter((address) => !address.startsWith("!"))
    .map((address) => ({ address, cell: sheet[address] }))
    .filter(({ cell }) =>
      cell && (cell.f || cell.v !== null && cell.v !== undefined && cell.v !== ""));
  if (populatedCells.length === 0) throw new Error("上传的表格中没有可读取的数据。");
  const coordinates = populatedCells.map(({ address }) => XLSX.utils.decode_cell(address));
  const rowCount = Math.max(...coordinates.map(({ r }) => r)) + 1;
  const columnCount = Math.max(...coordinates.map(({ c }) => c)) + 1;
  assertSpreadsheetDimensions(rowCount, columnCount);

  const matrix = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address];
      row.push(cell?.f ? `=${cell.f}` : cell?.w ?? cell?.v ?? "");
    }
    matrix.push(row);
  }

  const records = recordsFromSpreadsheetMatrix(matrix);
  records.warnings = ["旧版 .xls 已使用兼容模式读取，内嵌图片可能无法提取。"];
  return records;
}

function normalizeActiveSheetIndex(value, sheetCount) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= sheetCount) return 0;
  return index;
}

export function getActiveLegacyWorksheetName(workbook) {
  const sheetNames = workbook?.SheetNames || [];
  const activeTab =
    workbook?.Workbook?.WBView?.[0]?.activeTab ??
    workbook?.Workbook?.Views?.[0]?.activeTab;
  const activeSheetIndex = normalizeActiveSheetIndex(activeTab, sheetNames.length);
  return sheetNames[activeSheetIndex] || sheetNames[0];
}

function getActiveExcelJsWorksheet(workbook) {
  const worksheets = workbook.worksheets || [];
  const activeTab = workbook.views
    ?.map((view) => view?.activeTab)
    .find((value) => Number.isInteger(Number(value)));
  const activeSheetIndex = normalizeActiveSheetIndex(activeTab, worksheets.length);
  return worksheets[activeSheetIndex] || worksheets[0];
}

function detectSpreadsheetFormat(buffer, fileName) {
  const extension = String(fileName || "").trim().toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  if (extension && ![".xlsx", ".xls", ".csv"].includes(extension)) {
    throw new Error("不支持该表格格式，仅支持 .xlsx、.xls 和 .csv 文件。");
  }
  if (extension === ".csv") return "csv";
  if (buffer.subarray(0, 2).toString("hex") === "504b") return "xlsx";
  if (buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1") return "xls";
  if (extension === ".xls") return "xls";
  if (extension === ".xlsx") throw new Error(".xlsx 文件内容无效或已经损坏。");
  return "csv";
}

async function convertLegacySpreadsheetToXlsx(buffer) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "feishu-bot-xls-"));
  const inputPath = path.join(dir, "input.xls");
  const outputPath = path.join(dir, "output.xlsx");
  await writeFile(inputPath, buffer);
  const script = `
$ErrorActionPreference = "Stop"
$inputPath = ${JSON.stringify(inputPath)}
$outputPath = ${JSON.stringify(outputPath)}
$app = $null
try {
  try { $app = New-Object -ComObject Excel.Application } catch { $app = New-Object -ComObject Ket.Application }
  $app.DisplayAlerts = $false
  try { $app.AutomationSecurity = 3 } catch {}
  try { $app.AskToUpdateLinks = $false } catch {}
  $workbook = $app.Workbooks.Open($inputPath, 0, $true)
  $workbook.SaveAs($outputPath, 51)
  $workbook.Close($false)
} finally {
  if ($app -ne $null) { $app.Quit() | Out-Null }
}
`;
  try {
    await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      timeout: 120000,
      windowsHide: true,
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function assertWorksheetLimits(sheet) {
  let rowCount = 0;
  let columnCount = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    let rowHasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      if (
        cell.formula ||
        cell.value !== null && cell.value !== undefined && cell.value !== ""
      ) {
        rowHasValue = true;
        columnCount = Math.max(columnCount, columnNumber);
      }
    });
    if (rowHasValue) rowCount = Math.max(rowCount, rowNumber);
  });
  assertSpreadsheetDimensions(rowCount, columnCount);
  return { rowCount, columnCount };
}

function assertSpreadsheetDimensions(rowCount, columnCount) {
  if (rowCount > spreadsheetLimits.rows) {
    throw new Error(`表格行数过多（${rowCount} 行），最多允许 ${spreadsheetLimits.rows} 行。`);
  }
  if (columnCount > spreadsheetLimits.columns) {
    throw new Error(`表格列数过多（${columnCount} 列），最多允许 ${spreadsheetLimits.columns} 列。`);
  }
  if (rowCount * columnCount > spreadsheetLimits.cells) {
    throw new Error(`表格单元格数量过多，最多允许 ${spreadsheetLimits.cells} 个单元格。`);
  }
}

function excelJsCellValue(cell) {
  if (cell.formula) {
    if (cell.result !== null && cell.result !== undefined) return cell.result;
    return `=${cell.formula}`;
  }
  if (cell.value === null || cell.value === undefined) return "";
  if (cell.value instanceof Date) return cell.text || cell.value.toISOString();
  return cell.text !== undefined && cell.text !== "" ? cell.text : cell.value;
}

function sheetToMatrix(sheet, imageMap, bounds = {}) {
  const rows = [];
  const rowCount = Number(bounds.rowCount || 0);
  const columnCount = Number(bounds.columnCount || 0);
  for (let r = 1; r <= rowCount; r += 1) {
    const row = [];
    for (let c = 1; c <= columnCount; c += 1) {
      const value = excelJsCellValue(sheet.getCell(r, c));
      const imageId = parseDispimgId(value);
      row.push(imageId ? makeImageValue(imageId, imageMap.get(imageId), value) : value);
    }
    if (row.some((cell) => cellToText(cell) !== "")) rows.push(row);
  }
  return rows;
}

async function loadSpreadsheetArchive(buffer) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.values(zip.files);
  if (files.length > spreadsheetLimits.archiveEntries) {
    throw new Error(`表格压缩内容条目过多（${files.length} 个）。`);
  }
  let uncompressedBytes = 0;
  for (const file of files) {
    uncompressedBytes += Number(file?._data?.uncompressedSize || 0);
    if (uncompressedBytes > spreadsheetLimits.uncompressedBytes) {
      throw new Error("表格解压后的内容超过安全处理限制。");
    }
  }
  return zip;
}

async function extractWpsCellImages(zip) {
  const relsXml = await zip.file("xl/_rels/cellimages.xml.rels")?.async("string");
  const cellImagesXml = await zip.file("xl/cellimages.xml")?.async("string");
  if (!relsXml || !cellImagesXml) return new Map();

  const relMap = new Map();
  for (const match of relsXml.matchAll(/<Relationship\b([^>]+?)\/?>/g)) {
    const attrs = parseXmlAttrs(match[1]);
    if (!attrs.Id || !attrs.Target) continue;
    relMap.set(attrs.Id, normalizeZipPath("xl/" + attrs.Target));
  }

  const imageMap = new Map();
  for (const match of cellImagesXml.matchAll(/<etc:cellImage\b[\s\S]*?<\/etc:cellImage>/g)) {
    const block = match[0];
    const nameAttrs = block.match(/<xdr:cNvPr\b([^>]+?)\/?>/);
    const blipAttrs = block.match(/<a:blip\b([^>]+?)\/?>/);
    if (!nameAttrs || !blipAttrs) continue;
    const name = parseXmlAttrs(nameAttrs[1]).name;
    const embed = parseXmlAttrs(blipAttrs[1])["r:embed"];
    const target = relMap.get(embed);
    const file = target ? zip.file(target) : null;
    if (!name || !file) continue;
    const data = await file.async("nodebuffer");
    imageMap.set(name, {
      buffer: data,
      fileName: target.split("/").pop() || `${name}.png`,
      mimeType: mimeFromFileName(target),
    });
  }
  return imageMap;
}

function parseXmlAttrs(source) {
  const attrs = {};
  for (const match of source.matchAll(/([\w:.-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function normalizeZipPath(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function mimeFromFileName(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "image/png";
}

function findHeaderRowIndex(matrix, fieldNames) {
  let best = { index: -1, score: 0 };
  matrix.forEach((row, index) => {
    const cells = row.map((cell) => String(cell || "").trim()).filter(Boolean);
    if (cells.length < 2) return;
    const uniqueCells = new Set(cells);
    const matchedFields = cells.filter((cell) => fieldNames.has(cell)).length;
    const textLikeCells = cells.filter((cell) => !/^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$/.test(cell)).length;
    const score = matchedFields * 4 + Math.min(uniqueCells.size, 12) + textLikeCells;
    if (score > best.score) best = { index, score };
  });
  return best.score >= 4 ? best.index : -1;
}

function extractQuoteSheetMeta(matrix, headerIndex) {
  const meta = {};
  const rows = matrix.slice(0, Math.max(0, headerIndex));
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (let index = 0; index < row.length; index += 1) {
      const label = cellToText(row[index]).replace(/\s/g, "");
      if (!label) continue;
      if (isQuoteMetaLabel(label, ["营销区域", "业务区域", "营销大区", "区域"])) {
        const value = findQuoteMetaValue(rows, rowIndex, index, label, [
          "营销区域",
          "业务区域",
          "营销大区",
          "区域",
        ]);
        if (value) meta["区域"] = value;
      }
      if (isQuoteMetaLabel(label, ["业务姓名", "业务员姓名", "业务员", "业务"])) {
        const value = findQuoteMetaValue(rows, rowIndex, index, label, [
          "业务姓名",
          "业务员姓名",
          "业务员",
          "业务",
        ]);
        if (value) meta["业务"] = value;
      }
    }
  }
  return meta;
}

function isQuoteMetaLabel(text, aliases) {
  return aliases.some((alias) => (
    text === alias
    || text.startsWith(`${alias}:`)
    || text.startsWith(`${alias}：`)
    || text.startsWith(`${alias}（`)
    || text.startsWith(`${alias}(`)
  ));
}

function inlineValueAfterLabel(text, aliases) {
  for (const alias of aliases) {
    if (text === alias) return "";
    if (
      !text.startsWith(`${alias}:`)
      && !text.startsWith(`${alias}：`)
      && !text.startsWith(`${alias}（`)
      && !text.startsWith(`${alias}(`)
    ) continue;
    const suffix = text.slice(alias.length)
      .replace(/^[（(][^）)]*[）)]/, "")
      .replace(/^[:：]/, "")
      .trim();
    if (suffix) return suffix;
  }
  return "";
}

function findQuoteMetaValue(rows, rowIndex, labelIndex, label, aliases) {
  const inlineValue = inlineValueAfterLabel(label, aliases);
  if (inlineValue) return inlineValue;

  const row = rows[rowIndex] || [];
  const ignoredLabels = /营销区域|业务区域|营销大区|区域|业务姓名|业务员姓名|业务员|业务代码|业务电话|工程项目名称|项目预算金额|跟单员|客户名称|客户代码|报价时间/;
  for (let index = labelIndex + 1; index < Math.min(row.length, labelIndex + 8); index += 1) {
    const value = cellToText(row[index]);
    if (!value) continue;
    if (ignoredLabels.test(value)) break;
    return value;
  }

  for (let nextRowIndex = rowIndex + 1; nextRowIndex < Math.min(rows.length, rowIndex + 3); nextRowIndex += 1) {
    const nextRow = rows[nextRowIndex] || [];
    for (let index = Math.max(0, labelIndex - 1); index < Math.min(nextRow.length, labelIndex + 3); index += 1) {
      const value = cellToText(nextRow[index]);
      if (!value || ignoredLabels.test(value)) continue;
      return value;
    }
  }
  return "";
}

function isSpreadsheetDataRow(headers, row) {
  const values = row.map(cellToText);
  if (!values.some(Boolean)) return false;
  if (isQuoteFooterRow(values)) return false;

  const record = rowToRecord(headers, row);
  const meaningfulFields = [
    "产品名称",
    "型号",
    "规格",
    "颜色",
    "数量",
    "附彩图",
    "注意事项/材质说明",
    "下单建料号",
    "图号",
  ];
  return meaningfulFields.some((field) => cellToText(record[field]) !== "");
}

function isQuoteFooterRow(values) {
  const footerLabels = [
    "报价员",
    "品牌报价",
    "品牌报审",
    "审核",
    "经理",
    "总监",
    "总裁",
  ];
  const compactValues = values.map((value) => value.replace(/\s/g, ""));
  const matches = compactValues.filter((value) =>
    footerLabels.some((label) => {
      if (value === label) return true;
      return value.startsWith(`${label}:`) || value.startsWith(`${label}：`);
    }),
  );
  return matches.length >= 2 || /^报价员[:：]/.test(compactValues.find(Boolean) || "");
}
