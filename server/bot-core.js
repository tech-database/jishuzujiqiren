const requiredConfig = [
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_BITABLE_APP_TOKEN",
  "FEISHU_BITABLE_TABLE_ID",
];

import { readFileSync } from "node:fs";
import { parse as parseDotenv } from "dotenv";
import { feishuCache, feishuCacheTtl } from "./feishu-cache.js";
import { calculateDrawingWorkDurationMinutes } from "./drawing-work-duration.js";
import {
  formatShanghaiDate,
  formatShanghaiDateTime,
  parseShanghaiDateBoundary,
  parseShanghaiDateTime,
} from "./date-range.js";

const tableDefinitions = {
  board: {
    label: "胶板",
    appTokenEnv: "FEISHU_BITABLE_APP_TOKEN",
    tableIdEnv: "FEISHU_BITABLE_TABLE_ID",
  },
  paint: {
    label: "油漆",
    appTokenEnv: "FEISHU_PAINT_BITABLE_APP_TOKEN",
    tableIdEnv: "FEISHU_PAINT_BITABLE_TABLE_ID",
  },
};

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const envFileUrl = new URL("../.env", import.meta.url);
export const spreadsheetLimits = Object.freeze({
  fileBytes: 50 * 1024 * 1024,
  uncompressedBytes: 512 * 1024 * 1024,
  archiveEntries: 5000,
  rows: 100000,
  importRows: 200,
  columns: 500,
  cells: 2_000_000,
});
export const feishuRequestTimeoutMs = Object.freeze({
  standard: 180 * 1000,
  batchWrite: 300 * 1000,
  mediaUpload: 360 * 1000,
});

function readRuntimeEnvValue(key) {
  try {
    const env = parseDotenv(readFileSync(envFileUrl));
    if (Object.prototype.hasOwnProperty.call(env, key)) return env[key];
  } catch {
    // Fall back to the process environment when the local .env file is unavailable.
  }
  return process.env[key];
}

function readJsonRuntimeEnvValue(key, fallback = {}) {
  const rawValue = readRuntimeEnvValue(key);
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue);
  } catch {
    // Compatibility with values previously written as a JSON-stringified
    // dotenv value (for example {\"id\":\"name\"}).
    try {
      return JSON.parse(rawValue.replace(/\\\"/g, '"'));
    } catch {
      return fallback;
    }
  }
}

export function getConfigStatus() {
  const missing = requiredConfig.filter((key) => !readRuntimeEnvValue(key));
  return {
    ready: missing.length === 0,
    missing,
    webhookPath: "/webhook/feishu",
    webhookEnabled: readRuntimeEnvValue("FEISHU_WEBHOOK_ENABLED") === "true",
    table: {
      appTokenSet: Boolean(readRuntimeEnvValue("FEISHU_BITABLE_APP_TOKEN")),
      tableIdSet: Boolean(readRuntimeEnvValue("FEISHU_BITABLE_TABLE_ID")),
    },
    tables: getBitableTablesStatus(),
    fieldMap: readFieldMap(),
    nameIdMap: readNameIdMap(),
    replyEnabled: readRuntimeEnvValue("FEISHU_REPLY_ENABLED") === "true",
  };
}

function resolveTableKey(tableKey) {
  const text = String(tableKey || "").trim().toLowerCase();
  if (text === "paint" || text === "油漆") return "paint";
  return "board";
}

function getBitableTablesStatus() {
  return Object.fromEntries(
    Object.entries(tableDefinitions).map(([key, definition]) => [
      key,
      {
        label: definition.label,
        appTokenSet: Boolean(readRuntimeEnvValue(definition.appTokenEnv)),
        tableIdSet: Boolean(readRuntimeEnvValue(definition.tableIdEnv)),
        ready: Boolean(readRuntimeEnvValue(definition.appTokenEnv) && readRuntimeEnvValue(definition.tableIdEnv)),
      },
    ]),
  );
}

export function getBitableConfig(tableKey = "board") {
  const resolvedKey = resolveTableKey(tableKey);
  const definition = tableDefinitions[resolvedKey];
  const appToken = readRuntimeEnvValue(definition.appTokenEnv) || "";
  const tableId = readRuntimeEnvValue(definition.tableIdEnv) || "";
  if (!appToken || !tableId) {
    throw new Error(`${definition.label}多维表配置未填写完整`);
  }
  return {
    key: resolvedKey,
    label: definition.label,
    appToken,
    tableId,
  };
}

function drawingTableKeys(tableKey) {
  return tableKey ? [resolveTableKey(tableKey)] : Object.keys(tableDefinitions);
}

export function ensureConfig() {
  const missing = requiredConfig.filter((key) => !readRuntimeEnvValue(key));
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

function readFieldMap() {
  const parsed = readJsonRuntimeEnvValue("FIELD_MAP_JSON");
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function readNameIdMap() {
  try {
    const parsed = readJsonRuntimeEnvValue("NAME_ID_MAP_JSON");
    if (Array.isArray(parsed)) {
      return Object.fromEntries(
        parsed
          .map((item) => [String(item?.id || item?.userId || "").trim(), String(item?.name || "").trim()])
          .filter(([id, name]) => id && name),
      );
    }
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([id, name]) => [String(id || "").trim(), String(name || "").trim()])
        .filter(([id, name]) => id && name),
    );
  } catch {
    return {};
  }
}

function resolveDrawingOwnerValue(senderName, senderId, ownerType) {
  const cleanSenderId = String(senderId || "").trim();
  const cleanSenderName = String(senderName || "").trim();
  const mappedName = cleanSenderId ? String(readNameIdMap()[cleanSenderId] || "").trim() : "";
  if (mappedName) return mappedName;
  if (ownerType === 11 && cleanSenderId) return [{ id: cleanSenderId }];
  if (cleanSenderId) return cleanSenderId;
  return cleanSenderName;
}

function resolveMappedOwnerName(ownerValue) {
  const cleanOwner = String(ownerValue || "").trim();
  if (!cleanOwner) return "";
  return String(readNameIdMap()[cleanOwner] || "").trim();
}

function normalizeValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (["true", "yes"].includes(trimmed.toLowerCase()) || trimmed === "\u662f") return true;
  if (["false", "no"].includes(trimmed.toLowerCase()) || trimmed === "\u5426") return false;
  return trimmed;
}

function parseDateToTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const text = String(value || "").trim();
  if (!text) return "";
  return parseShanghaiDateTime(text) ?? value;
}

function shanghaiTodayParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function todayDateTimestamp() {
  const { year, month, day } = shanghaiTodayParts();
  return Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
}

function todayDateValue(fieldType) {
  if (fieldType === 5) return todayDateTimestamp();
  const { year, month, day } = shanghaiTodayParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function applyFieldMap(fields) {
  const fieldMap = readFieldMap();
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [fieldMap[key] || key, value]),
  );
}

function stripCommand(text) {
  return String(text || "")
    .trim()
    .replace(/^\u5199\u5165[:\uff1a\s]*/i, "")
    .trim();
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseMarkdownTable(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));
  if (lines.length < 2) return null;

  const rows = lines.map((line) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()),
  );
  const separatorIndex = rows.findIndex((row) => row.every((cell) => /^:?-{3,}:?$/.test(cell)));
  if (separatorIndex !== 1) return null;

  const headers = rows[0];
  const bodyRows = rows.slice(2).filter((row) => row.some(Boolean));
  if (headers.length === 0 || bodyRows.length === 0) return null;
  return bodyRows.map((row) => rowToRecord(headers, row));
}

function parseDelimitedTable(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const delimiter = source.includes("\t") ? "\t" : source.includes(",") ? "," : null;
  if (!delimiter) return null;

  const rows = lines.map((line) => parseDelimitedLine(line, delimiter));
  const headers = rows[0];
  const bodyRows = rows.slice(1).filter((row) => row.some(Boolean));
  if (headers.length < 2 || bodyRows.length === 0) return null;
  return bodyRows.map((row) => rowToRecord(headers, row));
}

function cellToText(cell) {
  return String(cell?.fallback ?? cell ?? "").trim();
}

function rowToRecord(headers, row, extraFields = {}) {
  const fields = {};
  headers.forEach((header, index) => {
    if (!header) return;
    fields[header] = row[index] ?? "";
  });
  const mapped = applyFieldMap(fields);
  for (const [fieldName, value] of Object.entries(extraFields)) {
    if (value !== "" && cellToText(mapped[fieldName]) === "") mapped[fieldName] = value;
  }
  return mapped;
}

function makeImageValue(imageId, image, fallback = "") {
  return { __imageId: imageId, image, fallback };
}

