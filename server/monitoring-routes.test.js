import assert from "node:assert/strict";
import test from "node:test";
import { createMonitoringRoutes } from "./monitoring-routes.js";

function createHarness(options = {}) {
  const routes = new Map();
  const app = {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
  };
  const statusSyncInfo = { running: false, lastError: "" };
  createMonitoringRoutes({
    buildHealthStatus: options.buildHealthStatus || (async () => ({ ok: true })),
    getConfigStatus: () => ({ ready: true }),
    loadRuntimeLogs: options.loadRuntimeLogs || (async () => ({ logs: [], limit: 200 })),
    requireAdminAccess: options.requireAdminAccess || ((_req, _res, next) => next()),
    statusSyncInfo,
  }).registerRoutes(app);

  async function request(path, { query = {} } = {}) {
    const response = {
      body: null,
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    const handlers = routes.get(`GET ${path}`);
    let index = 0;
    async function next() {
      const handler = handlers[index++];
      if (handler) await handler({ query }, response, next);
    }
    await next();
    return response;
  }

  return { request, statusSyncInfo };
}

test("monitoring routes expose config and background sync state", async () => {
  const { request, statusSyncInfo } = createHarness();

  assert.deepEqual((await request("/api/status")).body.data, {
    status: { ready: true },
  });
  assert.deepEqual((await request("/api/background-status-sync")).body.data, {
    status: statusSyncInfo,
  });
});

test("runtime logs require admin access and use a bounded server-side reader", async () => {
  let readerCalls = 0;
  const { request } = createHarness({
    requireAdminAccess: (_req, res) => res.status(401).json({ ok: false }),
    loadRuntimeLogs: async () => {
      readerCalls += 1;
      return { logs: [] };
    },
  });
  const denied = await request("/api/admin/runtime-logs", { query: { limit: "999" } });
  assert.equal(denied.statusCode, 401);
  assert.equal(readerCalls, 0);

  let receivedLimit;
  const allowedHarness = createHarness({
    loadRuntimeLogs: async ({ limit }) => {
      receivedLimit = limit;
      return { logs: [{ id: "log-1" }], limit: 200 };
    },
  });
  const allowed = await allowedHarness.request("/api/admin/runtime-logs", {
    query: { limit: "200" },
  });
  assert.equal(receivedLimit, "200");
  assert.deepEqual(allowed.body.data.logs, [{ id: "log-1" }]);
});

test("health route uses 503 for a completed unhealthy check", async () => {
  const health = { ok: false, label: "飞书连接异常" };
  const { request } = createHarness({
    buildHealthStatus: async () => health,
  });

  const response = await request("/api/health");

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, "HEALTH_UNHEALTHY");
  assert.deepEqual(response.body.data, { health });
});

test("health route uses 500 when the health service itself fails", async () => {
  const { request } = createHarness({
    buildHealthStatus: async () => {
      throw new Error("检测服务异常");
    },
  });

  const response = await request("/api/health");

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "HEALTH_CHECK_FAILED");
  assert.equal(response.body.error, "检测服务异常");
});
