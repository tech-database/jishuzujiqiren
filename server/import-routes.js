import express from "express";
import { createBitableRecords, writeFromText } from "./bot-core.js";
import { parseSpreadsheetBuffer } from "./spreadsheet-parser.js";
import { apiErrorCodes, sendError, successResponse } from "./api-response.js";

export function createImportRoutes({ services = {} } = {}) {
  const createRecords = services.createBitableRecords || createBitableRecords;
  const parseSpreadsheet = services.parseSpreadsheetBuffer || parseSpreadsheetBuffer;
  const writeMessageText = services.writeFromText || writeFromText;

  function registerRoutes(app) {
    app.post("/api/test-message", async (req, res) => {
      try {
        const result = await writeMessageText(req.body?.text, {
          dryRun: req.body?.dryRun !== false,
          tableKey: req.body?.tableKey,
        });
        res.json(successResponse(result));
      } catch (error) {
        sendError(res, error, apiErrorCodes.SPREADSHEET_IMPORT_FAILED);
      }
    });

    app.post(
      "/api/upload-spreadsheet",
      express.raw({ limit: "50mb", type: "*/*" }),
      async (req, res) => {
        try {
          if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            throw new Error("上传文件为空");
          }
          const fileName = String(req.query.fileName || "spreadsheet.xlsx");
          if (!/\.(xlsx|xls|csv)$/i.test(fileName)) {
            throw new Error("仅支持 xlsx、xls、csv 文件");
          }
          const records = await parseSpreadsheet(req.body, { fileName });
          const result = await createRecords(records, { tableKey: req.query.tableKey });
          res.json(successResponse({
            table: req.query.tableKey || "board",
            fileName,
            count: result.length,
            parsedCount: records.length,
            resultCount: result.length,
            warnings: result.warnings || [],
          }));
        } catch (error) {
          sendError(res, error, apiErrorCodes.SPREADSHEET_IMPORT_FAILED);
        }
      },
    );
  }

  return { registerRoutes };
}