function parseDispimgId(value) {
  const match = String(value || "").match(/DISPIMG\s*\(\s*["']([^"']+)["']/i);
  return match?.[1] || null;
}

function parseKeyValueRecord(source) {
  const lines = source
    .split(/\n|\uff1b|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];
  for (const line of lines) {
    const match = line.match(/^([^:=\uff1a=]+)\s*[:\uff1a=]\s*(.+)$/);
    if (match) entries.push([match[1].trim(), match[2].trim()]);
  }
  if (entries.length === 0) return null;
  return applyFieldMap(Object.fromEntries(entries));
}

function parseMessageToRecords(text) {
  const source = stripCommand(text);
  if (!source) throw new Error("消息内容为空。");

  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return parsed.map((row) => applyFieldMap(row));
    if (parsed && typeof parsed === "object") return [applyFieldMap(parsed)];
  } catch {
    // Continue with pasted table or key-value formats.
  }

  const markdownRows = parseMarkdownTable(source);
  if (markdownRows) return markdownRows;

  const delimitedRows = parseDelimitedTable(source);
  if (delimitedRows) return delimitedRows;

  const record = parseKeyValueRecord(source);
  if (record) return [record];

  throw new Error("消息格式无效，请粘贴表格、JSON，或按“字段：内容”格式发送。");
}

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

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("上传的表格中没有工作表。");
  assertWorksheetLimits(sheet);

  const matrix = sheetToMatrix(sheet, imageMap);
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
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("上传的表格中没有工作表。");
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const rowCount = range.e.r - range.s.r + 1;
  const columnCount = range.e.c - range.s.c + 1;
  assertSpreadsheetDimensions(rowCount, columnCount);

  const matrix = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
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
  const rowCount = Number(sheet.rowCount || 0);
  const columnCount = Number(sheet.columnCount || 0);
  assertSpreadsheetDimensions(rowCount, columnCount);
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
  if (cell.formula) return `=${cell.formula}`;
  if (cell.value === null || cell.value === undefined) return "";
  if (cell.value instanceof Date) return cell.text || cell.value.toISOString();
  return cell.text !== undefined && cell.text !== "" ? cell.text : cell.value;
}

function sheetToMatrix(sheet, imageMap) {
  const rows = [];
  const rowCount = Number(sheet.rowCount || 0);
  const columnCount = Number(sheet.columnCount || 0);
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
    const textLikeCells = cells.filter((cell) => !/^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(cell)).length;
    const score = matchedFields * 4 + Math.min(uniqueCells.size, 12) + textLikeCells;
    if (score > best.score) best = { index, score };
  });
  return best.score >= 4 ? best.index : -1;
}

function extractQuoteSheetMeta(matrix, headerIndex) {
  const meta = {};
  const rows = matrix.slice(0, Math.max(0, headerIndex));
  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      const label = cellToText(row[index]).replace(/\s/g, "");
      if (!label) continue;
      if (label.includes("营销区域")) {
        const value = findValueAfterLabel(row, index);
        if (value) meta["区域"] = value;
      }
      if (label.includes("业务姓名")) {
        const value = findValueAfterLabel(row, index);
        if (value) meta["业务"] = value;
      }
    }
  }
  return meta;
}

function findValueAfterLabel(row, labelIndex) {
  const ignoredLabels = /营销区域|业务姓名|业务代码|业务电话|工程项目名称|项目预算金额|跟单员|客户名称|客户代码|报价时间/;
  for (let index = labelIndex + 1; index < Math.min(row.length, labelIndex + 8); index += 1) {
    const value = cellToText(row[index]);
    if (!value || ignoredLabels.test(value)) continue;
    return value;
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
  const footerLabels = ["报价员", "品牌报价", "审核", "经理", "总监", "总裁"];
  const compactValues = values.map((value) => value.replace(/\s/g, ""));
  const matches = compactValues.filter((value) =>
    footerLabels.some((label) => value === label || value === `${label}:` || value === `${label}：`),
  );
  return matches.length >= 2 || /^报价员[:：]?$/.test(compactValues.find(Boolean) || "");
}

export function extractTextFromFeishuEvent(body) {
  const message = body?.event?.message || body?.event?.message_event?.message;
  if (!message) return "";
  if (message.message_type && message.message_type !== "text") {
    throw new Error(`当前只支持文字消息，收到的消息类型为：${message.message_type}。`);
  }
  const content = typeof message.content === "string" ? JSON.parse(message.content) : message.content;
  return content?.text || "";
}

export async function fetchFeishuJsonWithTimeout(
  url,
  options = {},
  timeoutMs = feishuRequestTimeoutMs.standard,
) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternalSignal = () => controller.abort(externalSignal.reason);
  if (externalSignal?.aborted) abortFromExternalSignal();
  else externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json();
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new Error(`飞书接口响应超时（${Math.ceil(timeoutMs / 1000)}秒），请重试`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

export async function getTenantAccessToken() {
  const appId = readRuntimeEnvValue("FEISHU_APP_ID") || "";
  const tokenInfo = await feishuCache.get(`token:${appId}`, {
    ttlMs: (value) => value.ttlMs,
    loader: async () => {
      const { response, data } = await fetchFeishuJsonWithTimeout(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: appId,
            app_secret: readRuntimeEnvValue("FEISHU_APP_SECRET"),
          }),
        },
      );
      if (!response.ok || data.code !== 0) {
        throw new Error("获取飞书访问凭证失败，请稍后重试。");
      }
      return {
        token: data.tenant_access_token,
        ttlMs: calculateTenantTokenTtlMs(data.expire),
      };
    },
  });
  return tokenInfo.token;
}

export function calculateTenantTokenTtlMs(expireSeconds) {
  const expiresMs = Number(expireSeconds) * 1000;
  if (!Number.isFinite(expiresMs) || expiresMs <= 0) return feishuCacheTtl.token;
  if (expiresMs <= feishuCacheTtl.tokenRefreshBuffer) {
    return Math.max(1000, Math.floor(expiresMs / 2));
  }
  return expiresMs - feishuCacheTtl.tokenRefreshBuffer;
}

export function invalidateTenantAccessTokenCache() {
  return feishuCache.invalidatePrefix("token:");
}

const invalidTenantTokenCodes = new Set([99991661, 99991663, 99991664]);

function hasInvalidTenantToken(response, data) {
  if (response.status === 401) return true;
  if (invalidTenantTokenCodes.has(Number(data?.code))) return true;
  return /tenant[_ ]access[_ ]token/i.test(String(data?.msg || "")) &&
    /invalid|expired|expire|失效|过期/i.test(String(data?.msg || ""));
}

export async function fetchFeishuJson(url, options = {}) {
  const {
    timeoutMs = feishuRequestTimeoutMs.standard,
    ...requestOptions
  } = options;
  const execute = async () => {
    const headers = new Headers(requestOptions.headers || {});
    headers.set("Authorization", `Bearer ${await getTenantAccessToken()}`);
    return fetchFeishuJsonWithTimeout(
      url,
      { ...requestOptions, headers },
      timeoutMs,
    );
  };

  let result = await execute();
  if (hasInvalidTenantToken(result.response, result.data)) {
    invalidateTenantAccessTokenCache();
    result = await execute();
  }
  return result;
}

