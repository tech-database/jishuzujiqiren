import assert from "node:assert/strict";
import test from "node:test";
import { createMonitoringRoutes } from "./monitoring-routes.js";

function createHarness(options = {}) {
  const routes = new Map();
  const app = {
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    },
  };
  const statusSyncInfo = { running: false, lastError: "" };
  createMonitoringRoutes({
    buildHealthStatus: options.buildHealthStatus || (async () => ({ ok: true })),
    getConfigStatus: () => ({ ready: true }),
    statusSyncInfo,
  }).registerRoutes(app);

  async function request(path) {
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
    await routes.get(`GET ${path}`)({}, response);
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
