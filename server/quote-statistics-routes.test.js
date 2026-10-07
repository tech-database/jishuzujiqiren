import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuoteStatisticsRoutes,
  quoteManualEntryFields,
  quoteOrderEntryFields,
} from "./quote-statistics-routes.js";

function createHarness(registerRoutes) {
  const routes = new Map();
  const app = {
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
  };
  registerRoutes(app);

  async function request(path, { body = Buffer.from("file"), query = {} } = {}) {
    const handlers = routes.get(`POST ${path}`);
    const response = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    await handlers.at(-1)({ body, query }, response);
    return response;
  }

  return { request };
}

test("order preview parses but does not write, while commit writes every order row", async () => {
  let writeCalls = 0;
  const summary = {
    类型: "下单",
    报价日期: "2026-07-28",
    类别: "软体",
    报价员: "胡燕绮",
    区域: "华南区",
    业务: "张三",
    单价: 100,
    总价: 300,
  };
  const records = [
    { ...summary, 料件编号: "J-001", 数量: 1, 单价: 100, 总价: 100 },
    { ...summary, 料件编号: "J-002", 数量: 2, 单价: 100, 总价: 200 },
  ];
  const harness = createHarness(
    createQuoteStatisticsRoutes({
      services: {
        parseSpreadsheetBuffer: async () => [{ 销售单价: 100, 销售总价: 300 }],
        normalizeOrderRecords: (_records, options) => {
          assert.equal(options.entryType, "下单");
          assert.equal(options.quoteOfficer, "胡燕绮");
          assert.equal(options.quoteDate, "2026-07-28");
          return { summary, records, recordCount: 2, sourceRowCount: 2 };
        },
        confirmDrawingOrders: async (options) => {
          assert.deepEqual(options, {
            materialCodes: ["J-001", "J-002"],
            allowMissing: true,
          });
          assert.equal(Object.hasOwn(options, "tableKey"), false);
          return {
            result: [
              { materialCode: "J-001", table: "paint", changed: true },
              { materialCode: "J-002", table: "paint", changed: false },
            ],
            missing: [],
          };
        },
        createBitableRecords: async (records, options) => {
          writeCalls += 1;
          assert.equal(records.length, 2);
          assert.equal(options.tableKey, "quote");
          assert.deepEqual(options.requiredFields, quoteOrderEntryFields);
          return [{ recordId: "record-1" }, { recordId: "record-2" }];
        },
      },
    }).registerRoutes,
  );

  const query = {
    fileName: "报价.xlsx",
    entryType: "下单",
    quoteOfficer: "胡燕绮",
    quoteDate: "2026-07-28",
  };
  const preview = await harness.request("/api/quote-statistics/preview", { query });
  assert.equal(preview.body.summary.总价, 300);
  assert.equal(writeCalls, 0);

  const commit = await harness.request("/api/quote-statistics/commit", { query });
  assert.equal(commit.body.count, 2);
  assert.deepEqual(commit.body.orderSync, {
    matchedCount: 2,
    changedCount: 1,
    missing: [],
  });
  assert.equal(writeCalls, 1);
});

