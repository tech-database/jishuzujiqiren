const requiredConfig = [
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_BITABLE_APP_TOKEN",
  "FEISHU_BITABLE_TABLE_ID",
];

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
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function getConfigStatus() {
  const missing = requiredConfig.filter((key) => !process.env[key]);
  return {
    ready: missing.length === 0,
    missing,
    webhookPath: "/webhook/feishu",
    table: {
      appTokenSet: Boolean(process.env.FEISHU_BITABLE_APP_TOKEN),
      tableIdSet: Boolean(process.env.FEISHU_BITABLE_TABLE_ID),
    },
    tables: getBitableTablesStatus(),
    fieldMap: readFieldMap(),
    nameIdMap: readNameIdMap(),
    replyEnabled: process.env.FEISHU_REPLY_ENABLED === "true",
  };
}

export function resolveTableKey(tableKey) {
  const text = String(tableKey || "").trim().toLowerCase();
  if (text === "paint" || text === "油漆") return "paint";
  return "board";
}

export function getBitableTablesStatus() {
  return Object.fromEntries(
    Object.entries(tableDefinitions).map(([key, definition]) => [
      key,
      {
        label: definition.label,
        appTokenSet: Boolean(process.env[definition.appTokenEnv]),
        tableIdSet: Boolean(process.env[definition.tableIdEnv]),
        ready: Boolean(process.env[definition.appTokenEnv] && process.env[definition.tableIdEnv]),
      },
    ]),
  );
}

export function getBitableConfig(tableKey = "board") {
  const resolvedKey = resolveTableKey(tableKey);
  const definition = tableDefinitions[resolvedKey];
  const appToken = process.env[definition.appTokenEnv] || "";
  const tableId = process.env[definition.tableIdEnv] || "";
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
  const missing = requiredConfig.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

export function readFieldMap() {
  try {
    return JSON.parse(process.env.FIELD_MAP_JSON || "{}");
  } catch {
    return {};
  }
}

export function readNameIdMap() {
  try {
    return JSON.parse(process.env.NAME_ID_MAP_JSON || "{}");
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
  const normalized = text.replace(/\./g, "/").replace(/-/g, "/");
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!match) return value;
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();
}

function todayDateTimestamp() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
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

export function parseMessageToRecords(text) {
  const source = stripCommand(text);
  if (!source) throw new Error("Empty message.");

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

  throw new Error('Invalid format. Paste a table, JSON, or "field: value" lines.');
}

export async function parseSpreadsheetBuffer(buffer) {
  const XLSX = await import("xlsx");
  const xlsxBuffer = await normalizeSpreadsheetBuffer(buffer);
  const imageMap = await extractWpsCellImages(xlsxBuffer);
  const workbook = XLSX.read(xlsxBuffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Spreadsheet has no sheets.");

  const matrix = sheetToMatrix(XLSX, workbook.Sheets[sheetName], imageMap);
  const fieldMap = readFieldMap();
  const fieldNames = new Set([...Object.keys(fieldMap), ...Object.values(fieldMap)]);
  const headerIndex = findHeaderRowIndex(matrix, fieldNames);
  if (headerIndex < 0) throw new Error("Spreadsheet header row was not found.");

  const headers = matrix[headerIndex].map((cell) => String(cell || "").trim());
  const sheetMeta = extractQuoteSheetMeta(matrix, headerIndex);
  const dataRows = matrix
    .slice(headerIndex + 1)
    .filter((row) => isSpreadsheetDataRow(headers, row));
  if (dataRows.length === 0) throw new Error("Spreadsheet has no data rows.");

  return dataRows.map((row) => rowToRecord(headers, row, sheetMeta));
}

async function normalizeSpreadsheetBuffer(buffer) {
  if (buffer.subarray(0, 2).toString("hex") === "504b") return buffer;
  console.log("Legacy Excel format detected. Trying local Excel/WPS conversion to xlsx.");
  try {
    return await convertLegacySpreadsheetToXlsx(buffer);
  } catch (error) {
    console.log(`Legacy conversion failed, parsing data without embedded images: ${error.message}`);
    return buffer;
  }
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
  $workbook = $app.Workbooks.Open($inputPath)
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

function sheetToMatrix(XLSX, sheet, imageMap) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[address];
      const value = cell?.f ? `=${cell.f}` : cell?.w ?? cell?.v ?? "";
      const imageId = parseDispimgId(value);
      row.push(imageId ? makeImageValue(imageId, imageMap.get(imageId), value) : value);
    }
    if (row.some((cell) => cellToText(cell) !== "")) rows.push(row);
  }
  return rows;
}