export async function getBitableFieldMap(token, tableConfig = getBitableConfig()) {
  const cacheKey = `fields:${tableConfig.key}:${tableConfig.appToken}:${tableConfig.tableId}`;
  return feishuCache.get(cacheKey, {
    ttlMs: feishuCacheTtl.fields,
    loader: async () => {
      const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields?page_size=100`;
      const { response, data } = await fetchFeishuJson(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok || data.code !== 0) {
        throw new Error("读取飞书多维表字段失败，请稍后重试。");
      }
      return new Map((data.data?.items || []).map((field) => [field.field_name, field.type]));
    },
  });
}

export function buildBitableRecordSearchBody({
  startDate,
  endDate,
  dateFieldName = drawingDateField,
  fieldNames,
  filterConditions,
  filterConjunction = "and",
} = {}) {
  const body = {};
  if (Array.isArray(fieldNames) && fieldNames.length > 0) body.field_names = fieldNames;
  const conditions = Array.isArray(filterConditions)
    ? filterConditions
        .filter((condition) => condition?.field_name && condition?.operator)
        .map((condition) => ({ ...condition }))
    : [];
  const startTime = parseDateBoundary(startDate);
  const endTime = parseDateBoundary(endDate, true);
  if (startTime) {
    conditions.push({
      field_name: dateFieldName,
      operator: "isGreater",
      value: ["ExactDate", String(startTime - 1)],
    });
  }
  if (endTime) {
    conditions.push({
      field_name: dateFieldName,
      operator: "isLess",
      value: ["ExactDate", String(endTime + 1)],
    });
  }
  if (conditions.length > 0) {
    body.filter = {
      conjunction: filterConjunction === "or" ? "or" : "and",
      conditions,
    };
  }
  return body;
}

async function listBitableRecords(token, tableConfig = getBitableConfig(), options = {}) {
  const records = [];
  let pageToken = "";
  const requestBody = buildBitableRecordSearchBody(options);

  do {
    const searchParams = new URLSearchParams({ page_size: "500" });
    if (pageToken) searchParams.set("page_token", pageToken);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/search?${searchParams.toString()}`;
    const { response, data } = await fetchFeishuJson(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok || data.code !== 0) {
      throw new Error("查询飞书多维表记录失败，请稍后重试。");
    }
    records.push(...(data.data?.items || []));
    pageToken = data.data?.has_more ? data.data?.page_token || "" : "";
  } while (pageToken);

  return records;
}

async function listRecentBitableRecords(
  token,
  tableConfig = getBitableConfig(),
  fieldTypes = new Map(),
  { limit = 500, fieldNames } = {},
) {
  const searchParams = new URLSearchParams({ page_size: String(limit) });
  const requestBody = {};
  const selectedFields = Array.isArray(fieldNames)
    ? fieldNames.filter((fieldName) => fieldTypes.has(fieldName))
    : [];
  if (selectedFields.length > 0) requestBody.field_names = selectedFields;
  if (fieldTypes.has(drawingDateField)) {
    requestBody.sort = [{ field_name: drawingDateField, desc: true }];
  }
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/search?${searchParams.toString()}`;
  const { response, data } = await fetchFeishuJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("查询飞书多维表最近记录失败，请稍后重试。");
  }
  return data.data?.items || [];
}

async function listCachedRecentBitableRecords(
  token,
  tableConfig,
  fieldTypes,
  options = {},
) {
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 500);
  const fieldKey = Array.isArray(options.fieldNames) ? options.fieldNames.join(",") : "";
  const cacheKey = `records:${tableConfig.key}:recent:${tableConfig.appToken}:${tableConfig.tableId}:${limit}:${fieldKey}`;
  return feishuCache.get(cacheKey, {
    ttlMs: feishuCacheTtl.records,
    loader: () => listRecentBitableRecords(token, tableConfig, fieldTypes, {
      ...options,
      limit,
    }),
  });
}

async function listCachedBitableRecords(token, tableConfig = getBitableConfig(), options = {}) {
  const rangeKey = `${options.startDate || ""}:${options.endDate || ""}`;
  const dateFieldKey = options.dateFieldName || "";
  const fieldKey = Array.isArray(options.fieldNames) ? options.fieldNames.join(",") : "";
  const filterKey = Array.isArray(options.filterConditions)
    ? JSON.stringify(options.filterConditions)
    : "";
  const cacheKey = `records:${tableConfig.key}:${tableConfig.appToken}:${tableConfig.tableId}:${rangeKey}:${dateFieldKey}:${fieldKey}:${options.filterConjunction || "and"}:${filterKey}`;
  return feishuCache.get(cacheKey, {
    ttlMs: feishuCacheTtl.records,
    loader: () => listBitableRecords(token, tableConfig, options),
  });
}

export function invalidateBitableRecordCache(tableKey) {
  if (!tableKey) {
    return feishuCache.invalidatePrefix("records:");
  }
  const resolvedKey = resolveTableKey(tableKey);
  return feishuCache.invalidatePrefix(`records:${resolvedKey}:`);
}

export function invalidateAllFeishuCaches() {
  return feishuCache.clear();
}

export function getFeishuCacheStatus() {
  return {
    ...feishuCache.snapshot(),
    ttlMs: { ...feishuCacheTtl },
  };
}

async function updateBitableRecord(token, tableConfig, recordId, fields) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/${recordId}`;
  const { response, data } = await fetchFeishuJson(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("更新飞书多维表记录失败，请稍后重试。");
  }
  invalidateBitableRecordCache(tableConfig.key);
  return data.data?.record;
}

async function getBitableRecord(token, tableConfig, recordId) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/${recordId}`;
  const { response, data } = await fetchFeishuJson(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("读取飞书多维表记录失败，请稍后重试。");
  }
  return data.data?.record;
}

async function updateBitableRecordBatch(token, tableConfig, plans) {
  if (plans.length === 1) {
    await updateBitableRecord(token, tableConfig, plans[0].recordId, plans[0].fields);
    return;
  }
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/batch_update`;
  const { response, data } = await fetchFeishuJson(url, {
    method: "POST",
    timeoutMs: feishuRequestTimeoutMs.batchWrite,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      records: plans.map((plan) => ({
        record_id: plan.recordId,
        fields: plan.fields,
      })),
    }),
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("批量更新飞书多维表记录失败，请稍后重试。");
  }
  invalidateBitableRecordCache(tableConfig.key);
}

async function executeVerifiedUpdatePlans(token, plans) {
  if (plans.length === 0) return { applied: [], failed: [], errors: [] };
  const groups = new Map();
  for (const plan of plans) {
    const group = groups.get(plan.tableConfig.key) || [];
    group.push(plan);
    groups.set(plan.tableConfig.key, group);
  }
  const tableBatches = [...groups.values()].map((group) => {
    const chunks = [];
    for (let index = 0; index < group.length; index += 500) {
      chunks.push(group.slice(index, index + 500));
    }
    return chunks;
  });

  const applied = [];
  const failed = [];
  const errors = [];
  const outcomeGroups = await Promise.all(
    tableBatches.map(async (batches) => {
      const tableOutcomes = [];
      for (const group of batches) {
        try {
          await updateBitableRecordBatch(token, group[0].tableConfig, group);
          tableOutcomes.push({ group, error: null });
        } catch (error) {
          invalidateBitableRecordCache(group[0].tableConfig.key);
          tableOutcomes.push({ group, error });
        }
      }
      return tableOutcomes;
    }),
  );
  const outcomes = outcomeGroups.flat();

  for (const outcome of outcomes) {
    if (!outcome.error) {
      applied.push(...outcome.group);
      continue;
    }
    errors.push(outcome.error.message);
    for (const plan of outcome.group) {
      try {
        const current = await getBitableRecord(token, plan.tableConfig, plan.recordId);
        if (plan.verify(current?.fields || {})) applied.push(plan);
        else failed.push(plan);
      } catch (error) {
        errors.push(error.message);
        failed.push(plan);
      }
    }
  }
  return { applied, failed, errors };
}

function assertAllUpdatePlansApplied(actionName, outcome) {
  if (outcome.failed.length === 0) return;
  const appliedCodes = [...new Set(outcome.applied.map((plan) => plan.materialCode))];
  const failedCodes = [...new Set(outcome.failed.map((plan) => plan.materialCode))];
  const appliedText = appliedCodes.length > 0 ? `已成功：${appliedCodes.join("、")}；` : "";
  const errorText = outcome.errors[0] ? `。原因：${outcome.errors[0]}` : "";
  throw new Error(`${actionName}部分执行，${appliedText}未成功：${failedCodes.join("、")}${errorText}`);
}

function bitableValueToText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") return String(item);
        return item?.text ?? item?.name ?? item?.email ?? item?.id ?? "";
      })
      .join("")
      .trim();
  }
  if (typeof value === "object") {
    return String(value.text ?? value.name ?? value.email ?? value.id ?? "");
  }
  return String(value).trim();
}

function plannedBitableFieldsMatch(currentFields, expectedFields, fieldTypes) {
  return Object.entries(expectedFields).every(([fieldName, expectedValue]) => {
    const currentValue = currentFields?.[fieldName];
    const fieldType = fieldTypes.get(fieldName);
    if (fieldType === 5) {
      return parseBitableDateValue(currentValue) === parseBitableDateValue(expectedValue);
    }
    if (fieldType === 2) {
      const currentNumber = Number(bitableValueToText(currentValue).replace(/,/g, ""));
      const expectedNumber = Number(bitableValueToText(expectedValue).replace(/,/g, ""));
      return Number.isFinite(currentNumber) &&
        Number.isFinite(expectedNumber) &&
        currentNumber === expectedNumber;
    }
    return bitableValueToText(currentValue) === bitableValueToText(expectedValue);
  });
}

export function isDrawClaimCommand(text) {
  return String(text || "").includes("\u9886\u56fe");
}

function cleanDrawingCommandText(text) {
  return String(text || "")
    .replace(/<at\b[^>]*>.*?<\/at>/g, " ")
    .replace(/@\S+/g, " ")
    .replace(/\u9886\u56fe/g, " ")
    .replace(/\u7ed8\u56fe\u5b8c\u6210|\u5b8c\u6210\u56fe|\u56fe\u7eb8\u5b8c\u6210/g, " ")
    .replace(/\u4e0b\u5355\u786e\u8ba4|\u786e\u8ba4\u4e0b\u5355/g, " ")
    .trim();
}

