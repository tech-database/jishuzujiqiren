import { bitableValueToText } from "./bitable-values.js";
import { formatShanghaiDate, parseShanghaiDateBoundary } from "./date-range.js";
import {
  drawingDateField,
  drawingOrderField,
  drawingRegionField,
} from "./drawing-fields.js";
import { bitableValueToNumber } from "./drawing-domain-utils.js";
import { isOrderConfirmed } from "./drawing-record-utils.js";
import { quoteOfficerCategories } from "./quote-statistics-service.js";
import { drawingTableKeys, getBitableConfig } from "./runtime-config.js";
import { getTenantAccessToken } from "./feishu-client.js";
import {
  getBitableFieldMap,
  listCachedBitableRecords,
} from "./bitable-client.js";

const quoteDateField = "报价日期";
const quoteTypeField = "类型";
const quoteCategoryField = "类别";
const quoteOfficerField = "报价员";
const quoteRegionField = "区域";
const quoteBusinessField = "业务";
const quoteUnitPriceField = "单价";
const quoteTotalField = "总价";
const drawingBusinessField = "业务";
const drawingQuantityField = "数量";
const drawingSalesUnitPriceField = "销售单价";

const defaultDependencies = Object.freeze({
  drawingTableKeys,
  getBitableConfig,
  getTenantAccessToken,
  getBitableFieldMap,
  listCachedBitableRecords,
});

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function queryRange(today, startDate, endDate) {
  const resolvedStartDate = String(startDate || today).trim();
  const resolvedEndDate = String(endDate || startDate || today).trim();
  if (
    parseShanghaiDateBoundary(resolvedStartDate) === null
    || parseShanghaiDateBoundary(resolvedEndDate, true) === null
  ) {
    throw new Error("查询日期格式无效");
  }
  if (resolvedStartDate > resolvedEndDate) {
    throw new Error("开始日期不能晚于结束日期");
  }
  return {
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    label: resolvedStartDate === resolvedEndDate
      ? resolvedStartDate
      : `${resolvedStartDate} 至 ${resolvedEndDate}`,
  };
}

