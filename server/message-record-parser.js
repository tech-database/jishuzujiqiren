import { readFieldMap } from "./runtime-config.js";

export function applyFieldMap(fields) {
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
  const separatorIndex = rows.findIndex((row) =>
    row.every((cell) => /^:?-{3,}:?$/.test(cell)),
  );
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

export function cellToText(cell) {
  return String(cell?.fallback ?? cell ?? "").trim();
}

export function rowToRecord(headers, row, extraFields = {}) {
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

export function makeImageValue(imageId, image, fallback = "") {
  return { __imageId: imageId, image, fallback };
}

export function parseDispimgId(value) {
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