export function extractMaterialCodes(text) {
  const tokens = cleanDrawingCommandText(text)
    .split(/[\s,\uFF0C\u3001\u3002;\uFF1B|/\\]+/)
    .map((token) =>
      token
        .replace(/^(?:\u6599\u53f7|\u5efa\u6599\u53f7|\u56fe\u53f7)[:\uFF1A=]?/u, "")
        .replace(/^[\[\]()\uFF08\uFF09\u3010\u3011"'“”‘’]+|[\[\]()\uFF08\uFF09\u3010\u3011"'“”‘’]+$/g, "")
        .trim(),
    )
    .filter((token) => /[A-Za-z0-9]/.test(token));
  return [...new Set(tokens)];
}

const drawingMaterialFields = [
  "\u4e0b\u5355\u5efa\u6599\u53f7",
  "\u5efa\u6599\u53f7",
  "\u6599\u53f7",
  "\u56fe\u53f7",
];
const drawingOwnerField = "\u7ed8\u56fe\u4eba";
const drawingStatusField = "\u72b6\u6001";
const drawingDateField = "\u65e5\u671f";
const drawingClaimTimeField = "\u9886\u56fe\u5177\u4f53\u65f6\u95f4";
const drawingCompleteTimeField = "\u5b8c\u6210\u56fe\u5177\u4f53\u65f6\u95f4";
const drawingDurationField = "\u7528\u65f6";
const drawingDurationFieldAliases = ["用时（分）", "用时(分)", "用时（分钟）", "用时(分钟)", drawingDurationField];
const drawingScoreField = "分值";
const drawingRegionField = "区域";
const drawingOrderField = "是否下单";
const drawingOwnerAliases = {
  "\u83ab\u957f\u5cf0": "\u83ab\u957f\u950b",
};
const drawingStatuses = {
  unclaimed: "\u672a\u9886\u53d6",
  drawing: "\u7ed8\u56fe\u4e2d",
  done: "\u7ed8\u56fe\u5b8c\u6210",
};
const drawingOwnerRosterByTable = new Map();
const drawingOwnerRosterLoads = new Map();

function addDrawingOwnerToRoster(tableKey, owner, incrementOwned = false) {
  const normalizedOwner = String(owner || "").trim();
  const roster = drawingOwnerRosterByTable.get(tableKey);
  if (!normalizedOwner || !roster) return;
  const currentCount = roster.owners.get(normalizedOwner) || 0;
  roster.owners.set(normalizedOwner, currentCount + (incrementOwned ? 1 : 0));
}

function replaceDrawingOwnerRosterFromRecords(tableConfig, records) {
  const owners = new Map();
  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  for (const record of taskRecords) {
    const currentOwner = bitableValueToText(record.fields?.[drawingOwnerField]);
    const owner =
      resolveMappedOwnerName(currentOwner) ||
      drawingOwnerAliases[currentOwner] ||
      currentOwner;
    if (!owner) continue;
    owners.set(owner, (owners.get(owner) || 0) + 1);
  }
  const roster = {
    owners,
    totalRecords: taskRecords.length,
    refreshedAt: new Date().toISOString(),
  };
  drawingOwnerRosterByTable.set(tableConfig.key, roster);
  return roster;
}

async function loadDrawingOwnerRosterTable(token, tableConfig) {
  const records = await listBitableRecords(token, tableConfig, {
    fieldNames: [drawingOwnerField, ...drawingMaterialFields],
  });
  return replaceDrawingOwnerRosterFromRecords(tableConfig, records);
}

async function ensureDrawingOwnerRosterTable(token, tableConfig, force = false) {
  if (!force && drawingOwnerRosterByTable.has(tableConfig.key)) {
    return drawingOwnerRosterByTable.get(tableConfig.key);
  }
  if (drawingOwnerRosterLoads.has(tableConfig.key)) {
    return drawingOwnerRosterLoads.get(tableConfig.key);
  }
  const load = loadDrawingOwnerRosterTable(token, tableConfig).finally(() => {
    drawingOwnerRosterLoads.delete(tableConfig.key);
  });
  drawingOwnerRosterLoads.set(tableConfig.key, load);
  return load;
}

export async function refreshDrawingOwnerRoster({ tableKey } = {}) {
  const token = await getTenantAccessToken();
  const items = [];
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const roster = await ensureDrawingOwnerRosterTable(token, tableConfig, true);
    items.push({
      table: tableConfig.key,
      owners: roster.owners.size,
      totalRecords: roster.totalRecords,
      refreshedAt: roster.refreshedAt,
    });
  }
  return { items };
}

function normalizeMaterialCodes(materialCodes) {
  const codes = [...new Set((materialCodes || []).map((code) => String(code).trim()).filter(Boolean))];
  if (codes.length === 0) {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u8f93\u5165\u9700\u8981\u67e5\u8be2\u7684\u6599\u53f7");
  }
  return codes;
}

function normalizeMaterialCodeForMatch(value) {
  return bitableValueToText(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isOrderConfirmed(value) {
  if (value === true || value === 1) return true;
  if (Array.isArray(value)) return value.some((item) => isOrderConfirmed(item));
  if (value && typeof value === "object") {
    return isOrderConfirmed(value.value ?? value.text ?? value.name ?? value.label);
  }
  return /^(?:是|已下单|true|yes|1)$/i.test(String(value || "").trim());
}

function orderConfirmedValue(fieldType) {
  if (fieldType === 7) return true;
  if (fieldType === 4) return ["是"];
  return "是";
}

function matchDrawingRecordsByMaterialCodes(records, codes) {
  const matchedRecords = codes.map((materialCode) => ({
    materialCode,
    records: records.filter((record) =>
      drawingMaterialFields.some(
        (field) =>
          normalizeMaterialCodeForMatch(record.fields?.[field]) === normalizeMaterialCodeForMatch(materialCode),
      ),
    ),
  }));
  const missing = matchedRecords.filter((item) => item.records.length === 0).map((item) => item.materialCode);
  return { matchedRecords, missing };
}

function filterRecordsByDateRange(records, startDate, endDate) {
  return records.filter((record) => isRecordInDateRange(record, startDate, endDate));
}

function assertSingleMatchedRecordPerCode(matchedRecords, actionName) {
  const duplicated = matchedRecords.filter((item) => item.records.length > 1);
  if (duplicated.length === 0) return;
  const details = duplicated
    .map((item) => `${item.materialCode}(${item.records.length}条)`)
    .join("，");
  throw new Error(`${actionName}发现重复料号：${details}，本次未修改任何记录，请先检查表格`);
}

function assertUniqueMatchedItemsAcrossTables(matchedItems, actionName) {
  const matchesByCode = new Map();
  for (const item of matchedItems) {
    const normalizedCode = normalizeMaterialCodeForMatch(item.materialCode);
    if (!normalizedCode) continue;
    const current = matchesByCode.get(normalizedCode) || {
      materialCode: item.materialCode,
      count: 0,
    };
    current.count += item.records.length;
    matchesByCode.set(normalizedCode, current);
  }
  const duplicated = [...matchesByCode.values()].filter((item) => item.count > 1);
  if (duplicated.length === 0) return;
  const details = duplicated
    .map((item) => `${item.materialCode}(${item.count}条)`)
    .join("，");
  throw new Error(`${actionName}发现重复料号：${details}，本次未修改任何记录，请先检查表格`);
}

function getDrawingMaterialCode(fields) {
  for (const field of drawingMaterialFields) {
    const value = bitableValueToText(fields?.[field]);
    if (value) return value;
  }
  return "";
}

function duplicateMaterialCodes(values) {
  const counts = new Map();
  const displayValues = new Map();
  for (const value of values) {
    const displayValue = bitableValueToText(value).trim();
    const normalized = normalizeMaterialCodeForMatch(displayValue);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
    if (!displayValues.has(normalized)) displayValues.set(normalized, displayValue);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([normalized]) => displayValues.get(normalized));
}

async function assertNoDuplicateMaterialCodesBeforeCreate(token, tableConfig, fieldTypes, records) {
  const incomingCodes = records.map((record) => getDrawingMaterialCode(record)).filter(Boolean);
  if (incomingCodes.length === 0) return;

  const duplicatesInUpload = duplicateMaterialCodes(incomingCodes);
  if (duplicatesInUpload.length > 0) {
    throw new Error(
      `上传清单中发现重复料号：${duplicatesInUpload.join("、")}。本次未写入，请检查清单。`,
    );
  }
  const incomingByNormalizedCode = new Map(
    incomingCodes.map((code) => [normalizeMaterialCodeForMatch(code), code]),
  );
  const existingCodes = new Set(
    (
      await listRecentBitableRecords(token, tableConfig, fieldTypes, {
        fieldNames: drawingMaterialFields,
      })
    )
      .map((record) => normalizeMaterialCodeForMatch(getDrawingMaterialCode(record.fields)))
      .filter(Boolean),
  );
  const duplicatesInTable = [...incomingByNormalizedCode.entries()]
    .filter(([normalized]) => existingCodes.has(normalized))
    .map(([, displayValue]) => displayValue);

  if (duplicatesInTable.length > 0) {
    throw new Error(
      `${tableConfig.label}表最近500条中已存在相同料号：${duplicatesInTable.join("、")}。本次未写入，请检查后再上传。`,
    );
  }
}

function detectDrawingStatus(fields) {
  const currentStatus = bitableValueToText(fields?.[drawingStatusField]);
  const hasOwner = Boolean(bitableValueToText(fields?.[drawingOwnerField]));
  if (currentStatus === drawingStatuses.done && hasOwner) return drawingStatuses.done;
  if (!bitableValueToText(fields?.[drawingOwnerField])) return drawingStatuses.unclaimed;
  return drawingStatuses.drawing;
}

function formatDateTime(timestamp = Date.now()) {
  return formatShanghaiDateTime(timestamp);
}

function isBitableDateOnShanghaiDay(value, day) {
  const text = bitableValueToText(value);
  if (text.startsWith(day)) return true;
  const timestamp = parseBitableDateValue(value);
  return Boolean(timestamp && formatShanghaiDate(new Date(timestamp)) === day);
}

function bitableDateTimeValue(fieldTypes, fieldName, timestamp = Date.now()) {
  return fieldTypes.get(fieldName) === 5 ? timestamp : formatDateTime(timestamp);
}

export function calculateDurationMinutes(durationMs) {
  return Math.max(0, Math.round(Number(durationMs) / 60000));
}

function resolveDrawingDurationField(fieldTypes) {
  return drawingDurationFieldAliases.find((fieldName) => fieldTypes.has(fieldName)) ||
    [...fieldTypes.keys()].find((fieldName) => /^用时(?:[（(].*[）)])?$/.test(String(fieldName).trim())) ||
    null;
}

function drawingStatusProjection(fieldTypes) {
  const durationField = resolveDrawingDurationField(fieldTypes);
  return [
    drawingDateField,
    drawingOwnerField,
    drawingStatusField,
    drawingClaimTimeField,
    drawingCompleteTimeField,
    durationField,
    ...drawingMaterialFields,
  ].filter((fieldName, index, fields) =>
    fieldName && fieldTypes.has(fieldName) && fields.indexOf(fieldName) === index,
  );
}

function drawingDurationProjection(fieldTypes, durationField) {
  return [
    drawingDateField,
    drawingClaimTimeField,
    drawingCompleteTimeField,
    durationField,
    ...drawingMaterialFields,
  ].filter((fieldName, index, fields) =>
    fieldName && fieldTypes.has(fieldName) && fields.indexOf(fieldName) === index,
  );
}

function durationValue(fieldTypes, durationField, claimTimestamp, completeTimestamp) {
  const minutes = calculateDrawingWorkDurationMinutes(claimTimestamp, completeTimestamp);
  return fieldTypes.get(durationField) === 2 ? minutes : String(minutes);
}

function bitableValueToNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const nestedValue = value.value ?? value.text ?? value.name;
    if (nestedValue !== undefined && nestedValue !== value) return bitableValueToNumber(nestedValue);
  }
  const text = bitableValueToText(value).replace(/,/g, "").trim();
  if (!text) return null;
  const numericMatch = text.match(/-?\d+(?:\.\d+)?/);
  const number = Number(numericMatch?.[0]);
  return Number.isFinite(number) ? number : null;
}

function parseDateBoundary(value, endOfDay = false) {
  return parseShanghaiDateBoundary(value, endOfDay);
}

function parseBitableDateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value < 1000000000000 ? value * 1000 : value;
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return parseBitableDateValue(value[0]);
  if (typeof value === "object") {
    return parseBitableDateValue(value.timestamp ?? value.value ?? value.text ?? value.name);
  }
  const text = String(value || "").trim();
  if (/^\d{10,13}$/.test(text)) {
    const timestamp = Number(text);
    return text.length <= 10 ? timestamp * 1000 : timestamp;
  }
  return parseShanghaiDateTime(text);
}