async function extractWpsCellImages(buffer) {
  if (buffer.subarray(0, 2).toString("hex") !== "504b") {
    console.log("Spreadsheet is not zip-based xlsx; embedded image extraction is skipped.");
    return new Map();
  }
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
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
    throw new Error(`Only text messages are supported, got ${message.message_type}.`);
  }
  const content = typeof message.content === "string" ? JSON.parse(message.content) : message.content;
  return content?.text || "";
}

export async function getTenantAccessToken() {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.FEISHU_APP_ID,
        app_secret: process.env.FEISHU_APP_SECRET,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Failed to get tenant_access_token: ${data.msg || response.statusText}`);
  }
  return data.tenant_access_token;
}

async function getBitableFieldMap(token, tableConfig = getBitableConfig()) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields?page_size=100`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Failed to list bitable fields: ${data.msg || response.statusText}`);
  }
  return new Map((data.data?.items || []).map((field) => [field.field_name, field.type]));
}

async function listBitableRecords(token, tableConfig = getBitableConfig()) {
  const records = [];
  let pageToken = "";

  do {
    const searchParams = new URLSearchParams({ page_size: "500" });
    if (pageToken) searchParams.set("page_token", pageToken);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/search?${searchParams.toString()}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || data.code !== 0) {
      throw new Error(`Failed to search bitable records: ${data.msg || response.statusText} ${JSON.stringify(data)}`);
    }
    records.push(...(data.data?.items || []));
    pageToken = data.data?.has_more ? data.data?.page_token || "" : "";
  } while (pageToken);

  return records;
}

async function updateBitableRecord(token, tableConfig, recordId, fields) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/${recordId}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ fields }),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Failed to update bitable record: ${data.msg || response.statusText} ${JSON.stringify(data)}`);
  }
  return data.data?.record;
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

export function isDrawClaimCommand(text) {
  return String(text || "").includes("\u9886\u56fe");
}

function cleanDrawClaimText(text) {
  return String(text || "")
    .replace(/<at\b[^>]*>.*?<\/at>/g, " ")
    .replace(/@\S+/g, " ")
    .replace(/\u9886\u56fe/g, " ")
    .trim();
}

