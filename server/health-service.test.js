import assert from "node:assert/strict";
import test from "node:test";
import { createHealthService } from "./health-service.js";

const fixedNow = Date.parse("2026-07-27T08:00:00.000Z");

function healthyServices(overrides = {}) {
  return {
    getConfigStatus: () => ({ ready: true }),
    getTenantAccessToken: async () => "tenant-token",
    getBitableConfig: (tableKey) => ({
      key: tableKey,
      label: tableKey === "paint"
        ? "油漆"
        : tableKey === "quote"
          ? "报价统计"
          : "胶板",
    }),
    getBitableFieldMap: async () => new Map([["料号", {}], ["状态", {}]]),
    readFile: async () =>
      JSON.stringify({
        connected: true,
        updatedAt: new Date(fixedNow - 1000).toISOString(),
      }),
    isLongConnectionServerHosted: () => false,
    ...overrides,
  };
}

test("health service combines config, Feishu, table and websocket checks", async () => {
  const requestedTables = [];
  const { buildHealthStatus } = createHealthService({
    websocketStatusPath: "unused-status.json",
    now: () => fixedNow,
    services: healthyServices({
      getBitableFieldMap: async (_token, tableConfig) => {
        requestedTables.push(tableConfig.key);
        return new Map([["料号", {}], ["状态", {}]]);
      },
    }),
  });

  const health = await buildHealthStatus();

  assert.equal(health.ok, true);
  assert.equal(health.label, "飞书连接正常");
  assert.equal(health.checkedAt, "2026-07-27T08:00:00.000Z");
  assert.deepEqual(requestedTables, ["board", "paint", "quote"]);
  assert.equal(health.checks.board.message, "胶板表正常，2 个字段");
  assert.equal(health.checks.paint.message, "油漆表正常，2 个字段");
  assert.equal(health.checks.quote.message, "报价统计表正常，2 个字段");
  assert.equal(health.checks.websocket.ok, true);
});

test("health service keeps independent failures visible", async () => {
  const { buildHealthStatus } = createHealthService({
    websocketStatusPath: "unused-status.json",
    now: () => fixedNow,
    services: healthyServices({
      getBitableFieldMap: async (_token, tableConfig) => {
        if (tableConfig.key === "paint") throw new Error("油漆表不可访问");
        return new Map([["料号", {}]]);
      },
      readFile: async () =>
        JSON.stringify({
          connected: true,
          updatedAt: new Date(fixedNow - 46000).toISOString(),
        }),
    }),
  });

  const health = await buildHealthStatus();

  assert.equal(health.ok, false);
  assert.equal(health.label, "飞书连接异常");
  assert.deepEqual(health.checks.paint, { ok: false, message: "油漆表不可访问" });
  assert.deepEqual(health.checks.websocket, { ok: false, message: "飞书长连接心跳超时" });
  assert.equal(health.checks.board.ok, true);
  assert.equal(health.checks.quote.ok, true);
});

test("health service reports an inaccessible quote table", async () => {
  const { buildHealthStatus } = createHealthService({
    websocketStatusPath: "unused-status.json",
    now: () => fixedNow,
    services: healthyServices({
      getBitableFieldMap: async (_token, tableConfig) => {
        if (tableConfig.key === "quote") throw new Error("报价统计表不可访问");
        return new Map([["料号", {}]]);
      },
    }),
  });

  const health = await buildHealthStatus();

  assert.equal(health.ok, false);
  assert.deepEqual(health.checks.quote, {
    ok: false,
    message: "报价统计表不可访问",
  });
  assert.equal(health.checks.board.ok, true);
  assert.equal(health.checks.paint.ok, true);
});

test("server-hosted long connection does not require a heartbeat file", async () => {
  let readCalls = 0;
  const { readWebsocketHealth } = createHealthService({
    websocketStatusPath: "unused-status.json",
    services: healthyServices({
      isLongConnectionServerHosted: () => true,
      readFile: async () => {
        readCalls += 1;
        throw new Error("should not read");
      },
    }),
  });

  assert.deepEqual(await readWebsocketHealth(), {
    ok: true,
    message: "飞书长连接由服务器托管",
  });
  assert.equal(readCalls, 0);
});
