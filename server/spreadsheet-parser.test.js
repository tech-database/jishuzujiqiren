import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  parseLegacySpreadsheetBuffer,
  parseSpreadsheetBuffer,
  spreadsheetLimits,
} from "./bot-core.js";

test("parses a variable-layout xlsx workbook", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("报价数据");
  sheet.addRow(["项目说明", "非固定模板"]);
  sheet.addRow(["业务姓名", "测试人员"]);
  sheet.addRow(["料号", "区域", "数量"]);
  sheet.addRow(["TEST-XLSX-001", "华南区", 12]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "可变模板.xlsx" });

  assert.equal(records.length, 1);
  assert.equal(records[0]["料号"], "TEST-XLSX-001");
  assert.equal(records[0]["区域"], "华南区");
  assert.equal(records[0]["数量"], "12");
});

test("parses csv without requiring a fixed template", async () => {
  const buffer = Buffer.from(
    "说明,内部导入,\n料号,区域,数量\nTEST-CSV-001,华北区,7\n",
    "utf8",
  );

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "任意列顺序.csv" });

  assert.equal(records.length, 1);
  assert.equal(records[0]["料号"], "TEST-CSV-001");
  assert.equal(records[0]["区域"], "华北区");
  assert.equal(records[0]["数量"], "7");
});

test("rejects a file larger than the existing 50MB limit before parsing", async () => {
  const oversized = Buffer.alloc(spreadsheetLimits.fileBytes + 1);
  await assert.rejects(
    parseSpreadsheetBuffer(oversized, { fileName: "oversized.xlsx" }),
    /超过 50MB 大小限制/,
  );
});

test("rejects invalid xlsx content instead of passing it to legacy conversion", async () => {
  await assert.rejects(
    parseSpreadsheetBuffer(Buffer.from("not an xlsx"), { fileName: "broken.xlsx" }),
    /文件内容无效/,
  );
});

test("accepts 200 data rows and rejects 201 before any write can begin", async () => {
  const makeCsv = (rowCount) => Buffer.from(
    [
      "料号,区域,数量",
      ...Array.from({ length: rowCount }, (_, index) => `LIMIT-${index + 1},华南区,1`),
    ].join("\n"),
    "utf8",
  );

  const accepted = await parseSpreadsheetBuffer(makeCsv(spreadsheetLimits.importRows), {
    fileName: "200行.csv",
  });
  assert.equal(accepted.length, 200);

  await assert.rejects(
    parseSpreadsheetBuffer(makeCsv(spreadsheetLimits.importRows + 1), {
      fileName: "201行.csv",
    }),
    /清单共有 201 行，单次最多允许 200 行/,
  );
});

test("reads ordinary legacy xls data in compatibility mode without Excel or WPS", async () => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["说明", "旧版文件"],
    ["料号", "区域", "数量"],
    ["LEGACY-001", "华南区", 3],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "数据");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" });

  const records = await parseLegacySpreadsheetBuffer(buffer);

  assert.equal(records.length, 1);
  assert.equal(records[0]["料号"], "LEGACY-001");
  assert.equal(records[0]["区域"], "华南区");
  assert.equal(records[0]["数量"], "3");
  assert.deepEqual(records.warnings, [
    "旧版 .xls 已使用兼容模式读取，内嵌图片可能无法提取。",
  ]);
});

test("recognizes zip-based xlsx content even when a WPS file uses the xls extension", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("数据");
  sheet.addRow(["料号", "区域", "数量"]);
  sheet.addRow(["MISNAMED-001", "华南区", 2]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "WPS导出.xls" });

  assert.equal(records.length, 1);
  assert.equal(records[0]["料号"], "MISNAMED-001");
  assert.equal(records.warnings, undefined);
});
