import assert from "node:assert/strict";
import test from "node:test";
import { createQuoteDashboardRoutes } from "./quote-dashboard-routes.js";

test("initial quote dashboard aggregates today and month in one request", async () => {
  const routes = new Map();
  const calls = [];
  const now = new Date("2026-07-30T04:00:00.000Z");
  const app = {
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    },
  };
  createQuoteDashboardRoutes({
    now: () => now,
    services: {
      queryQuoteDashboard: async (options) => {
        calls.push(options);
        return { range: { startDate: options.startDate, endDate: options.endDate } };
      },
    },
  }).registerRoutes(app);

  const response = {
    body: null,
    headers: {},
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
  await routes.get("GET /api/quote-dashboard/initial")({
    query: {
      today: "2026-07-30",
      monthStartDate: "2026-07-01",
      monthEndDate: "2026-07-31",
    },
  }, response);

  assert.equal(response.body.ok, true);
  assert.equal(response.body.checkedAt, now.toISOString());
  assert.deepEqual(
    calls.map(({ startDate, endDate }) => ({ startDate, endDate })),
    [
      { startDate: "2026-07-30", endDate: "2026-07-30" },
      { startDate: "2026-07-01", endDate: "2026-07-31" },
    ],
  );
  assert.deepEqual(response.body.today.range, {
    startDate: "2026-07-30",
    endDate: "2026-07-30",
  });
  assert.deepEqual(response.body.month.range, {
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  });
});
