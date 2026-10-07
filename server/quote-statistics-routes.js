import express from "express";
import { createBitableRecords } from "./bot-core.js";
import { createDrawingOrderService } from "./drawing-order-service.js";
import { parseSpreadsheetBuffer } from "./spreadsheet-parser.js";
import {
  normalizeManualQuoteEntry,
  normalizeOrderRecords,
  summarizeQuoteRecords,
} from "./quote-statistics-service.js";
import { apiErrorCodes, sendError, successResponse } from "./api-response.js";

export const quoteStatisticsFields = Object.freeze([
  "类型",
  "报价日期",
  "类别",
  "报价员",
  "区域",
  "业务",
  "单价",
  "总价",
]);

export const quoteManualEntryFields = Object.freeze([
  "类型",
  "报价日期",
  "类别",
  "报价员",
  "区域",
  "业务",
  "料件编号",
  "数量",
  "单价",
  "总价",
]);

export const quoteOrderEntryFields = quoteManualEntryFields;

function assertSpreadsheetRequest(req) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new Error("上传文件为空");
  }
  const fileName = String(req.query.fileName || "spreadsheet.xlsx");
  if (!/\.(xlsx|xls|csv)$/i.test(fileName)) {
    throw new Error("仅支持 xlsx、xls、csv 文件");
  }
  return fileName;
}

export function createQuoteStatisticsRoutes({ services = {} } = {}) {
  const parseSpreadsheet = services.parseSpreadsheetBuffer || parseSpreadsheetBuffer;
  const summarizeRecords = services.summarizeQuoteRecords || summarizeQuoteRecords;
  const normalizeOrders = services.normalizeOrderRecords || normalizeOrderRecords;
  const normalizeManualEntry = services.normalizeManualQuoteEntry || normalizeManualQuoteEntry;
  const createRecords = services.createBitableRecords || createBitableRecords;
  const confirmDrawingOrders = services.confirmDrawingOrders
    || createDrawingOrderService().confirmDrawingOrders;
  const rawSpreadsheet = express.raw({ limit: "50mb", type: "*/*" });

  async function synchronizeOrderMaterialCodes(records) {
    const materialCodes = [
      ...new Set(records.map((record) => String(record?.料件编号 || "").trim()).filter(Boolean)),
    ];
    if (materialCodes.length === 0) throw new Error("下单记录中没有可同步的料件编号");
    const syncResult = await confirmDrawingOrders({ materialCodes, allowMissing: true });
    return {
      matchedCount: syncResult.result.length,
      changedCount: syncResult.result.filter((item) => item.changed).length,
      missing: syncResult.missing || [],
    };
  }

  async function parseSummary(req) {
    const fileName = assertSpreadsheetRequest(req);
    const records = await parseSpreadsheet(req.body, { fileName });
    const options = {
      entryType: req.query.entryType,
      quoteOfficer: req.query.quoteOfficer,
      quoteDate: req.query.quoteDate,
    };
    if (String(req.query.entryType || "报价").trim() === "下单") {
      return { fileName, ...normalizeOrders(records, options) };
    }
    const result = summarizeRecords(records, options);
    return { fileName, ...result, records: [result.summary], recordCount: 1 };
  }

  function registerRoutes(app) {
    app.post("/api/quote-statistics/preview", rawSpreadsheet, async (req, res) => {
      try {
        const preview = { ...await parseSummary(req) };
        delete preview.records;
        res.json(successResponse(preview));
      } catch (error) {
        sendError(res, error, apiErrorCodes.QUOTE_STATISTICS_FAILED);
      }
    });

    app.post("/api/quote-statistics/commit", rawSpreadsheet, async (req, res) => {
      try {
        const parsed = await parseSummary(req);
        const orderSync = parsed.summary.类型 === "下单"
          ? await synchronizeOrderMaterialCodes(parsed.records)
          : null;
        const created = await createRecords(parsed.records, {
          tableKey: "quote",
          requiredFields: parsed.summary.类型 === "下单"
            ? quoteOrderEntryFields
            : quoteStatisticsFields,
        });
        const expectedCount = parsed.records.length;
        if (created.length !== expectedCount) {
          const error = new Error(
            `报价统计写入结果异常：应创建 ${expectedCount} 条记录，实际创建 ${created.length} 条，请检查多维表字段配置。`,
          );
          error.code = "QUOTE_WRITE_COUNT_MISMATCH";
          error.statusCode = 502;
          throw error;
        }
        const responseData = { ...parsed };
        delete responseData.records;
        const syncWarnings = orderSync?.missing?.length > 0
          ? [`胶板和油漆表中未找到料件编号：${orderSync.missing.join("，")}，已跳过同步`]
          : [];
        res.json(successResponse({
          ...responseData,
          count: created.length,
          orderSync,
          warnings: [...(created.warnings || []), ...syncWarnings],
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.QUOTE_STATISTICS_FAILED);
      }
    });

    app.post("/api/quote-statistics/manual", async (req, res) => {
      try {
        const entry = normalizeManualEntry(req.body);
        const orderSync = entry.类型 === "下单"
          ? await synchronizeOrderMaterialCodes([entry])
          : null;
        const created = await createRecords([entry], {
          tableKey: "quote",
          requiredFields: quoteManualEntryFields,
        });
        if (created.length !== 1) {
          const error = new Error(
            `数据新增结果异常：应创建 1 条记录，实际创建 ${created.length} 条。`,
          );
          error.code = "QUOTE_MANUAL_WRITE_COUNT_MISMATCH";
          error.statusCode = 502;
          throw error;
        }
        const syncWarnings = orderSync?.missing?.length > 0
          ? [`胶板和油漆表中未找到料件编号：${orderSync.missing.join("，")}，已跳过同步`]
          : [];
        res.json(successResponse({
          count: created.length,
          entry,
          orderSync,
          warnings: [...(created.warnings || []), ...syncWarnings],
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.QUOTE_STATISTICS_FAILED);
      }
    });
  }

  return { registerRoutes };
}
