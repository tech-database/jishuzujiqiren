import assert from "node:assert/strict";
import test from "node:test";
import { queryQuoteDashboard } from "./quote-dashboard-service.js";

function record(fields) {
  return { record_id: Math.random().toString(36), fields };
}

test("summarizes officers and compares quote and confirmed orders in a selected range", async () => {
  const configs = {
    quote: { key: "quote", label: "报价统计" },
    board: { key: "board", label: "胶板" },
    paint: { key: "paint", label: "油漆" },
  };
  const records = {
    quote: [
      record({ 报价日期: "2026-07-29", 报价员: "杨利伟", 区域: "华南区", 业务: "李艳", 单价: 100, 总价: 1000 }),
      record({ 报价日期: "2026/07/29", 报价员: "杨利伟", 区域: "华东区", 业务: "谢广", 单价: 200, 总价: 2000 }),
      record({ 报价日期: "2026-07-08", 报价员: "朱海韵", 区域: "华南区", 业务: "李艳", 单价: 300, 总价: 3000 }),
      record({ 报价日期: "2026-06-30", 报价员: "邓翠萍", 区域: "华南区", 业务: "李艳", 单价: 900, 总价: 9000 }),
    ],
    board: [
      record({ 日期: 1785254400000, 是否下单: "是", 区域: "华南区", 业务: "李艳", 销售总价: "2,500" }),
      record({ 日期: 1785254400000, 是否下单: "否", 区域: "华东区", 业务: "谢广", 销售总价: "8,000" }),
    ],
    paint: [
      record({ 日期: 1785254400000, 是否下单: true, 区域: "华东区", 业务: "谢广", 销售总价: 1500 }),
    ],
  };
  const fieldMaps = {
    quote: new Map(["报价日期", "报价员", "区域", "业务", "单价", "总价"].map((name) => [name, 1])),
    board: new Map(["日期", "是否下单", "区域", "业务", "销售总价"].map((name) => [name, 1])),
    paint: new Map(["日期", "是否下单", "区域", "业务", "销售总价"].map((name) => [name, 1])),
  };
  records.board[0].fields["数量"] = 5;
  records.board[0].fields["销售单价"] = 500;
  records.board[0].fields["销售总价"] = "=K5*G5";
  records.board[1].fields["数量"] = 10;
  records.board[1].fields["销售单价"] = 800;
  records.paint[0].fields["数量"] = 3;
  records.paint[0].fields["销售单价"] = 500;
  records.paint[0].fields["销售总价"] = "含6个线盒";
  for (const fieldMap of [fieldMaps.board, fieldMaps.paint]) {
    fieldMap.set("数量", 2);
    fieldMap.set("销售单价", 2);
  }

  const result = await queryQuoteDashboard(
    {
      now: new Date("2026-07-29T12:00:00+08:00"),
      startDate: "2026-07-01",
      endDate: "2026-07-29",
    },
    {
      drawingTableKeys: () => ["board", "paint"],
      getBitableConfig: (key) => configs[key],
      getTenantAccessToken: async () => "token",
      getBitableFieldMap: async (_token, config) => fieldMaps[config.key],
      listCachedBitableRecords: async (_token, config) => records[config.key],
    },
  );

  assert.deepEqual(result.summary, { fileCount: 3, unitPrice: 600, total: 6000 });
  assert.deepEqual(result.monthSummary, {
    fileCount: 3,
    quoteTotal: 6000,
    orderCount: 2,
    orderTotal: 4000,
    conversionRate: 66.7,
  });
  assert.deepEqual(result.categories.board.summary, {
    fileCount: 2,
    unitPrice: 300,
    total: 3000,
  });
  assert.deepEqual(result.categories.board.monthSummary, {
    fileCount: 2,
    quoteTotal: 3000,
    orderCount: 1,
    orderTotal: 2500,
    conversionRate: 83.3,
  });
  assert.deepEqual(result.categories.paint.summary, {
    fileCount: 1,
    unitPrice: 300,
    total: 3000,
  });
  assert.deepEqual(result.categories.paint.monthSummary, {
    fileCount: 1,
    quoteTotal: 3000,
    orderCount: 1,
    orderTotal: 1500,
    conversionRate: 50,
  });
  assert.deepEqual(result.categories.soft.summary, {
    fileCount: 0,
    unitPrice: 0,
    total: 0,
  });
  assert.deepEqual(
    result.officers.find((item) => item.name === "杨利伟"),
    { name: "杨利伟", category: "胶板", fileCount: 2, unitPrice: 300, total: 3000 },
  );
  assert.deepEqual(result.regions, [
    {
      name: "华南区",
      quoteCount: 2,
      orderCount: 1,
      quoteTotal: 4000,
      orderTotal: 2500,
      difference: -1500,
      conversionRate: 62.5,
    },
    {
      name: "华东区",
      quoteCount: 1,
      orderCount: 1,
      quoteTotal: 2000,
      orderTotal: 1500,
      difference: -500,
      conversionRate: 75,
    },
  ]);
  assert.equal(result.month.startDate, "2026-07-01");
  assert.equal(result.month.endDate, "2026-07-29");
  assert.equal(result.range.label, "2026-07-01 至 2026-07-29");
});

