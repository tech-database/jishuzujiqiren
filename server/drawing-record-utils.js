import { bitableValueToText } from "./bitable-values.js";
import { drawingMaterialFields } from "./drawing-fields.js";
import { listRecentBitableRecords } from "./bitable-client.js";

export function normalizeMaterialCodes(materialCodes) {
  const codes = [...new Set((materialCodes || []).map((code) => String(code).trim()).filter(Boolean))];
  if (codes.length === 0) {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u8f93\u5165\u9700\u8981\u67e5\u8be2\u7684\u6599\u53f7");
  }
  return codes;
}

export function normalizeMaterialCodeForMatch(value) {
  return bitableValueToText(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isOrderConfirmed(value) {
  if (value === true || value === 1) return true;
  if (Array.isArray(value)) return value.some((item) => isOrderConfirmed(item));
  if (value && typeof value === "object") {
    return isOrderConfirmed(value.value ?? value.text ?? value.name ?? value.label);
  }
  return /^(?:是|已下单|true|yes|1)$/i.test(String(value || "").trim());
}

export function orderConfirmedValue(fieldType) {
  if (fieldType === 7) return true;
  if (fieldType === 4) return ["是"];
  return "是";
}

export function matchDrawingRecordsByMaterialCodes(records, codes) {
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

export function assertSingleMatchedRecordPerCode(matchedRecords, actionName) {
  const duplicated = matchedRecords.filter((item) => item.records.length > 1);
  if (duplicated.length === 0) return;
  const details = duplicated
    .map((item) => `${item.materialCode}(${item.records.length}条)`)
    .join("，");
  throw new Error(`${actionName}发现重复料号：${details}，本次未修改任何记录，请先检查表格`);
}

export function assertUniqueMatchedItemsAcrossTables(matchedItems, actionName) {
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

export function getDrawingMaterialCode(fields) {
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

export async function assertNoDuplicateMaterialCodesBeforeCreate(token, tableConfig, fieldTypes, records) {
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
