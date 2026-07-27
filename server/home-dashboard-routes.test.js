import assert from "node:assert/strict";
import test from "node:test";
import { createHomeDashboardRoutes } from "./home-dashboard-routes.js";

const fixedDate = new Date("2026-07-27T04:00:00.000Z");

function createHarness({
  query = {},
  now = () => new Date(fixedDate),
  statusSyncInfo = {
    lastFinishedAt: "2026-07-27T03:00:00.000Z",
    lastError: "",
  },
  serviceOverrides = {},
} = {}) {
  const routes = new Map();
  const calls = {
    analytics: [],
    dashboardTables: [],
    invalidations: [],
    ownerRosterRefreshes: 0,
  };
  const app = {
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    },
  };
  const services = {
    getConfigStatus: () => ({ ready: true }),
    getFeishuCacheStatus: () => ({ records: { size: 2 } }),
    invalidateBitableRecordCache: (tableKey) => {
      calls.invalidations.push(tableKey);
    },
    queryDrawingAnalytics: async (options) => {
      calls.analytics.push(options);
      return { table: options.tableKey, total: 1 };
    },
    queryDrawingOwnerStats: async () => ({ owners: [{ name: "张三" }] }),
    queryHomeDashboardTable: async (options) => {
      calls.dashboardTables.push(options);
      return {
        table: options.tableKey,
        events: [
          {
            id: `${options.tableKey}-event`,
            time:
              options.tableKey === "paint"
                ? "2026-07-27T03:30:00.000Z"
                : "2026-07-27T03:15:00.000Z",
          },
        ],
      };
    },
    refreshDrawingOwnerRoster: async () => {
      calls.ownerRosterRefreshes += 1;
    },
    ...serviceOverrides,
  };
  createHomeDashboardRoutes({
    buildHealthStatus: async () => ({
      ok: false,
      checkedAt: "2026-07-27T03:45:00.000Z",
      checks: {
        websocket: { ok: false, message: "长连接中断" },
      },
    }),
    statusSyncInfo,
    serverStartedAt: "2026-07-27T00:00:00.000Z",
    now,
    services,
  }).registerRoutes(app);

  async function request(requestQuery = query) {
    const response = {
      body: null,
      headers: {},
      statusCode: 200,
      set(name, value) {
        this.headers[name] = value;
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    await routes.get("GET /api/home-dashboard")({ query: requestQuery }, response);
    return response;
  }

  return { calls, request };
}

test("home dashboard aggregates current data, performance and monitoring logs", async () => {
  const { calls, request } = createHarness();

  const response = await request();

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.headers["Cache-Control"],
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  assert.deepEqual(response.body.range, {
    startDate: "2026-07-01",
    endDate: "2026-07-27",
  });
  assert.equal(response.body.performanceIncluded, true);
  assert.deepEqual(
    calls.analytics.map((call) => call.tableKey),
    ["board", "paint"],
  );
  assert.deepEqual(
    calls.dashboardTables.map((call) => call.tableKey),
    ["board", "paint"],
  );
  assert.equal(response.body.realtimeLogs[0].time, "2026-07-27T03:45:00.000Z");
  assert.ok(
    response.body.realtimeLogs.some(
      (event) => event.source === "飞书接口" && event.content === "长连接中断",
    ),
  );
});

test("home dashboard applies force refresh once during the cooldown", async () => {
  const { calls, request } = createHarness();

  const first = await request({ forceRefresh: "1", includePerformance: "0" });
  const second = await request({ forceRefresh: "1", includePerformance: "0" });

  assert.equal(first.body.cache.forceRefreshApplied, true);
  assert.equal(second.body.cache.forceRefreshApplied, false);
  assert.deepEqual(calls.invalidations, ["board", "paint"]);
  assert.equal(calls.ownerRosterRefreshes, 1);
  assert.equal(calls.analytics.length, 0);
  assert.equal(first.body.performance, undefined);
});

test("home dashboard rejects an invalid performance date range before querying data", async () => {
  const { calls, request } = createHarness();

  const response = await request({
    startDate: "2026-07-28",
    endDate: "2026-07-27",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "绩效统计开始日期不能晚于结束日期");
  assert.equal(calls.dashboardTables.length, 0);
  assert.equal(calls.analytics.length, 0);
});