function quoteRecordDate(value) {
  const text = bitableValueToText(value).trim().replace(/[/.]/g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function addAmount(map, name, fieldName, amount) {
  const key = String(name || "").trim() || "未填写";
  const current = map.get(key) || {
    name: key,
    quoteCount: 0,
    orderCount: 0,
    quoteTotal: 0,
    orderTotal: 0,
  };
  current[fieldName] += amount;
  if (fieldName === "quoteTotal") current.quoteCount += 1;
  if (fieldName === "orderTotal") current.orderCount += 1;
  map.set(key, current);
}

function comparisonItems(map) {
  return [...map.values()]
    .map((item) => {
      const quoteTotal = roundMoney(item.quoteTotal);
      const orderTotal = roundMoney(item.orderTotal);
      return {
        name: item.name,
        quoteCount: item.quoteCount,
        orderCount: item.orderCount,
        quoteTotal,
        orderTotal,
        difference: roundMoney(orderTotal - quoteTotal),
        conversionRate: quoteTotal > 0 ? Math.round((orderTotal / quoteTotal) * 1000) / 10 : null,
      };
    })
    .sort((left, right) =>
      right.quoteTotal - left.quoteTotal
      || right.orderTotal - left.orderTotal
      || left.name.localeCompare(right.name, "zh-CN"),
    );
}

function assertQuoteFields(fieldTypes) {
  const required = [
    quoteDateField,
    quoteOfficerField,
    quoteRegionField,
    quoteBusinessField,
    quoteUnitPriceField,
    quoteTotalField,
  ];
  const missing = required.filter((fieldName) => !fieldTypes.has(fieldName));
  if (missing.length > 0) {
    throw new Error(`报价统计表缺少字段：${missing.join("、")}`);
  }
}

function createDashboardStats(category) {
  return {
    officers: new Map(
      Object.entries(quoteOfficerCategories)
        .filter(([, officerCategory]) => !category || officerCategory === category)
        .map(([name, officerCategory]) => [
          name,
          { name, category: officerCategory, fileCount: 0, unitPrice: 0, total: 0 },
        ]),
    ),
    regions: new Map(),
    businesses: new Map(),
    todayFileCount: 0,
    todayUnitPrice: 0,
    todayTotal: 0,
    monthFileCount: 0,
    monthQuoteTotal: 0,
    monthOrderCount: 0,
    monthOrderTotal: 0,
  };
}

function addQuoteRecord(stats, {
  recordDate,
  range,
  officerName,
  category,
  region,
  business,
  unitPrice,
  total,
}) {
  if (recordDate < range.startDate || recordDate > range.endDate) return;
  stats.todayFileCount += 1;
  stats.todayUnitPrice += unitPrice;
  stats.todayTotal += total;
  stats.monthFileCount += 1;
  stats.monthQuoteTotal += total;
  const officer = stats.officers.get(officerName) || {
    name: officerName,
    category: category || "未匹配",
    fileCount: 0,
    unitPrice: 0,
    total: 0,
  };
  officer.fileCount += 1;
  officer.unitPrice += unitPrice;
  officer.total += total;
  stats.officers.set(officerName, officer);
  addAmount(stats.regions, region, "quoteTotal", total);
  addAmount(stats.businesses, business, "quoteTotal", total);
}

function addOrderRecord(stats, { region, business, total }) {
  stats.monthOrderCount += 1;
  stats.monthOrderTotal += total;
  addAmount(stats.regions, region, "orderTotal", total);
  addAmount(stats.businesses, business, "orderTotal", total);
}

function finalizeDashboardStats(stats, officerOrder) {
  return {
    summary: {
      fileCount: stats.todayFileCount,
      unitPrice: roundMoney(stats.todayUnitPrice),
      total: roundMoney(stats.todayTotal),
    },
    monthSummary: {
      fileCount: stats.monthFileCount,
      quoteTotal: roundMoney(stats.monthQuoteTotal),
      orderCount: stats.monthOrderCount,
      orderTotal: roundMoney(stats.monthOrderTotal),
      conversionRate: stats.monthQuoteTotal > 0
        ? Math.round((stats.monthOrderTotal / stats.monthQuoteTotal) * 1000) / 10
        : null,
    },
    officers: [...stats.officers.values()]
      .map((item) => ({
        ...item,
        unitPrice: roundMoney(item.unitPrice),
        total: roundMoney(item.total),
      }))
      .sort((left, right) =>
        right.total - left.total
        || (officerOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER)
          - (officerOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER)
        || left.name.localeCompare(right.name, "zh-CN"),
      ),
    regions: comparisonItems(stats.regions),
    businesses: comparisonItems(stats.businesses),
  };
}

export async function queryQuoteDashboard(
  { now = new Date(), startDate, endDate } = {},
  dependencies = defaultDependencies,
) {
  const {
    drawingTableKeys,
    getBitableConfig,
    getTenantAccessToken,
    getBitableFieldMap,
    listCachedBitableRecords,
  } = dependencies;
  const token = await getTenantAccessToken();
  const today = formatShanghaiDate(now);
  const range = queryRange(today, startDate, endDate);
  const warnings = [];

  const quoteConfig = getBitableConfig("quote");
  const quoteFields = await getBitableFieldMap(token, quoteConfig);
  assertQuoteFields(quoteFields);
  const quoteRecords = await listCachedBitableRecords(token, quoteConfig, {
    fieldNames: [
      quoteDateField,
      ...(quoteFields.has(quoteTypeField) ? [quoteTypeField] : []),
      ...(quoteFields.has(quoteCategoryField) ? [quoteCategoryField] : []),
      quoteOfficerField,
      quoteRegionField,
      quoteBusinessField,
      quoteUnitPriceField,
      quoteTotalField,
    ],
  });

  const officerOrder = new Map(
    Object.keys(quoteOfficerCategories).map((name, index) => [name, index]),
  );
  const overallStats = createDashboardStats();
  const categoryStats = {
    board: createDashboardStats("胶板"),
    paint: createDashboardStats("油漆"),
    soft: createDashboardStats("软体"),
  };

  for (const record of quoteRecords) {
    const fields = record.fields || {};
    const recordDate = quoteRecordDate(fields[quoteDateField]);
    const officerName = bitableValueToText(fields[quoteOfficerField]) || "未填写";
    const category =
      bitableValueToText(fields[quoteCategoryField])
      || quoteOfficerCategories[officerName]
      || "未匹配";
    const unitPrice = bitableValueToNumber(fields[quoteUnitPriceField]) ?? 0;
    const total = bitableValueToNumber(fields[quoteTotalField]) ?? 0;
    const recordType = bitableValueToText(fields[quoteTypeField]) || "报价";

    if (recordType === "下单") {
      if (recordDate < range.startDate || recordDate > range.endDate) continue;
      const orderData = {
        region: bitableValueToText(fields[quoteRegionField]),
        business: bitableValueToText(fields[quoteBusinessField]),
        total,
      };
      addOrderRecord(overallStats, orderData);
      if (category === "胶板") addOrderRecord(categoryStats.board, orderData);
      if (category === "油漆") addOrderRecord(categoryStats.paint, orderData);
      if (category === "软体") addOrderRecord(categoryStats.soft, orderData);
      continue;
    }

    const quoteData = {
      recordDate,
      range,
      officerName,
      category,
      region: bitableValueToText(fields[quoteRegionField]),
      business: bitableValueToText(fields[quoteBusinessField]),
      unitPrice,
      total,
    };
    addQuoteRecord(overallStats, quoteData);
    if (category === "胶板") addQuoteRecord(categoryStats.board, quoteData);
    if (category === "油漆") addQuoteRecord(categoryStats.paint, quoteData);
    if (category === "软体") addQuoteRecord(categoryStats.soft, quoteData);
  }

  const drawingResults = await Promise.all(drawingTableKeys().map(async (tableKey) => {
    let tableConfig;
    try {
      tableConfig = getBitableConfig(tableKey);
    } catch (error) {
      warnings.push(error.message);
      return null;
    }
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    const required = [
      drawingDateField,
      drawingOrderField,
      drawingRegionField,
      drawingBusinessField,
      drawingQuantityField,
      drawingSalesUnitPriceField,
    ];
    const missing = required.filter((fieldName) => !fieldTypes.has(fieldName));
    if (missing.length > 0) {
      warnings.push(`${tableConfig.label}表缺少字段：${missing.join("、")}`);
      return null;
    }
    const drawingRecords = await listCachedBitableRecords(token, tableConfig, {
      startDate: range.startDate,
      endDate: range.endDate,
      fieldNames: required,
    });
    return { tableKey, drawingRecords };
  }));

  for (const drawingResult of drawingResults) {
    if (!drawingResult) continue;
    const { tableKey, drawingRecords } = drawingResult;
    for (const record of drawingRecords) {
      const fields = record.fields || {};
      if (!isOrderConfirmed(fields[drawingOrderField])) continue;
      const quantity = bitableValueToNumber(fields[drawingQuantityField]);
      const unitPrice = bitableValueToNumber(fields[drawingSalesUnitPriceField]);
      if (quantity === null || unitPrice === null) continue;
      const total = quantity * unitPrice;
      const orderData = {
        region: bitableValueToText(fields[drawingRegionField]),
        business: bitableValueToText(fields[drawingBusinessField]),
        total,
      };
      addOrderRecord(overallStats, orderData);
      addOrderRecord(tableKey === "paint" ? categoryStats.paint : categoryStats.board, orderData);
    }
  }

  const overall = finalizeDashboardStats(overallStats, officerOrder);
  return {
    checkedAt: new Date(now).toISOString(),
    today,
    range,
    month: range,
    ...overall,
    categories: {
      board: finalizeDashboardStats(categoryStats.board, officerOrder),
      paint: finalizeDashboardStats(categoryStats.paint, officerOrder),
      soft: finalizeDashboardStats(categoryStats.soft, officerOrder),
    },
    warnings,
  };
}

export function createQuoteDashboardService(overrides = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return {
    queryQuoteDashboard: (options) => queryQuoteDashboard(options, dependencies),
  };
}
