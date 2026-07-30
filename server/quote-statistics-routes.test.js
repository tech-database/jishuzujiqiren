import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuoteStatisticsRoutes,
  quoteManualEntryFields,
  quoteStatisticsFields,
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

test("quote preview parses but does not write, while commit writes one quote record", async () => {
  let writeCalls = 0;
  const summary = {
    类型: "下单",
    报价日期: "2026-07-28",
    类别: "软体",
    报价员: "胡燕琪",
    区域: "华南区",
    业务: "张三",
    单价: 100,
    总价: 300,
  };
  const harness = createHarness(
    createQuoteStatisticsRoutes({
      services: {
        parseSpreadsheetBuffer: async () => [{ 销售单价: 100, 销售总价: 300 }],
        summarizeQuoteRecords: (_records, options) => {
          assert.equal(options.entryType, "下单");
          assert.equal(options.quoteOfficer, "胡燕琪");
          assert.equal(options.quoteDate, "2026-07-28");
          return { summary, sourceRowCount: 1 };
        },
        createBitableRecords: async (records, options) => {
          writeCalls += 1;
          assert.deepEqual(records, [summary]);
          assert.equal(options.tableKey, "quote");
          assert.deepEqual(options.requiredFields, quoteStatisticsFields);
          return [{ recordId: "record-1" }];
        },
      },
    }).registerRoutes,
  );

  const query = {
    fileName: "报价.xlsx",
    entryType: "下单",
    quoteOfficer: "胡燕琪",
    quoteDate: "2026-07-28",
  };
  const preview = await harness.request("/api/quote-statistics/preview", { query });
  assert.equal(preview.body.summary.总价, 300);
  assert.equal(writeCalls, 0);

  const commit = await harness.request("/api/quote-statistics/commit", { query });
  assert.equal(commit.body.count, 1);
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
