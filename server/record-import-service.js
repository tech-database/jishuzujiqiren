import { parseShanghaiDateTime } from "./date-range.js";
import { drawingDateField } from "./drawing-fields.js";
import { parseDispimgId, parseMessageToRecords } from "./message-record-parser.js";
import { getBitableConfig, getConfigStatus } from "./runtime-config.js";
import { spreadsheetLimits } from "./spreadsheet-parser.js";
import {
  feishuRequestTimeoutMs,
  fetchFeishuJson,
  getTenantAccessToken,
} from "./feishu-client.js";
import {
  getBitableFieldMap,
  invalidateBitableRecordCache,
} from "./bitable-client.js";

function normalizeValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (["true", "yes"].includes(trimmed.toLowerCase()) || trimmed === "是") return true;
  if (["false", "no"].includes(trimmed.toLowerCase()) || trimmed === "否") return false;
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

function todayDateValue(fieldType) {
  const { year, month, day } = shanghaiTodayParts();
  if (fieldType === 5) {
    return Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function uploadBitableImage(token, tableConfig, image) {
  if (!image?.buffer) throw new Error("未在表格中找到图片数据。");
  const form = new FormData();
  form.append("file_name", image.fileName);
  form.append("parent_type", "bitable_image");
  form.append("parent_node", tableConfig.appToken);
  form.append("size", String(image.buffer.length));
  form.append("file", new Blob([image.buffer], { type: image.mimeType }), image.fileName);

  const { response, data } = await fetchFeishuJson(
    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all",
    {
      method: "POST",
      timeoutMs: feishuRequestTimeoutMs.mediaUpload,
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  if (!response.ok || data.code !== 0) {
    throw new Error("上传图片到飞书多维表失败，已跳过该图片。");
  }
  return data.data?.file_token;
}

function normalizeAttachmentValue(value) {
  if (Array.isArray(value)) {
    const attachments = value.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.file_token === "string" &&
        item.file_token.trim(),
    );
    return attachments.length > 0 ? attachments : null;
  }
  if (
    value &&
    typeof value === "object" &&
    typeof value.file_token === "string" &&
    value.file_token.trim()
  ) {
    return [value];
  }
  return null;
}

async function convertRecordByFieldTypes(
  record,
  fieldTypes,
  token,
  tableConfig,
  uploadCache,
  warnings,
) {
  const converted = {};
  for (const [fieldName, rawValue] of Object.entries(record)) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) continue;
    const type = fieldTypes.get(fieldName);
    if (type === undefined) continue;
    if (rawValue && typeof rawValue === "object" && rawValue.__imageId) {
      if (type !== 17) {
        const fallback = String(rawValue.fallback || "").trim();
        if (fallback && !parseDispimgId(fallback)) {
          converted[fieldName] = String(normalizeValue(fallback));
        }
        continue;
      }
      if (!rawValue.image) {
        warnings.push(`图片 ${rawValue.__imageId} 在表格中被引用，但没有找到图片数据`);
        continue;
      }
      try {
        if (!uploadCache.has(rawValue.__imageId)) {
          uploadCache.set(
            rawValue.__imageId,
            await uploadBitableImage(token, tableConfig, rawValue.image),
          );
        }
        converted[fieldName] = [{ file_token: uploadCache.get(rawValue.__imageId) }];
      } catch (error) {
        warnings.push(`图片字段「${fieldName}」上传失败，已跳过图片：${error.message}`);
      }
      continue;
    }
    if (type === 17) {
      const attachments = normalizeAttachmentValue(rawValue);
      if (attachments) converted[fieldName] = attachments;
      else warnings.push(`附件字段「${fieldName}」没有可上传的附件对象，已跳过该字段。`);
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
        String(rawValue).trim() === "是";
      continue;
    }
    if (type === 11) continue;
    converted[fieldName] = String(normalizeValue(rawValue));
  }
  return converted;
}

export function createRecordImportService({ assertNoDuplicateMaterialCodesBeforeCreate }) {
  async function createBitableRecords(records, { tableKey } = {}) {
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
      const converted = await convertRecordByFieldTypes(
        record,
        fieldTypes,
        token,
        tableConfig,
        uploadCache,
        warnings,
      );
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

    const batch = records.length !== 1;
    const endpoint = batch ? "batch_create" : "";
    const url =
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}` +
      `/tables/${tableConfig.tableId}/records${endpoint ? `/${endpoint}` : ""}`;
    const { response, data } = await fetchFeishuJson(url, {
      method: "POST",
      timeoutMs: batch ? feishuRequestTimeoutMs.batchWrite : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(
        batch
          ? { records: convertedRecords.map((fields) => ({ fields })) }
          : { fields: convertedRecords[0] },
      ),
    });
    if (!response.ok || data.code !== 0) {
      throw new Error(
        batch
          ? "批量写入飞书多维表记录失败，请稍后重试。"
          : "写入飞书多维表记录失败，请稍后重试。",
      );
    }
    const created = batch ? data.data?.records || [] : [data.data?.record];
    created.warnings = warnings;
    invalidateBitableRecordCache(tableConfig.key);
    return created;
  }

  async function writeFromText(text, { dryRun = false, tableKey } = {}) {
    const records = parseMessageToRecords(text);
    if (dryRun || !getConfigStatus().ready) {
      return {
        dryRun: true,
        records,
        fields: records[0] || null,
        count: records.length,
        result: [],
      };
    }
    const result = await createBitableRecords(records, { tableKey });
    return {
      dryRun: false,
      records,
      fields: records[0] || null,
      count: records.length,
      result,
    };
  }

  return { createBitableRecords, writeFromText };
}
