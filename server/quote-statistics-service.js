import { parseShanghaiDateBoundary } from "./date-range.js";

export const quoteOfficerCategories = Object.freeze({
  杨利伟: "胶板",
  邓翠萍: "胶板",
  朱海韵: "油漆",
  胡燕琪: "软体",
});

const manualEntryTypes = new Set(["报价", "下单"]);
const manualEntryCategories = new Set(["胶板", "油漆", "软体"]);

export function normalizeManualQuoteEntry(input = {}) {
  const type = String(input.type || "").trim();
  const category = String(input.category || "").trim();
  const quoteOfficer = String(input.quoteOfficer || "").trim();
  const date = String(input.date || "").trim();
  const region = String(input.region || "").trim();
  const business = String(input.business || "").trim();
  const quantity = Number(input.quantity);
  const unitPrice = Number(input.unitPrice);

  if (!manualEntryTypes.has(type)) throw new Error("请选择数据类型：报价或下单");
  if (!manualEntryCategories.has(category)) throw new Error("请选择有效类别");
  if (!quoteOfficerCategories[quoteOfficer]) throw new Error("请选择有效报价员");
  if (parseShanghaiDateBoundary(date) === null) throw new Error("请选择有效日期");
  if (!region) throw new Error("请填写区域");
  if (!business) throw new Error("请填写业务");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("数量必须大于 0");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("单价不能小于 0");

  return {
    类型: type,
    报价日期: date,
    类别: category,
    报价员: quoteOfficer,
    区域: region,
    业务: business,
    数量: quantity,
    单价: unitPrice,
    总价: Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100,
  };
}

function shanghaiDateString(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseNumber(value, fieldName, rowNumber, { money = false } = {}) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw);
  const normalized = raw
    .replace(money ? /[,\s￥¥元]/g : /[,\s]/g, "")
    .replace(/[()]/g, "");
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    throw new Error(`第 ${rowNumber} 行「${fieldName}」不是有效金额：${raw}`);
  }
  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw new Error(`第 ${rowNumber} 行「${fieldName}」不是有效金额：${raw}`);
  }
  return negative ? -Math.abs(number) : number;
}

function uniqueRecordValue(records, fieldName) {
  const values = [
    ...new Set(
      records
        .map((record) => String(record?.[fieldName] ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (values.length === 0) throw new Error(`清单中未找到「${fieldName}」`);
  if (values.length > 1) {
    throw new Error(`清单中存在多个「${fieldName}」值：${values.join("、")}`);
  }
  return values[0];
}

function quoteRegionValue(records, warnings) {
  const values = [
    ...new Set(
      records
        .map((record) => String(record?.["区域"] ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (values.length === 0) {
    warnings.push("清单中未找到「区域」，已按“未填写”处理");
    return "未填写";
  }
  if (values.length > 1) {
    throw new Error(`清单中存在多个「区域」值：${values.join("、")}`);
  }
  return values[0];
}

function sumMoneyField(records, fieldName) {
  if (!records.some((record) => Object.prototype.hasOwnProperty.call(record, fieldName))) {
    throw new Error(`清单标题行中未找到「${fieldName}」列`);
  }
  let numericCount = 0;
  const total = records.reduce((sum, record, index) => {
    const value = parseNumber(record[fieldName], fieldName, index + 1, { money: true });
    if (value === null) return sum;
    numericCount += 1;
    return sum + value;
  }, 0);
  if (numericCount === 0) throw new Error(`清单「${fieldName}」列中没有可统计的金额`);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function calculateQuoteTotal(records) {
  if (!records.some((record) => Object.prototype.hasOwnProperty.call(record, "数量"))) {
    throw new Error("清单标题行中未找到「数量」列");
  }
  if (!records.some((record) => Object.prototype.hasOwnProperty.call(record, "销售单价"))) {
    throw new Error("清单标题行中未找到「销售单价」列");
  }

  let calculatedRows = 0;
  const total = records.reduce((sum, record, index) => {
    const rowNumber = index + 1;
    const quantity = parseNumber(record["数量"], "数量", rowNumber);
    const unitPrice = parseNumber(record["销售单价"], "销售单价", rowNumber, { money: true });
    if (unitPrice === null) return sum;
    if (quantity === null) throw new Error(`第 ${rowNumber} 行缺少「数量」，无法计算总价`);
    calculatedRows += 1;
    return sum + quantity * unitPrice;
  }, 0);

  if (calculatedRows === 0) throw new Error("清单中没有可计算总价的数量和销售单价");
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function validatePricedRecords(records) {
  const validRecords = [];
  const warnings = [];

  records.forEach((record, index) => {
    const rowLabel = String(record?.["序号"] ?? "").trim() || String(index + 1);
    try {
      const unitPrice = parseNumber(record["销售单价"], "销售单价", rowLabel, { money: true });
      const quantity = parseNumber(record["数量"], "数量", rowLabel);
      if (unitPrice === null) return;
      if (quantity === null) throw new Error(`序号 ${rowLabel} 缺少「数量」`);
      validRecords.push(record);
    } catch (error) {
      warnings.push(`${error.message}，已忽略该行`);
    }
  });

  return { validRecords, warnings };
}

export function summarizeQuoteRecords(records, {
  quoteOfficer,
  quoteDate,
  now = new Date(),
} = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("清单中没有可统计的数据行");
  }
  const officer = String(quoteOfficer || "").trim();
  const category = quoteOfficerCategories[officer];
  if (!category) throw new Error("请选择有效的报价员");
  const resolvedQuoteDate = String(quoteDate || shanghaiDateString(now)).trim();
  if (parseShanghaiDateBoundary(resolvedQuoteDate) === null) {
    throw new Error("请选择有效的写入日期");
  }
  if (!records.some((record) => Object.prototype.hasOwnProperty.call(record, "销售单价"))) {
    throw new Error("清单标题行中未找到「销售单价」列");
  }
  if (!records.some((record) => Object.prototype.hasOwnProperty.call(record, "数量"))) {
    throw new Error("清单标题行中未找到「数量」列");
  }
  const pricedRecords = records.filter(
    (record) => String(record?.["销售单价"] ?? "").trim() !== "",
  );
  if (pricedRecords.length === 0) {
    throw new Error("清单「销售单价」列中没有可统计的金额");
  }
  const { validRecords, warnings } = validatePricedRecords(pricedRecords);
  if (validRecords.length === 0) {
    throw new Error(`清单中没有可统计的有效报价行。${warnings.join("；")}`);
  }
  const region = quoteRegionValue(validRecords, warnings);

  return {
    summary: {
      报价日期: resolvedQuoteDate,
      类别: category,
      报价员: officer,
      区域: region,
      业务: uniqueRecordValue(validRecords, "业务"),
      单价: sumMoneyField(validRecords, "销售单价"),
      总价: calculateQuoteTotal(validRecords),
    },
    sourceRowCount: validRecords.length,
    ignoredUnpricedRowCount: records.length - pricedRecords.length,
    ignoredInvalidRowCount: pricedRecords.length - validRecords.length,
    warnings,
  };
}