test("quote commit rejects a zero-record write result", async () => {
  const summary = {
    报价日期: "2026-07-28",
    类别: "胶板",
    报价员: "杨利伟",
    区域: "华西",
    业务: "王子民",
    单价: 100,
    总价: 300,
  };
  const harness = createHarness(
    createQuoteStatisticsRoutes({
      services: {
        parseSpreadsheetBuffer: async () => [{ 数量: 3, 销售单价: 100 }],
        summarizeQuoteRecords: () => ({ summary, sourceRowCount: 1 }),
        createBitableRecords: async () => [],
      },
    }).registerRoutes,
  );

  const response = await harness.request("/api/quote-statistics/commit", {
    query: { fileName: "报价.xlsx", quoteOfficer: "杨利伟" },
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.body.code, "QUOTE_WRITE_COUNT_MISMATCH");
  assert.match(response.body.error, /应创建 1 条记录，实际创建 0 条/);
});

test("manual data entry writes one typed record to the quote statistics table", async () => {
  const entry = {
    类型: "报价",
    报价日期: "2026-07-30",
    类别: "胶板",
    报价员: "杨利伟",
    区域: "华北区",
    业务: "李艳",
    料件编号: "J-001",
    数量: 2,
    单价: 100,
    总价: 200,
  };
  const harness = createHarness(
    createQuoteStatisticsRoutes({
      services: {
        normalizeManualQuoteEntry: (body) => {
          assert.equal(body.type, "报价");
          return entry;
        },
        createBitableRecords: async (records, options) => {
          assert.deepEqual(records, [entry]);
          assert.equal(options.tableKey, "quote");
          assert.deepEqual(options.requiredFields, quoteManualEntryFields);
          return [{ recordId: "record-manual-1" }];
        },
      },
    }).registerRoutes,
  );

  const response = await harness.request("/api/quote-statistics/manual", {
    body: { type: "报价" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.count, 1);
  assert.deepEqual(response.body.entry, entry);
});

test("manual order entry synchronizes by material code across both drawing tables", async () => {
  const entry = {
    类型: "下单",
    报价日期: "2026-10-07",
    类别: "油漆",
    报价员: "朱海韵",
    区域: "华北区",
    业务: "李艳",
    料件编号: "J-SHARED-001",
    数量: 2,
    单价: 100,
    总价: 200,
  };
  let receivedOptions;
  const harness = createHarness(
    createQuoteStatisticsRoutes({
      services: {
        normalizeManualQuoteEntry: () => entry,
        confirmDrawingOrders: async (options) => {
          receivedOptions = options;
          return {
            result: [{ materialCode: "J-SHARED-001", table: "board", changed: true }],
            missing: [],
          };
        },
        createBitableRecords: async () => [{ recordId: "order-1" }],
      },
    }).registerRoutes,
  );

  const response = await harness.request("/api/quote-statistics/manual", {
    body: { type: "下单" },
  });

  assert.deepEqual(receivedOptions, {
    materialCodes: ["J-SHARED-001"],
    allowMissing: true,
  });
  assert.equal(Object.hasOwn(receivedOptions, "tableKey"), false);
  assert.deepEqual(response.body.orderSync, {
    matchedCount: 1,
    changedCount: 1,
    missing: [],
  });
});

test("order import writes statistics and reports material codes missing from drawing tables", async () => {
  let writeCalls = 0;
  const record = {
    类型: "下单",
    报价日期: "2026-10-07",
    类别: "油漆",
    报价员: "朱海韵",
    区域: "华北区",
    业务: "李艳",
    料件编号: "J-MISSING",
    数量: 1,
    单价: 100,
    总价: 100,
  };
  const harness = createHarness(
    createQuoteStatisticsRoutes({
      services: {
        parseSpreadsheetBuffer: async () => [{}],
        normalizeOrderRecords: () => ({
          summary: record,
          records: [record],
          recordCount: 1,
          sourceRowCount: 1,
        }),
        confirmDrawingOrders: async () => ({ result: [], missing: ["J-MISSING"] }),
        createBitableRecords: async () => {
          writeCalls += 1;
          return [{ recordId: "quote-order-1" }];
        },
      },
    }).registerRoutes,
  );

  const response = await harness.request("/api/quote-statistics/commit", {
    query: { fileName: "下单.xlsx", entryType: "下单", quoteOfficer: "朱海韵" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.count, 1);
  assert.deepEqual(response.body.orderSync, {
    matchedCount: 0,
    changedCount: 0,
    missing: ["J-MISSING"],
  });
  assert.match(response.body.warnings[0], /J-MISSING.*已跳过同步/);
  assert.equal(writeCalls, 1);
});

test("quote routes reject empty or unsupported files", async () => {
  const harness = createHarness(
    createQuoteStatisticsRoutes({
      services: {
        parseSpreadsheetBuffer: async () => [],
      },
    }).registerRoutes,
  );

  const empty = await harness.request("/api/quote-statistics/preview", {
    body: Buffer.alloc(0),
    query: { fileName: "报价.xlsx" },
  });
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.body.error, "上传文件为空");

  const unsupported = await harness.request("/api/quote-statistics/preview", {
    query: { fileName: "报价.pdf" },
  });
  assert.equal(unsupported.statusCode, 400);
  assert.match(unsupported.body.error, /仅支持/);
});