export function extractMaterialCodes(text) {
  const tokens = cleanDrawClaimText(text)
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
const drawingStatuses = {
  unclaimed: "\u672a\u9886\u53d6",
  drawing: "\u7ed8\u56fe\u4e2d",
  done: "\u7ed8\u56fe\u5b8c\u6210",
};

function normalizeMaterialCodes(materialCodes) {
  const codes = [...new Set((materialCodes || []).map((code) => String(code).trim()).filter(Boolean))];
  if (codes.length === 0) {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u8f93\u5165\u9700\u8981\u67e5\u8be2\u7684\u6599\u53f7");
  }
  return codes;
}

function matchDrawingRecordsByMaterialCodes(records, codes) {
  const matchedRecords = codes.map((materialCode) => ({
    materialCode,
    records: records.filter((record) =>
      drawingMaterialFields.some((field) => bitableValueToText(record.fields?.[field]) === materialCode),
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
  throw new Error(`${actionName}存在重复料号：${details}，请缩小日期范围后再操作`);
}

function getDrawingMaterialCode(fields) {
  for (const field of drawingMaterialFields) {
    const value = bitableValueToText(fields?.[field]);
    if (value) return value;
  }
  return "";
}

function detectDrawingStatus(fields) {
  const currentStatus = bitableValueToText(fields?.[drawingStatusField]);
  const hasOwner = Boolean(bitableValueToText(fields?.[drawingOwnerField]));
  if (currentStatus === drawingStatuses.done && hasOwner) return drawingStatuses.done;
  if (!bitableValueToText(fields?.[drawingOwnerField])) return drawingStatuses.unclaimed;
  return drawingStatuses.drawing;
}

function formatDateTime(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function bitableDateTimeValue(fieldTypes, fieldName, timestamp = Date.now()) {
  return fieldTypes.get(fieldName) === 5 ? timestamp : formatDateTime(timestamp);
}

function formatDurationText(durationMs) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}\u5929`);
  if (hours > 0) parts.push(`${hours}\u5c0f\u65f6`);
  parts.push(`${minutes}\u5206\u949f`);
  return parts.join("");
}

function durationValue(fieldTypes, durationMs) {
  if (fieldTypes.get(drawingDurationField) === 2) {
    return Number((Math.max(0, durationMs) / 3600000).toFixed(2));
  }
  return formatDurationText(durationMs);
}

function parseDateBoundary(value, endOfDay = false) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).getTime();
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
  const normalized = text.replace(/\./g, "-").replace(/\//g, "-");
  const match = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
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
  const records = filterRecordsByDateRange(await listBitableRecords(token, tableConfig), startDate, endDate)
    .map(recordFingerprint)
    .sort((left, right) => left.recordId.localeCompare(right.recordId));
  return JSON.stringify(records);
}

export async function syncDrawingStatuses({ startDate, endDate, tableKey } = {}) {
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const records = filterRecordsByDateRange(await listBitableRecords(token, tableConfig), startDate, endDate);
  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`Field not found: ${drawingOwnerField}`);
  if (!fieldTypes.has(drawingStatusField)) throw new Error(`Field not found: ${drawingStatusField}`);

  const items = [];
  const summary = {
    total: records.length,
    unclaimed: 0,
    drawing: 0,
    done: 0,
    updated: 0,
  };

  for (const record of records) {
    const nextStatus = detectDrawingStatus(record.fields || {});
    const currentStatus = bitableValueToText(record.fields?.[drawingStatusField]);
    const fieldsToUpdate = {};
    if (nextStatus !== currentStatus) fieldsToUpdate[drawingStatusField] = nextStatus;

    const hasOwner = Boolean(bitableValueToText(record.fields?.[drawingOwnerField]));
    const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(record.fields?.[drawingCompleteTimeField]);
    const now = Date.now();
    if (hasOwner && !claimTime && fieldTypes.has(drawingClaimTimeField)) {
      fieldsToUpdate[drawingClaimTimeField] = bitableDateTimeValue(fieldTypes, drawingClaimTimeField, now);
    }
    if (nextStatus === drawingStatuses.done && !completeTime && fieldTypes.has(drawingCompleteTimeField)) {
      fieldsToUpdate[drawingCompleteTimeField] = bitableDateTimeValue(fieldTypes, drawingCompleteTimeField, now);
    }
    const effectiveClaimTime = claimTime || parseBitableDateValue(fieldsToUpdate[drawingClaimTimeField]);
    const effectiveCompleteTime = completeTime || parseBitableDateValue(fieldsToUpdate[drawingCompleteTimeField]);
    if (
      effectiveClaimTime &&
      effectiveCompleteTime &&
      fieldTypes.has(drawingDurationField) &&
      !bitableValueToText(record.fields?.[drawingDurationField])
    ) {
      fieldsToUpdate[drawingDurationField] = durationValue(fieldTypes, effectiveCompleteTime - effectiveClaimTime);
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      await updateBitableRecord(token, tableConfig, record.record_id, fieldsToUpdate);
      summary.updated += 1;
    }

    if (nextStatus === drawingStatuses.unclaimed) summary.unclaimed += 1;
    else if (nextStatus === drawingStatuses.drawing) summary.drawing += 1;
    else if (nextStatus === drawingStatuses.done) summary.done += 1;

    items.push({ recordId: record.record_id, status: nextStatus });
  }

  return { table: tableConfig.key, summary, items };
}

export async function queryUnclaimedDrawings({ tableKey } = {}) {
  const token = await getTenantAccessToken();
  const items = [];
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    const records = await listBitableRecords(token, tableConfig);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`Field not found: ${drawingOwnerField}`);
    items.push(
      ...records
        .filter((record) => !bitableValueToText(record.fields?.[drawingOwnerField]))
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

export async function queryDrawingClaimStatus({ materialCodes, tableKey }) {
  const codes = normalizeMaterialCodes(materialCodes);
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const records = await listBitableRecords(token, tableConfig);
  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`Field not found: ${drawingOwnerField}`);

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

export async function claimDrawingOwners({ materialCodes, senderName, senderId, startDate, endDate, tableKey }) {
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
    const records = filterRecordsByDateRange(await listBitableRecords(token, tableConfig), startDate, endDate);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`Field not found: ${drawingOwnerField}`);

    const remainingCodes = codes.filter((code) => !foundCodes.has(code));
    if (remainingCodes.length === 0) break;
    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(records, remainingCodes);
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
  if (missing.length > 0) throw new Error(`Material code not found: ${missing.join(", ")}`);

  if (claimedByCode.size > 0) {
    const details = [...claimedByCode.entries()]
      .map(([materialCode, owner]) => `${materialCode}(\u5df2\u88ab${owner}\u9886\u53d6)`)
      .join("\uFF0C");
    throw new Error(`${details}\uFF0C\u4e0d\u53ef\u91cd\u590d\u9886\u53d6`);
  }

  const now = Date.now();
  const result = [];
  for (const item of unclaimedItems) {
    const ownerType = item.fieldTypes.get(drawingOwnerField);
    const ownerValue = resolveDrawingOwnerValue(senderName, senderId, ownerType);
    for (const record of item.records) {
      const fields = { [drawingOwnerField]: ownerValue };
      if (item.fieldTypes.has(drawingStatusField)) fields[drawingStatusField] = drawingStatuses.drawing;
      if (item.fieldTypes.has(drawingClaimTimeField)) {
        fields[drawingClaimTimeField] = bitableDateTimeValue(item.fieldTypes, drawingClaimTimeField, now);
      }
      await updateBitableRecord(token, item.tableConfig, record.record_id, fields);
      result.push({ table: item.tableConfig.key, recordId: record.record_id, materialCode: item.materialCode });
    }
  }
  return result;
}

export async function completeDrawings({ materialCodes, startDate, endDate, tableKey }) {
  let codes;
  try {
    codes = normalizeMaterialCodes(materialCodes);
  } catch {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u8f93\u5165\u9700\u8981\u6807\u8bb0\u5b8c\u6210\u7684\u6599\u53f7");
  }

  const result = [];
  const foundCodes = new Set();
  const token = await getTenantAccessToken();
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    const records = filterRecordsByDateRange(await listBitableRecords(token, tableConfig), startDate, endDate);
    if (!fieldTypes.has(drawingStatusField)) throw new Error(`Field not found: ${drawingStatusField}`);

    const remainingCodes = codes.filter((code) => !foundCodes.has(code));
    if (remainingCodes.length === 0) break;
    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(records, remainingCodes);
    for (const item of matchedRecords) {
      if (item.records.length === 0) continue;
      foundCodes.add(item.materialCode);
      for (const record of item.records) {
        const now = Date.now();
        const fields = {
          [drawingStatusField]: drawingStatuses.done,
        };
        if (fieldTypes.has(drawingCompleteTimeField)) {
          fields[drawingCompleteTimeField] = bitableDateTimeValue(fieldTypes, drawingCompleteTimeField, now);
        }
        const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
        if (claimTime && fieldTypes.has(drawingDurationField)) {
          fields[drawingDurationField] = durationValue(fieldTypes, now - claimTime);
        }
        await updateBitableRecord(token, tableConfig, record.record_id, fields);
        result.push({ table: tableConfig.key, recordId: record.record_id, materialCode: item.materialCode });
      }
    }
  }
  const missing = codes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) throw new Error(`Material code not found: ${missing.join(", ")}`);
  return result;
}

async function uploadBitableImage(token, tableConfig, image) {
  if (!image?.buffer) throw new Error("Image data was not found in the spreadsheet.");
  const form = new FormData();
  form.append("file_name", image.fileName);
  form.append("parent_type", "bitable_image");
  form.append("parent_node", tableConfig.appToken);
  form.append("size", String(image.buffer.length));
  form.append("file", new Blob([image.buffer], { type: image.mimeType }), image.fileName);

  const response = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Failed to upload bitable image: ${data.msg || response.statusText} ${JSON.stringify(data)}`);
  }
  return data.data?.file_token;
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
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const uploadCache = new Map();
  const convertedRecords = [];
  const warnings = [];
  for (const record of records) {
    const converted = await convertRecordByFieldTypes(record, fieldTypes, token, tableConfig, uploadCache, warnings);
    if (Object.keys(converted).length === 0) {
      warnings.push("已跳过 1 行空白记录。");
      continue;
    }
    if (fieldTypes.get("日期") === 5 && converted["日期"] === undefined) {
      converted["日期"] = todayDateTimestamp();
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
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ fields: convertedRecords[0] }),
    });
    const data = await response.json();
    if (!response.ok || data.code !== 0) {
      throw new Error(`Failed to create bitable record: ${data.msg || response.statusText} ${JSON.stringify(data)}`);
    }
    const created = [data.data?.record];
    created.warnings = warnings;
    return created;
  }

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/batch_create`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ records: convertedRecords.map((fields) => ({ fields })) }),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Failed to batch create bitable records: ${data.msg || response.statusText} ${JSON.stringify(data)}`);
  }
  const created = data.data?.records || [];
  created.warnings = warnings;
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
