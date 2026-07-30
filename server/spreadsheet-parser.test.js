import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  getActiveLegacyWorksheetName,
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

test("reads the worksheet that was active when the xlsx workbook was saved", async () => {
  const workbook = new ExcelJS.Workbook();
  const firstSheet = workbook.addWorksheet("说明");
  firstSheet.addRow(["这里不是报价数据"]);
  const quoteSheet = workbook.addWorksheet("报价单");
  quoteSheet.addRow(["产品名称", "区域", "数量", "销售单价"]);
  quoteSheet.addRow(["会议桌", "华西区", 2, 300]);
  workbook.views = [{ activeTab: 1 }];
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "激活报价页.xlsx" });

  assert.equal(records.length, 1);
  assert.equal(records[0]["产品名称"], "会议桌");
  assert.equal(records[0]["销售单价"], "300");
});

test("reads quote metadata from common region and business label variants", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("报价单");
  sheet.addRow(["区域：华东区", "", "业务员", "谢广"]);
  sheet.addRow(["料号", "区域", "数量", "销售单价"]);
  sheet.addRow(["TEST-REGION-001", "", 2, 300]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "区域别名.xlsx" });

  assert.equal(records.length, 1);
  assert.equal(records[0]["区域"], "华东区");
  assert.equal(records[0]["业务"], "谢广");
});

test("reads quote metadata placed below its label", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("报价单");
  sheet.addRow(["营销大区", "", "业务姓名"]);
  sheet.addRow(["华南区", "", "向德坤"]);
  sheet.addRow(["料号", "区域", "数量", "销售单价"]);
  sheet.addRow(["TEST-REGION-002", "", 3, 200]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "纵向元数据.xlsx" });

  assert.equal(records.length, 1);
  assert.equal(records[0]["区域"], "华南区");
  assert.equal(records[0]["业务"], "向德坤");
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

test("selects the active worksheet metadata used by real legacy xls files", () => {
  const workbook = {
    SheetNames: ["说明", "报价单"],
    Workbook: { WBView: [{ activeTab: 1 }] },
  };

  assert.equal(getActiveLegacyWorksheetName(workbook), "报价单");
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

test("uses cached formula results when quote amount cells contain formulas", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("报价数据");
  sheet.addRow(["产品名称", "区域", "数量", "销售单价", "销售总价"]);
  const row = sheet.addRow(["柜体", "华南区", 2, 100, null]);
  row.getCell(5).value = { formula: "C2*D2", result: 200 };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "公式报价.xlsx" });
  assert.equal(records[0]["销售总价"], 200);
});

test("ignores formatting that extends to Excel's last column", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("报价数据");
  sheet.addRow(["产品名称", "区域", "数量", "销售单价"]);
  sheet.addRow(["柜体", "华南区", 2, 100]);
  sheet.getCell("XFD1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
  };
  assert.equal(sheet.columnCount, 16384);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "远端格式列.xlsx" });
  assert.equal(records.length, 1);
  assert.equal(records[0]["销售单价"], "100");
});

test("ignores quotation signature and brand-approval footer rows", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("报价数据");
  sheet.addRow(["料号", "区域", "数量", "产品名称", "备注"]);
  sheet.addRow(["FOOTER-GUARD-001", "华南区", 2, "柜体", "正常数据"]);
  sheet.addRow([
    "",
    "",
    "报价员：\n品牌报审：",
    "报价员：张三\n品牌报审：李四",
    "审核：王五",
  ]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const records = await parseSpreadsheetBuffer(buffer, { fileName: "带签字尾行.xlsx" });

  assert.equal(records.length, 1);
  assert.equal(records[0]["料号"], "FOOTER-GUARD-001");
});