function isRecordInDateRange(record, startDate, endDate) {
  const startTime = parseDateBoundary(startDate);
  const endTime = parseDateBoundary(endDate, true);
  if (!startTime && !endTime) return true;
  const recordTime = parseBitableDateValue(record.fields?.[drawingDateField]);
  if (!recordTime) return false;
  if (startTime && recordTime < startTime) return false;
  if (endTime && recordTime > endTime) return false;
  return true;
}

function isBitableDateInRange(value, startDate, endDate) {
  const timestamp = parseBitableDateValue(value);
  if (!timestamp) return false;
  const startTime = parseDateBoundary(startDate);
  const endTime = parseDateBoundary(endDate, true);
  if (startTime && timestamp < startTime) return false;
  if (endTime && timestamp > endTime) return false;
  return true;
}

function stableBitableValue(value) {
  if (Array.isArray(value)) return value.map((item) => stableBitableValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableBitableValue(value[key])]),
    );
  }
  return value ?? "";
}

function recordFingerprint(record) {
  return {
    recordId: record.record_id,
    fields: stableBitableValue(record.fields || {}),
  };
}

export async function getDrawingStatusFingerprint({ startDate, endDate, tableKey } = {}) {
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const records = filterRecordsByDateRange(
    await listCachedBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: drawingStatusProjection(fieldTypes),
    }),
    startDate,
    endDate,
  )
    .map(recordFingerprint)
    .sort((left, right) => left.recordId.localeCompare(right.recordId));
  return JSON.stringify(records);
}

export async function syncDrawingStatuses({
  startDate,
  endDate,
  tableKey,
  fillMissingTimestamps = true,
} = {}) {
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const durationField = resolveDrawingDurationField(fieldTypes);
  const records = filterRecordsByDateRange(
    await listBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: drawingStatusProjection(fieldTypes),
    }),
    startDate,
    endDate,
  );
  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
  if (!fieldTypes.has(drawingStatusField)) throw new Error(`数据表缺少字段：${drawingStatusField}`);

  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  const summary = {
    total: taskRecords.length,
    unclaimed: 0,
    drawing: 0,
    done: 0,
    updated: 0,
    skippedBlank: records.length - taskRecords.length,
    missingClaimTime: 0,
    missingCompleteTime: 0,
    timestampsBackfilled: 0,
    fillMissingTimestamps,
  };
  const updatePlans = [];

  for (const record of taskRecords) {
    const nextStatus = detectDrawingStatus(record.fields || {});
    const currentStatus = bitableValueToText(record.fields?.[drawingStatusField]);
    const fieldsToUpdate = {};
    if (nextStatus !== currentStatus) fieldsToUpdate[drawingStatusField] = nextStatus;

    const currentOwner = bitableValueToText(record.fields?.[drawingOwnerField]);
    const mappedOwnerName = resolveMappedOwnerName(currentOwner);
    const normalizedOwnerName = mappedOwnerName || drawingOwnerAliases[currentOwner];
    if (normalizedOwnerName) fieldsToUpdate[drawingOwnerField] = normalizedOwnerName;

    const hasOwner = Boolean(currentOwner);
    const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(record.fields?.[drawingCompleteTimeField]);
    const now = Date.now();
    if (hasOwner && !claimTime) {
      summary.missingClaimTime += 1;
      if (fillMissingTimestamps && fieldTypes.has(drawingClaimTimeField)) {
        fieldsToUpdate[drawingClaimTimeField] = bitableDateTimeValue(fieldTypes, drawingClaimTimeField, now);
        summary.timestampsBackfilled += 1;
      }
    }
    if (nextStatus === drawingStatuses.done && !completeTime) {
      summary.missingCompleteTime += 1;
      if (fillMissingTimestamps && fieldTypes.has(drawingCompleteTimeField)) {
        fieldsToUpdate[drawingCompleteTimeField] = bitableDateTimeValue(fieldTypes, drawingCompleteTimeField, now);
        summary.timestampsBackfilled += 1;
      }
    }
    const effectiveCompleteTime = completeTime || parseBitableDateValue(fieldsToUpdate[drawingCompleteTimeField]);
    if (claimTime && effectiveCompleteTime && durationField) {
      const nextDuration = durationValue(fieldTypes, durationField, claimTime, effectiveCompleteTime);
      const currentDuration = bitableValueToText(record.fields?.[durationField]);
      if (currentDuration !== String(nextDuration)) {
        fieldsToUpdate[durationField] = nextDuration;
      }
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      updatePlans.push({
        tableConfig,
        recordId: record.record_id,
        materialCode: getDrawingMaterialCode(record.fields || {}),
        fields: fieldsToUpdate,
        verify: (currentFields) =>
          plannedBitableFieldsMatch(currentFields, fieldsToUpdate, fieldTypes),
      });
    }

    if (nextStatus === drawingStatuses.unclaimed) summary.unclaimed += 1;
    else if (nextStatus === drawingStatuses.drawing) summary.drawing += 1;
    else if (nextStatus === drawingStatuses.done) summary.done += 1;
  }

  const updateOutcome = await executeVerifiedUpdatePlans(token, updatePlans);
  summary.updated = updateOutcome.applied.length;
  assertAllUpdatePlansApplied("状态检测", updateOutcome);

  const rosterRefreshed = !startDate && !endDate;
  if (rosterRefreshed) replaceDrawingOwnerRosterFromRecords(tableConfig, records);
  return { table: tableConfig.key, summary, rosterRefreshed };
}

export async function recalculateDrawingDurations({ startDate, endDate, tableKey } = {}) {
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const durationField = resolveDrawingDurationField(fieldTypes);
  const records = filterRecordsByDateRange(
    await listBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: drawingDurationProjection(fieldTypes, durationField),
    }),
    startDate,
    endDate,
  );

  if (!fieldTypes.has(drawingClaimTimeField)) throw new Error(`数据表缺少字段：${drawingClaimTimeField}`);
  if (!fieldTypes.has(drawingCompleteTimeField)) throw new Error(`数据表缺少字段：${drawingCompleteTimeField}`);
  if (!durationField) throw new Error(`数据表缺少字段：${drawingDurationField}`);

  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  const summary = {
    scanned: taskRecords.length,
    eligible: 0,
    updated: 0,
    missingTime: 0,
    invalidTime: 0,
    skippedBlank: records.length - taskRecords.length,
  };
  const updatePlans = [];

  for (const record of taskRecords) {
    const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(record.fields?.[drawingCompleteTimeField]);
    if (!claimTime || !completeTime) {
      summary.missingTime += 1;
      continue;
    }
    if (completeTime < claimTime) {
      summary.invalidTime += 1;
      continue;
    }

    summary.eligible += 1;
    const nextDuration = durationValue(fieldTypes, durationField, claimTime, completeTime);
    const currentDuration = bitableValueToText(record.fields?.[durationField]);
    if (currentDuration === String(nextDuration)) continue;

    const fieldsToUpdate = { [durationField]: nextDuration };
    updatePlans.push({
      tableConfig,
      recordId: record.record_id,
      materialCode: getDrawingMaterialCode(record.fields || {}),
      fields: fieldsToUpdate,
      verify: (currentFields) =>
        plannedBitableFieldsMatch(currentFields, fieldsToUpdate, fieldTypes),
    });
  }

  const updateOutcome = await executeVerifiedUpdatePlans(token, updatePlans);
  summary.updated = updateOutcome.applied.length;
  assertAllUpdatePlansApplied("重算用时", updateOutcome);

  return { table: tableConfig.key, summary };
}

