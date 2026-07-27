import {
  parseShanghaiDateBoundary,
  parseShanghaiDateTime,
} from "./date-range.js";

export function bitableValueToText(value) {
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

export function parseDateBoundary(value, endOfDay = false) {
  return parseShanghaiDateBoundary(value, endOfDay);
}

export function parseBitableDateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value < 1000000000000 ? value * 1000 : value;
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return parseBitableDateValue(value[0]);
  if (typeof value === "object") {
    return parseBitableDateValue(
      value.timestamp ?? value.value ?? value.text ?? value.name,
    );
  }
  const text = String(value || "").trim();
  if (/^\d{10,13}$/.test(text)) {
    const timestamp = Number(text);
    return text.length <= 10 ? timestamp * 1000 : timestamp;
  }
  return parseShanghaiDateTime(text);
}

export function plannedBitableFieldsMatch(
  currentFields,
  expectedFields,
  fieldTypes,
) {
  return Object.entries(expectedFields).every(([fieldName, expectedValue]) => {
    const currentValue = currentFields?.[fieldName];
    const fieldType = fieldTypes.get(fieldName);
    if (fieldType === 5) {
      return parseBitableDateValue(currentValue) === parseBitableDateValue(expectedValue);
    }
    if (fieldType === 2) {
      const currentNumber = Number(bitableValueToText(currentValue).replace(/,/g, ""));
      const expectedNumber = Number(bitableValueToText(expectedValue).replace(/,/g, ""));
      return (
        Number.isFinite(currentNumber) &&
        Number.isFinite(expectedNumber) &&
        currentNumber === expectedNumber
      );
    }
    return bitableValueToText(currentValue) === bitableValueToText(expectedValue);
  });
}
