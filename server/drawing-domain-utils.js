import { calculateDrawingWorkDurationMinutes } from "./drawing-work-duration.js";
import { formatShanghaiDate, formatShanghaiDateTime } from "./date-range.js";
import { bitableValueToText, parseBitableDateValue, parseDateBoundary } from "./bitable-values.js";
import {
  drawingClaimTimeField,
  drawingCompleteTimeField,
  drawingDateField,
  drawingDurationFieldAliases,
  drawingMaterialFields,
  drawingOwnerField,
  drawingStatuses,
  drawingStatusField,
} from "./drawing-fields.js";

export function filterRecordsByDateRange(records, startDate, endDate) {
  return records.filter((record) => isRecordInDateRange(record, startDate, endDate));
}

export function detectDrawingStatus(fields) {
  const currentStatus = bitableValueToText(fields?.[drawingStatusField]);
  const hasOwner = Boolean(bitableValueToText(fields?.[drawingOwnerField]));
  if (currentStatus === drawingStatuses.done && hasOwner) return drawingStatuses.done;
  if (!bitableValueToText(fields?.[drawingOwnerField])) return drawingStatuses.unclaimed;
  return drawingStatuses.drawing;
}

export function formatDateTime(timestamp = Date.now()) {
  return formatShanghaiDateTime(timestamp);
}

export function isBitableDateOnShanghaiDay(value, day) {
  const text = bitableValueToText(value);
  if (text.startsWith(day)) return true;
  const timestamp = parseBitableDateValue(value);
  return Boolean(timestamp && formatShanghaiDate(new Date(timestamp)) === day);
}

export function bitableDateTimeValue(fieldTypes, fieldName, timestamp = Date.now()) {
  return fieldTypes.get(fieldName) === 5 ? timestamp : formatDateTime(timestamp);
}

export function calculateDurationMinutes(durationMs) {
  return Math.max(0, Math.round(Number(durationMs) / 60000));
}

export function resolveDrawingDurationField(fieldTypes) {
  return drawingDurationFieldAliases.find((fieldName) => fieldTypes.has(fieldName)) ||
    [...fieldTypes.keys()].find((fieldName) => /^用时(?:[（(].*[）)])?$/.test(String(fieldName).trim())) ||
    null;
}

export function drawingStatusProjection(fieldTypes) {
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

export function drawingDurationProjection(fieldTypes, durationField) {
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

export function durationValue(fieldTypes, durationField, claimTimestamp, completeTimestamp) {
  const minutes = calculateDrawingWorkDurationMinutes(claimTimestamp, completeTimestamp);
  return fieldTypes.get(durationField) === 2 ? minutes : String(minutes);
}

export function bitableValueToNumber(value) {
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

export function isRecordInDateRange(record, startDate, endDate) {
  const startTime = parseDateBoundary(startDate);
  const endTime = parseDateBoundary(endDate, true);
  if (!startTime && !endTime) return true;
  const recordTime = parseBitableDateValue(record.fields?.[drawingDateField]);
  if (!recordTime) return false;
  if (startTime && recordTime < startTime) return false;
  if (endTime && recordTime > endTime) return false;
  return true;
}

export function isBitableDateInRange(value, startDate, endDate) {
  const timestamp = parseBitableDateValue(value);
  if (!timestamp) return false;
  const startTime = parseDateBoundary(startDate);
  const endTime = parseDateBoundary(endDate, true);
  if (startTime && timestamp < startTime) return false;
  if (endTime && timestamp > endTime) return false;
  return true;
}

export function stableBitableValue(value) {
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

export function recordFingerprint(record) {
  return {
    recordId: record.record_id,
    fields: stableBitableValue(record.fields || {}),
  };
}
