import express from "express";
import { createBitableRecords } from "./bot-core.js";
import { parseSpreadsheetBuffer } from "./spreadsheet-parser.js";
import {
  normalizeManualQuoteEntry,
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
  "数量",
  "单价",
  "总价",
]);

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
  const normalizeManualEntry = services.normalizeManualQuoteEntry || normalizeManualQuoteEntry;
  const createRecords = services.createBitableRecords || createBitableRecords;
  const rawSpreadsheet = express.raw({ limit: "50mb", type: "*/*" });

  async function parseSummary(req) {
    const fileName = assertSpreadsheetRequest(req);
    const records = await parseSpreadsheet(req.body, { fileName });
    const result = summarizeRecords(records, {
      entryType: req.query.entryType,
      quoteOfficer: req.query.quoteOfficer,
      quoteDate: req.query.quoteDate,
    });
    return { fileName, ...result };
  }

  function registerRoutes(app) {
    app.post("/api/quote-statistics/preview", rawSpreadsheet, async (req, res) => {
      try {
        res.json(successResponse(await parseSummary(req)));
      } catch (error) {
        sendError(res, error, apiErrorCodes.QUOTE_STATISTICS_FAILED);
      }
    });

    app.post("/api/quote-statistics/commit", rawSpreadsheet, async (req, res) => {
      try {
        const parsed = await parseSummary(req);
        const created = await createRecords([parsed.summary], {
          tableKey: "quote",
          requiredFields: quoteStatisticsFields,
        });
        if (created.length !== 1) {
          const error = new Error(
            `报价统计写入结果异常：应创建 1 条记录，实际创建 ${created.length} 条，请检查多维表字段配置。`,
          );
          error.code = "QUOTE_WRITE_COUNT_MISMATCH";
          error.statusCode = 502;
          throw error;
        }
        res.json(successResponse({
          ...parsed,
          count: created.length,
          warnings: created.warnings || [],
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.QUOTE_STATISTICS_FAILED);
      }
    });

    app.post("/api/quote-statistics/manual", async (req, res) => {
      try {
        const entry = normalizeManualEntry(req.body);
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
        res.json(successResponse({
          count: created.length,
          entry,
          warnings: created.warnings || [],
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.QUOTE_STATISTICS_FAILED);
      }
    });
  }

  return { registerRoutes };
}
