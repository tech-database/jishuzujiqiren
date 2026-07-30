import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeManualQuoteEntry,
  quoteOfficerCategories,
  summarizeQuoteRecords,
} from "./quote-statistics-service.js";

test("normalizes manual quote and order entries for the shared statistics table", () => {
  assert.deepEqual(
    normalizeManualQuoteEntry({
      type: "下单",
      category: "软体",
      quoteOfficer: "胡燕琪",
      date: "2026-07-30",
      region: "华东区",
      business: "张三",
      quantity: "3",
      unitPrice: "125.50",
    }),
    {
      类型: "下单",
      报价日期: "2026-07-30",
      类别: "软体",
      报价员: "胡燕琪",
      区域: "华东区",
      业务: "张三",
      数量: 3,
      单价: 125.5,
      总价: 376.5,
    },
  );
  assert.throws(
    () => normalizeManualQuoteEntry({
      type: "报价",
      category: "胶板",
      quoteOfficer: "杨利伟",
      date: "2026-02-30",
      region: "华东区",
      business: "张三",
      quantity: 1,
      unitPrice: 100,
    }),
    /有效日期/,
  );
});

test("summarizes one quote sheet into one table record", () => {
  const result = summarizeQuoteRecords(
    [
      {
        区域: "华南区",
        业务: "张三",
        数量: 2,
        销售单价: "1,200.50",
      },
      {
        区域: "华南区",
        业务: "张三",
        数量: 3,
        销售单价: 300,
      },
    ],
    {
      quoteOfficer: "杨利伟",
      quoteDate: "2026-07-27",
      now: new Date("2026-07-28T03:00:00.000Z"),
    },
  );

  assert.deepEqual(result, {
    summary: {
      报价日期: "2026-07-27",
      类别: "胶板",
      报价员: "杨利伟",
      区域: "华南区",
      业务: "张三",
      单价: 1500.5,
      总价: 3301,
    },
    sourceRowCount: 2,
    ignoredUnpricedRowCount: 0,
    ignoredInvalidRowCount: 0,
    warnings: [],
  });
});

test("ignores product rows that do not have a sales unit price", () => {
  const result = summarizeQuoteRecords(
    [
      { 区域: "华西区", 业务: "王子民", 数量: 25, 销售单价: 4234.69 },
      { 区域: "华西区", 业务: "王子民", 数量: 2, 销售单价: 4996.992 },
      { 区域: "华西区", 业务: "王子民", 数量: 1, 销售单价: 6608.107 },
      { 区域: "华西区", 业务: "王子民", 数量: 3, 销售单价: "" },
    ],
    {
      quoteOfficer: "杨利伟",
      now: new Date("2026-07-28T03:00:00.000Z"),
    },
  );

  assert.equal(result.sourceRowCount, 3);
  assert.equal(result.ignoredUnpricedRowCount, 1);
  assert.equal(result.summary.单价, 15839.79);
  assert.equal(result.summary.总价, 122469.34);
});

test("skips a priced row with invalid quantity instead of rejecting the whole sheet", () => {
  const result = summarizeQuoteRecords(
    [
      { 序号: 19, 区域: "必填", 业务: "李艳", 数量: 34, 销售单价: 1486.615 },
      { 序号: 20, 区域: "必填", 业务: "李艳", 数量: "", 销售单价: 1486.615 },
      { 序号: 21, 区域: "必填", 业务: "李艳", 数量: 46, 销售单价: 1835.275 },
    ],
    {
      quoteOfficer: "杨利伟",
      now: new Date("2026-07-29T03:00:00.000Z"),
    },
  );

  assert.equal(result.sourceRowCount, 2);
  assert.equal(result.ignoredInvalidRowCount, 1);
  assert.deepEqual(result.warnings, ["序号 20 缺少「数量」，已忽略该行"]);
  assert.equal(result.summary.单价, 3321.89);
  assert.equal(result.summary.总价, 134967.56);
});

test("uses 未填写 with a warning when quote region is absent", () => {
  const result = summarizeQuoteRecords(
    [{ 业务: "谢广", 数量: 2, 销售单价: 300 }],
    {
      quoteOfficer: "杨利伟",
      now: new Date("2026-07-28T08:00:00+08:00"),
    },
  );

  assert.equal(result.summary["区域"], "未填写");
  assert.equal(result.summary["总价"], 600);
  assert.deepEqual(result.warnings, [
    "清单中未找到「区域」，已按“未填写”处理",
  ]);
});

test("maps every supported quote officer to the configured category", () => {
  assert.deepEqual(quoteOfficerCategories, {
    杨利伟: "胶板",
    邓翠萍: "胶板",
    朱海韵: "油漆",
    胡燕琪: "软体",
  });
});

test("rejects invalid officers, missing calculation columns and mixed sheet metadata", () => {
  const base = [{ 区域: "华南区", 业务: "张三", 数量: 2, 销售单价: 1 }];

  assert.throws(
    () => summarizeQuoteRecords(base, { quoteOfficer: "其他人" }),
    /请选择有效的报价员/,
  );
  assert.throws(
    () => summarizeQuoteRecords([{ 区域: "华南区", 业务: "张三", 数量: 2 }], {
      quoteOfficer: "邓翠萍",
    }),
    /未找到「销售单价」列/,
  );
  assert.throws(
    () => summarizeQuoteRecords([
      ...base,
      { 区域: "华东区", 业务: "张三", 数量: 2, 销售单价: 3 },
    ], { quoteOfficer: "朱海韵" }),
    /存在多个「区域」值/,
  );
  assert.throws(
    () => summarizeQuoteRecords([{ 区域: "华南区", 业务: "张三", 销售单价: 3 }], {
      quoteOfficer: "胡燕琪",
    }),
    /未找到「数量」列/,
  );
});