test("defaults the dashboard query range to today and rejects a reversed range", async () => {
  const listCalls = [];
  const configs = {
    quote: { key: "quote", label: "报价统计" },
    board: { key: "board", label: "胶板" },
  };
  const fieldMaps = {
    quote: new Map(["报价日期", "报价员", "区域", "业务", "单价", "总价"].map((name) => [name, 1])),
    board: new Map(["日期", "是否下单", "区域", "业务", "数量", "销售单价"].map((name) => [name, 1])),
  };
  const dependencies = {
    drawingTableKeys: () => ["board"],
    getBitableConfig: (key) => configs[key],
    getTenantAccessToken: async () => "token",
    getBitableFieldMap: async (_token, config) => fieldMaps[config.key],
    listCachedBitableRecords: async (_token, config, options) => {
      listCalls.push({ key: config.key, options });
      return config.key === "quote"
        ? [
          record({ 报价日期: "2026-07-29", 报价员: "杨利伟", 区域: "华南区", 业务: "李艳", 单价: 100, 总价: 1000 }),
          record({ 报价日期: "2026-07-28", 报价员: "杨利伟", 区域: "华南区", 业务: "李艳", 单价: 200, 总价: 2000 }),
        ]
        : [];
    },
  };

  const result = await queryQuoteDashboard(
    { now: new Date("2026-07-29T12:00:00+08:00") },
    dependencies,
  );

  assert.deepEqual(result.range, {
    startDate: "2026-07-29",
    endDate: "2026-07-29",
    label: "2026-07-29",
  });
  assert.deepEqual(result.summary, { fileCount: 1, unitPrice: 100, total: 1000 });
  assert.equal(listCalls.find((call) => call.key === "board").options.startDate, "2026-07-29");
  await assert.rejects(
    queryQuoteDashboard(
      { now: new Date("2026-07-29T12:00:00+08:00"), startDate: "2026-07-30", endDate: "2026-07-29" },
      dependencies,
    ),
    /开始日期不能晚于结束日期/,
  );
});

test("counts manually entered order records from the quote statistics table", async () => {
  const quoteFields = [
    "报价日期",
    "类型",
    "类别",
    "报价员",
    "区域",
    "业务",
    "单价",
    "总价",
  ];
  const result = await queryQuoteDashboard(
    {
      now: new Date("2026-07-30T12:00:00+08:00"),
      startDate: "2026-07-01",
      endDate: "2026-07-30",
    },
    {
      drawingTableKeys: () => [],
      getBitableConfig: () => ({ key: "quote", label: "报价统计" }),
      getTenantAccessToken: async () => "token",
      getBitableFieldMap: async () => new Map(quoteFields.map((name) => [name, 1])),
      listCachedBitableRecords: async () => [
        record({
          报价日期: "2026-07-30",
          类型: "下单",
          类别: "软体",
          区域: "华东区",
          业务: "张三",
          数量: 2,
          单价: 100,
          总价: 200,
        }),
      ],
    },
  );

  assert.equal(result.monthSummary.fileCount, 0);
  assert.equal(result.monthSummary.orderCount, 1);
  assert.equal(result.monthSummary.orderTotal, 200);
  assert.equal(result.categories.soft.monthSummary.orderTotal, 200);
});