export async function queryUnclaimedDrawings({ tableKey } = {}) {
  const token = await getTenantAccessToken();
  const items = [];
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
    const records = await listCachedBitableRecords(token, tableConfig, {
      fieldNames: [drawingOwnerField, ...drawingMaterialFields].filter((fieldName) =>
        fieldTypes.has(fieldName),
      ),
      filterConditions: [{
        field_name: drawingOwnerField,
        operator: "isEmpty",
        value: [],
      }],
    });
    items.push(
      ...records
        .filter(
          (record) =>
            getDrawingMaterialCode(record.fields || {}) &&
            !bitableValueToText(record.fields?.[drawingOwnerField]),
        )
        .map((record) => ({
          table: tableConfig.key,
          recordId: record.record_id,
          materialCode: getDrawingMaterialCode(record.fields) || "\u672a\u586b\u6599\u53f7",
          claimed: false,
          owner: "",
          message: `${getDrawingMaterialCode(record.fields) || "\u672a\u586b\u6599\u53f7"}\u672a\u88ab\u9886\u53d6`,
        })),
    );
  }

  return {
    table: tableKey ? resolveTableKey(tableKey) : "all",
    items,
    count: items.length,
  };
}

export async function queryDrawingOwnerStats({ tableKey } = {}) {
  const token = await getTenantAccessToken();
  const owners = new Map();
  const today = formatShanghaiDate();
  let totalRecords = 0;

  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
    if (!fieldTypes.has(drawingStatusField)) throw new Error(`数据表缺少字段：${drawingStatusField}`);

    const roster = await ensureDrawingOwnerRosterTable(token, tableConfig);
    totalRecords += roster.totalRecords;
    for (const [owner, totalOwned] of roster.owners) {
      if (!owners.has(owner)) {
        owners.set(owner, {
          owner,
          status: "idle",
          drawingCount: 0,
          todayClaimed: 0,
          todayCompleted: 0,
          totalOwned: 0,
          activeItems: [],
        });
      }
      owners.get(owner).totalOwned += totalOwned;
    }

    const selectedFields = [
      drawingOwnerField,
      drawingStatusField,
      drawingClaimTimeField,
      drawingCompleteTimeField,
      ...drawingMaterialFields,
    ].filter((fieldName) => fieldTypes.has(fieldName));
    const filterConditions = [{
      field_name: drawingStatusField,
      operator: "is",
      value: [drawingStatuses.drawing],
    }];
    if (fieldTypes.has(drawingClaimTimeField)) {
      filterConditions.push({
        field_name: drawingClaimTimeField,
        operator: "contains",
        value: [today],
      });
    }
    if (fieldTypes.has(drawingCompleteTimeField)) {
      filterConditions.push({
        field_name: drawingCompleteTimeField,
        operator: "contains",
        value: [today],
      });
    }
    const liveRecords = await listCachedBitableRecords(token, tableConfig, {
      fieldNames: selectedFields,
      filterConditions,
      filterConjunction: "or",
    });

    const getOwnerItem = (fields) => {
      const owner = bitableValueToText(fields?.[drawingOwnerField]);
      if (!owner) return null;
      if (!owners.has(owner)) {
        owners.set(owner, {
          owner,
          status: "idle",
          drawingCount: 0,
          todayClaimed: 0,
          todayCompleted: 0,
          totalOwned: 0,
          activeItems: [],
        });
      }
      return owners.get(owner);
    };

    for (const record of liveRecords) {
      const fields = record.fields || {};
      if (!getDrawingMaterialCode(fields)) continue;
      const item = getOwnerItem(fields);
      if (!item) continue;
      if (detectDrawingStatus(fields) === drawingStatuses.drawing) {
        const materialCode = getDrawingMaterialCode(fields) || "\u672a\u586b\u6599\u53f7";
        item.drawingCount += 1;
        item.activeItems.push({
          table: tableConfig.key,
          recordId: record.record_id,
          materialCode,
        });
      }
      if (isBitableDateOnShanghaiDay(fields[drawingClaimTimeField], today)) {
        item.todayClaimed += 1;
      }
      if (isBitableDateOnShanghaiDay(fields[drawingCompleteTimeField], today)) {
        item.todayCompleted += 1;
      }
    }
  }

  const items = [...owners.values()]
    .map((item) => ({
      ...item,
      status: item.drawingCount > 0 ? "drawing" : "idle",
    }))
    .sort(
      (left, right) =>
        right.drawingCount - left.drawingCount ||
        right.todayClaimed - left.todayClaimed ||
        right.todayCompleted - left.todayCompleted ||
        left.owner.localeCompare(right.owner, "zh-CN"),
    );

  return {
    table: tableKey ? resolveTableKey(tableKey) : "all",
    checkedAt: new Date().toISOString(),
    totalRecords,
    summary: {
      owners: items.length,
      idle: items.filter((item) => item.status === "idle").length,
      drawing: items.filter((item) => item.status === "drawing").length,
      drawingCount: items.reduce((sum, item) => sum + item.drawingCount, 0),
      todayClaimed: items.reduce((sum, item) => sum + item.todayClaimed, 0),
      todayCompleted: items.reduce((sum, item) => sum + item.todayCompleted, 0),
    },
    items,
  };
}

export async function queryHomeDashboardTable({ startDate, endDate, tableKey } = {}) {
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const selectedFields = [
    drawingDateField,
    drawingOwnerField,
    drawingStatusField,
    drawingClaimTimeField,
    drawingCompleteTimeField,
    ...drawingMaterialFields,
  ].filter((fieldName) => fieldTypes.has(fieldName));
  const [records, recentEventRecords] = await Promise.all([
    listCachedBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: selectedFields,
    }).then((items) => filterRecordsByDateRange(items, startDate, endDate)),
    listCachedRecentBitableRecords(token, tableConfig, fieldTypes, {
      limit: 500,
      fieldNames: selectedFields,
    }),
  ]);
  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  const eventTaskRecords = recentEventRecords.filter((record) =>
    getDrawingMaterialCode(record.fields || {}),
  );
  const summary = { total: taskRecords.length, unclaimed: 0, drawing: 0, done: 0 };
  const events = [];

  for (const record of taskRecords) {
    const fields = record.fields || {};
    const status = detectDrawingStatus(fields);
    const owner = bitableValueToText(fields[drawingOwnerField]);
    const materialCode = getDrawingMaterialCode(fields) || "未填料号";
    const claimTime = parseBitableDateValue(fields[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(fields[drawingCompleteTimeField]);
    const createdTime = parseBitableDateValue(record.created_time);

    if (status === drawingStatuses.unclaimed) summary.unclaimed += 1;
    else if (status === drawingStatuses.drawing) summary.drawing += 1;
    else if (status === drawingStatuses.done) summary.done += 1;

    if (createdTime) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:created:${createdTime}`,
        time: new Date(createdTime).toISOString(),
        type: "任务",
        source: tableConfig.label,
        content: `${materialCode}进入任务队列`,
        status: "正常",
      });
    }
    if (claimTime && isBitableDateInRange(claimTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:claim:${claimTime}`,
        time: new Date(claimTime).toISOString(),
        type: "接图",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}领取 ${materialCode}`,
        status: "正常",
      });
    }
    if (completeTime && isBitableDateInRange(completeTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:complete:${completeTime}`,
        time: new Date(completeTime).toISOString(),
        type: "完成",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}完成 ${materialCode}`,
        status: "成功",
      });
    }
  }

  const taskRecordIds = new Set(taskRecords.map((record) => record.record_id));
  for (const record of eventTaskRecords) {
    if (taskRecordIds.has(record.record_id)) continue;
    const fields = record.fields || {};
    const owner = bitableValueToText(fields[drawingOwnerField]);
    const materialCode = getDrawingMaterialCode(fields) || "未填料号";
    const claimTime = parseBitableDateValue(fields[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(fields[drawingCompleteTimeField]);

    if (claimTime && isBitableDateInRange(claimTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:claim:${claimTime}`,
        time: new Date(claimTime).toISOString(),
        type: "领图",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}领取 ${materialCode}`,
        status: "正常",
      });
    }
    if (completeTime && isBitableDateInRange(completeTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:complete:${completeTime}`,
        time: new Date(completeTime).toISOString(),
        type: "完成",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}完成 ${materialCode}`,
        status: "成功",
      });
    }
  }

  events.sort((left, right) => Date.parse(right.time) - Date.parse(left.time));
  return {
    table: tableConfig.key,
    tableLabel: tableConfig.label,
    range: { startDate: startDate || "", endDate: endDate || "" },
    summary,
    events: events.slice(0, 12),
  };
}

export async function queryDrawingAnalytics({ startDate, endDate, tableKey } = {}) {
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const durationField = resolveDrawingDurationField(fieldTypes);
  const selectedFields = [
    drawingDateField,
    drawingOwnerField,
    drawingScoreField,
    drawingRegionField,
    durationField,
    ...drawingMaterialFields,
  ].filter((fieldName) => fieldName && fieldTypes.has(fieldName));
  const records = filterRecordsByDateRange(
    await listCachedBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: selectedFields,
    }),
    startDate,
    endDate,
  );

  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));

  const owners = new Map();
  const regions = new Map();
  let totalScore = 0;
  let scoredRecords = 0;
  let totalDuration = 0;
  let durationRecords = 0;

  for (const record of taskRecords) {
    const fields = record.fields || {};
    const owner = bitableValueToText(fields[drawingOwnerField]) || "未分配";
    const region = bitableValueToText(fields[drawingRegionField]) || "未填写";
    const score = bitableValueToNumber(fields[drawingScoreField]);
    const duration = durationField ? bitableValueToNumber(fields[durationField]) : null;

    if (!owners.has(owner)) {
      owners.set(owner, {
        name: owner,
        count: 0,
        score: 0,
        scoredRecords: 0,
        durationTotal: 0,
        durationRecords: 0,
      });
    }
    const ownerItem = owners.get(owner);
    ownerItem.count += 1;
    if (score !== null) {
      ownerItem.score += score;
      ownerItem.scoredRecords += 1;
      totalScore += score;
      scoredRecords += 1;
    }
    if (duration !== null) {
      ownerItem.durationTotal += duration;
      ownerItem.durationRecords += 1;
      totalDuration += duration;
      durationRecords += 1;
    }

    regions.set(region, (regions.get(region) || 0) + 1);
  }

  const ownerItems = [...owners.values()]
    .map((item) => ({
      name: item.name,
      count: item.count,
      score: Math.round(item.score * 10) / 10,
      scoredRecords: item.scoredRecords,
      averageDuration:
        item.durationRecords > 0 ? Math.round((item.durationTotal / item.durationRecords) * 10) / 10 : null,
      durationRecords: item.durationRecords,
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));

  const regionItems = [...regions.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));

  return {
    table: tableConfig.key,
    tableLabel: tableConfig.label,
    range: { startDate: startDate || "", endDate: endDate || "" },
    checkedAt: new Date().toISOString(),
    summary: {
      total: taskRecords.length,
      owners: ownerItems.filter((item) => item.name !== "未分配").length,
      regions: regionItems.filter((item) => item.name !== "未填写").length,
      totalScore: Math.round(totalScore * 10) / 10,
      scoredRecords,
      averageDuration: durationRecords > 0 ? Math.round((totalDuration / durationRecords) * 10) / 10 : null,
      durationRecords,
    },
    owners: ownerItems,
    regions: regionItems,
    fields: {
      score: fieldTypes.has(drawingScoreField),
      region: fieldTypes.has(drawingRegionField),
      duration: Boolean(durationField),
      durationField,
    },
  };
}

export async function queryDrawingClaimStatus({ materialCodes, tableKey }) {
  const codes = normalizeMaterialCodes(materialCodes);
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const records = await listRecentBitableRecords(token, tableConfig, fieldTypes);
  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);

  const { matchedRecords, missing } = matchDrawingRecordsByMaterialCodes(records, codes);
  const items = matchedRecords.flatMap((item) =>
    item.records.map((record) => {
      const owner = bitableValueToText(record.fields?.[drawingOwnerField]);
      return {
        materialCode: item.materialCode,
        recordId: record.record_id,
        owner,
        claimed: Boolean(owner),
        message: owner
          ? `${item.materialCode}\u5df2\u88ab${owner}\u9886\u53d6`
          : `${item.materialCode}\u672a\u88ab\u9886\u53d6`,
      };
    }),
  );
  return {
    table: tableConfig.key,
    items,
    missing,
    unclaimed: items.filter((item) => !item.claimed),
    claimed: items.filter((item) => item.claimed),
  };
}

export async function claimDrawingOwners({ materialCodes, senderName, senderId, tableKey }) {
  let codes;
  try {
    codes = normalizeMaterialCodes(materialCodes);
  } catch {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u6309\u683c\u5f0f\u53d1\u9001\uff1a@\u673a\u5668\u4eba I-089F-K42 \u9886\u56fe");
  }

  const claimedByCode = new Map();
  const unclaimedItems = [];
  const foundCodes = new Set();
  const token = await getTenantAccessToken();
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    const records = await listRecentBitableRecords(token, tableConfig, fieldTypes);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);

    const remainingCodes = codes.filter((code) => !foundCodes.has(code));
    if (remainingCodes.length === 0) break;
    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(records, remainingCodes);
    assertSingleMatchedRecordPerCode(matchedRecords, `${tableConfig.label}领图`);
    for (const item of matchedRecords) {
      if (item.records.length === 0) continue;
      foundCodes.add(item.materialCode);
      const unclaimedRecords = [];
      for (const record of item.records) {
        const currentOwner = bitableValueToText(record.fields?.[drawingOwnerField]);
        if (currentOwner) claimedByCode.set(item.materialCode, currentOwner);
        else unclaimedRecords.push(record);
      }
      if (unclaimedRecords.length > 0) {
        unclaimedItems.push({ materialCode: item.materialCode, records: unclaimedRecords, fieldTypes, tableConfig });
      }
    }
  }
  const missing = codes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) throw new Error(`未找到料号：${missing.join("，")}`);

  if (claimedByCode.size > 0) {
    const details = [...claimedByCode.entries()]
      .map(([materialCode, owner]) => `${materialCode}(\u5df2\u88ab${owner}\u9886\u53d6)`)
      .join("\uFF0C");
    throw new Error(`${details}\uFF0C\u4e0d\u53ef\u91cd\u590d\u9886\u53d6`);
  }

  const now = Date.now();
  const plans = [];
  for (const item of unclaimedItems) {
    const ownerType = item.fieldTypes.get(drawingOwnerField);
    const ownerValue = resolveDrawingOwnerValue(senderName, senderId, ownerType);
    for (const record of item.records) {
      const fields = { [drawingOwnerField]: ownerValue };
      if (item.fieldTypes.has(drawingStatusField)) fields[drawingStatusField] = drawingStatuses.drawing;
      if (item.fieldTypes.has(drawingClaimTimeField)) {
        fields[drawingClaimTimeField] = bitableDateTimeValue(item.fieldTypes, drawingClaimTimeField, now);
      }
      const expectedOwner = normalizedDrawingOwnerIdentity(ownerValue);
      plans.push({
        tableConfig: item.tableConfig,
        recordId: record.record_id,
        materialCode: item.materialCode,
        fields,
        ownerValue,
        verify: (currentFields) =>
          normalizedDrawingOwnerIdentity(currentFields?.[drawingOwnerField]) === expectedOwner,
      });
    }
  }
  const outcome = await executeVerifiedUpdatePlans(token, plans);
  for (const plan of outcome.applied) {
      const ownerText = bitableValueToText(plan.ownerValue);
      addDrawingOwnerToRoster(
        plan.tableConfig.key,
        resolveMappedOwnerName(ownerText) || ownerText,
        true,
      );
  }
  assertAllUpdatePlansApplied("领图", outcome);
  return plans.map((plan) => ({
    table: plan.tableConfig.key,
    recordId: plan.recordId,
    materialCode: plan.materialCode,
  }));
}

function normalizedDrawingOwnerIdentity(value) {
  const text = bitableValueToText(value);
  return resolveMappedOwnerName(text) || drawingOwnerAliases[text] || text;
}

export async function completeDrawings({
  materialCodes,
  tableKey,
  senderName,
  senderId,
  allowOwnerOverride = false,
}) {
  let codes;
  try {
    codes = normalizeMaterialCodes(materialCodes);
  } catch {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u8f93\u5165\u9700\u8981\u6807\u8bb0\u5b8c\u6210\u7684\u6599\u53f7");
  }

  const foundCodes = new Set();
  const matchedItems = [];
  const token = await getTenantAccessToken();
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    const durationField = resolveDrawingDurationField(fieldTypes);
    const records = await listRecentBitableRecords(token, tableConfig, fieldTypes);
    if (!fieldTypes.has(drawingStatusField)) throw new Error(`数据表缺少字段：${drawingStatusField}`);

    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(records, codes);
    for (const item of matchedRecords) {
      if (item.records.length === 0) continue;
      foundCodes.add(item.materialCode);
      matchedItems.push({ ...item, fieldTypes, durationField, tableConfig });
    }
  }
  const missing = codes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) throw new Error(`未找到料号：${missing.join("，")}`);
  assertUniqueMatchedItemsAcrossTables(matchedItems, "图纸完成");

  const cleanSenderId = String(senderId || "").trim();
  const actor = normalizedDrawingOwnerIdentity(
    (cleanSenderId && readNameIdMap()[cleanSenderId]) ||
      String(senderName || "").trim() ||
      cleanSenderId,
  );
  const candidates = matchedItems.flatMap((item) =>
    item.records.map((record) => ({ ...item, records: undefined, record })),
  );
  const validationErrors = [];
  for (const item of candidates) {
    if (bitableValueToText(item.record.fields?.[drawingStatusField]) === drawingStatuses.done) {
      continue;
    }
    const owner = normalizedDrawingOwnerIdentity(item.record.fields?.[drawingOwnerField]);
    if (!owner) {
      validationErrors.push(`${item.materialCode}尚未领图，请先领图`);
      continue;
    }
    if (!allowOwnerOverride && (!actor || actor !== owner)) {
      validationErrors.push(`${item.materialCode}由${owner}领取，只有领取人本人可以完成`);
    }
  }
  if (validationErrors.length > 0) throw new Error(validationErrors.join("；"));

  const result = [];
  const plans = [];
  for (const item of matchedItems) {
    for (const record of item.records) {
      if (bitableValueToText(record.fields?.[drawingStatusField]) === drawingStatuses.done) {
        result.push({
          table: item.tableConfig.key,
          recordId: record.record_id,
          materialCode: item.materialCode,
          changed: false,
          alreadyCompleted: true,
          owner: normalizedDrawingOwnerIdentity(record.fields?.[drawingOwnerField]),
          adminOverride: false,
        });
        continue;
      }
      const now = Date.now();
      const fields = {
        [drawingStatusField]: drawingStatuses.done,
      };
      if (item.fieldTypes.has(drawingCompleteTimeField)) {
        fields[drawingCompleteTimeField] = bitableDateTimeValue(item.fieldTypes, drawingCompleteTimeField, now);
      }
      const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
      if (claimTime && item.durationField) {
        fields[item.durationField] = durationValue(
          item.fieldTypes,
          item.durationField,
          claimTime,
          now,
        );
      }
      const plan = {
        tableConfig: item.tableConfig,
        recordId: record.record_id,
        materialCode: item.materialCode,
        fields,
        verify: (currentFields) =>
          bitableValueToText(currentFields?.[drawingStatusField]) === drawingStatuses.done,
        result: {
          table: item.tableConfig.key,
          recordId: record.record_id,
          materialCode: item.materialCode,
          changed: true,
          alreadyCompleted: false,
          owner: normalizedDrawingOwnerIdentity(record.fields?.[drawingOwnerField]),
          adminOverride: allowOwnerOverride,
        },
      };
      plans.push(plan);
      result.push(plan.result);
    }
  }
  const outcome = await executeVerifiedUpdatePlans(token, plans);
  assertAllUpdatePlansApplied("图纸完成", outcome);
  return result;
}

export async function confirmDrawingOrders({ materialCodes, tableKey }) {
  let codes;
  try {
    codes = normalizeMaterialCodes(materialCodes);
  } catch {
    throw new Error("缺少料号，请输入需要确认下单的料号");
  }

  const foundCodes = new Set();
  const matchedItems = [];
  const token = await getTenantAccessToken();
  let eligibleTableCount = 0;
  for (const key of drawingTableKeys(tableKey)) {
    let tableConfig;
    try {
      tableConfig = getBitableConfig(key);
    } catch (error) {
      if (tableKey) throw error;
      continue;
    }
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    if (!fieldTypes.has(drawingOrderField)) {
      if (tableKey) throw new Error(`${tableConfig.label}表缺少“${drawingOrderField}”字段`);
      continue;
    }
    eligibleTableCount += 1;

    const orderProjection = [
      ...drawingMaterialFields,
      drawingOrderField,
    ].filter((fieldName) => fieldTypes.has(fieldName));
    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(
      await listBitableRecords(token, tableConfig, {
        fieldNames: orderProjection,
      }),
      codes,
    );
    for (const item of matchedRecords) {
      if (item.records.length === 0) continue;
      foundCodes.add(item.materialCode);
      matchedItems.push({ ...item, fieldTypes, tableConfig });
    }
  }

  if (eligibleTableCount === 0) {
    throw new Error(`已配置的数据表均缺少“${drawingOrderField}”字段`);
  }

  const missing = codes.filter((code) => !foundCodes.has(code));
  if (matchedItems.length === 0) throw new Error(`未找到料号：${missing.join("，")}`);
  assertUniqueMatchedItemsAcrossTables(matchedItems, "下单确认");

  const result = [];
  const plans = [];
  for (const item of matchedItems) {
    const fieldType = item.fieldTypes.get(drawingOrderField);
    for (const record of item.records) {
      const alreadyConfirmed = isOrderConfirmed(record.fields?.[drawingOrderField]);
      if (!alreadyConfirmed) {
        plans.push({
          tableConfig: item.tableConfig,
          recordId: record.record_id,
          materialCode: item.materialCode,
          fields: { [drawingOrderField]: orderConfirmedValue(fieldType) },
          verify: (currentFields) => isOrderConfirmed(currentFields?.[drawingOrderField]),
        });
      }
      result.push({
        table: item.tableConfig.key,
        recordId: record.record_id,
        materialCode: item.materialCode,
        changed: !alreadyConfirmed,
      });
    }
  }
  const outcome = await executeVerifiedUpdatePlans(token, plans);
  assertAllUpdatePlansApplied("下单确认", outcome);
  return { result, missing };
}

async function uploadBitableImage(token, tableConfig, image) {
  if (!image?.buffer) throw new Error("未在表格中找到图片数据。");
  const form = new FormData();
  form.append("file_name", image.fileName);
  form.append("parent_type", "bitable_image");
  form.append("parent_node", tableConfig.appToken);
  form.append("size", String(image.buffer.length));
  form.append("file", new Blob([image.buffer], { type: image.mimeType }), image.fileName);

  const { response, data } = await fetchFeishuJson("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
    method: "POST",
    timeoutMs: feishuRequestTimeoutMs.mediaUpload,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("上传图片到飞书多维表失败，已跳过该图片。");
  }
  return data.data?.file_token;
}

function normalizeAttachmentValue(value) {
  if (Array.isArray(value)) {
    const attachments = value.filter(
      (item) => item && typeof item === "object" && typeof item.file_token === "string" && item.file_token.trim(),
    );
    return attachments.length > 0 ? attachments : null;
  }
  if (value && typeof value === "object" && typeof value.file_token === "string" && value.file_token.trim()) {
    return [value];
  }
  return null;
}

async function convertRecordByFieldTypes(record, fieldTypes, token, tableConfig, uploadCache, warnings) {
  const converted = {};
  for (const [fieldName, rawValue] of Object.entries(record)) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) continue;
    const type = fieldTypes.get(fieldName);
    if (type === undefined) {
      console.log(`Skip unknown field "${fieldName}" because it does not exist in the target table.`);
      continue;
    }
    if (rawValue && typeof rawValue === "object" && rawValue.__imageId) {
      if (type !== 17) {
        const fallback = String(rawValue.fallback || "").trim();
        if (fallback && !parseDispimgId(fallback)) {
          converted[fieldName] = String(normalizeValue(fallback));
        } else {
          console.log(`Skip image value in non-attachment field "${fieldName}".`);
        }
        continue;
      }
      if (!rawValue.image) {
        const warning = `图片 ${rawValue.__imageId} 在表格中被引用，但没有找到图片数据`;
        warnings.push(warning);
        console.log(warning);
        continue;
      }
      try {
        if (!uploadCache.has(rawValue.__imageId)) {
          uploadCache.set(rawValue.__imageId, await uploadBitableImage(token, tableConfig, rawValue.image));
        }
        converted[fieldName] = [{ file_token: uploadCache.get(rawValue.__imageId) }];
      } catch (error) {
        const warning = `图片字段「${fieldName}」上传失败，已跳过图片：${error.message}`;
        warnings.push(warning);
        console.log(warning);
      }
      continue;
    }
    if (type === 17) {
      const attachments = normalizeAttachmentValue(rawValue);
      if (attachments) {
        converted[fieldName] = attachments;
      } else {
        const warning = `附件字段「${fieldName}」没有可上传的附件对象，已跳过该字段。`;
        warnings.push(warning);
        console.log(warning);
      }
      continue;
    }
    if (type === 2) {
      const numberValue = Number(String(rawValue).replace(/,/g, ""));
      if (!Number.isNaN(numberValue)) converted[fieldName] = numberValue;
      continue;
    }
    if (type === 5) {
      converted[fieldName] = parseDateToTimestamp(rawValue);
      continue;
    }
    if (type === 7) {
      converted[fieldName] =
        rawValue === true ||
        String(rawValue).trim() === "1" ||
        String(rawValue).trim().toLowerCase() === "true" ||
        String(rawValue).trim() === "\u662f";
      continue;
    }
    if (type === 11) {
      console.log(`Skip person field "${fieldName}" because user lookup is not configured.`);
      continue;
    }
    converted[fieldName] = String(normalizeValue(rawValue));
  }
  return converted;
}

export async function createBitableRecords(records, { tableKey } = {}) {
  if (!Array.isArray(records)) throw new Error("写入记录格式无效");
  if (records.length > spreadsheetLimits.importRows) {
    throw new Error(
      `本次共有 ${records.length} 行，单次最多允许 ${spreadsheetLimits.importRows} 行，请拆分后重试。`,
    );
  }
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  await assertNoDuplicateMaterialCodesBeforeCreate(token, tableConfig, fieldTypes, records);
  const uploadCache = new Map();
  const convertedRecords = [];
  const warnings = Array.isArray(records.warnings) ? [...records.warnings] : [];
  for (const record of records) {
    const converted = await convertRecordByFieldTypes(record, fieldTypes, token, tableConfig, uploadCache, warnings);
    if (Object.keys(converted).length === 0) {
      warnings.push("已跳过 1 行空白记录。");
      continue;
    }
    if (fieldTypes.has(drawingDateField)) {
      converted[drawingDateField] = todayDateValue(fieldTypes.get(drawingDateField));
    }
    convertedRecords.push(converted);
  }
  if (convertedRecords.length === 0) {
    const created = [];
    created.warnings = warnings;
    return created;
  }
  if (records.length === 1) {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records`;
    const { response, data } = await fetchFeishuJson(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ fields: convertedRecords[0] }),
    });
    if (!response.ok || data.code !== 0) {
      throw new Error("写入飞书多维表记录失败，请稍后重试。");
    }
    const created = [data.data?.record];
    created.warnings = warnings;
    invalidateBitableRecordCache(tableConfig.key);
    return created;
  }

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/batch_create`;
  const { response, data } = await fetchFeishuJson(url, {
    method: "POST",
    timeoutMs: feishuRequestTimeoutMs.batchWrite,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ records: convertedRecords.map((fields) => ({ fields })) }),
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("批量写入飞书多维表记录失败，请稍后重试。");
  }
  const created = data.data?.records || [];
  created.warnings = warnings;
  invalidateBitableRecordCache(tableConfig.key);
  return created;
}

export async function writeFromText(text, { dryRun = false, tableKey } = {}) {
  const records = parseMessageToRecords(text);
  if (dryRun || !getConfigStatus().ready) {
    return { dryRun: true, records, fields: records[0] || null, count: records.length, result: [] };
  }
  const result = await createBitableRecords(records, { tableKey });
  return { dryRun: false, records, fields: records[0] || null, count: records.length, result };
}
