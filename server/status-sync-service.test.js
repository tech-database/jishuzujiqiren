import assert from "node:assert/strict";
import test from "node:test";
import { createStatusSyncService } from "./status-sync-service.js";

function createService(serviceOverrides = {}) {
  let currentTime = Date.parse("2026-07-27T08:00:00.000Z");
  const service = createStatusSyncService({
    intervalMs: 10000,
    dailyFullHour: 2,
    now: () => {
      currentTime += 1000;
      return currentTime;
    },
    services: {
      getConfigStatus: () => ({
        ready: true,
        tables: { board: { ready: true }, paint: { ready: true } },
      }),
      getDrawingStatusFingerprint: async ({ tableKey }) => `${tableKey}-fingerprint`,
      syncDrawingStatuses: async () => ({
        summary: { updated: 0, unclaimed: 0, drawing: 0, done: 0 },
      }),
      recentShanghaiDateRange: () => ({
        startDate: "2026-07-21",
        endDate: "2026-07-27",
      }),
      ...serviceOverrides,
    },
  });
  return service;
}

test("status sync normalizes input and records per-table state", async () => {
  let receivedRange = null;
  const service = createService({
    syncDrawingStatuses: async (range) => {
      receivedRange = range;
      return {
        summary: { updated: 0, unclaimed: 1, drawing: 2, done: 3 },
      };
    },
  });

  const result = await service.runStatusSync("manual", {
    startDate: "2026-07-01",
    tableKey: "paint",
  });

  assert.deepEqual(receivedRange, {
    startDate: "2026-07-01",
    endDate: "",
    tableKey: "paint",
    fillMissingTimestamps: true,
  });
  assert.equal(result.summary.done, 3);
  assert.equal(service.statusSyncInfo.running, false);
  assert.equal(service.statusSyncInfo.tables.paint.running, false);
  assert.equal(service.statusSyncInfo.tables.paint.lastReason, "manual");
});

test("status sync rejects a second operation for the same table", async () => {
  let releaseFirst;
  const firstFinished = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const service = createService({
    syncDrawingStatuses: async () => {
      await firstFinished;
      return {
        summary: { updated: 0, unclaimed: 0, drawing: 0, done: 0 },
      };
    },
  });

  const first = service.runStatusSync("manual", { tableKey: "board" });
  await assert.rejects(
    service.runStatusSync("manual", { tableKey: "board" }),
    (error) => error.statusCode === 409 && /状态检测正在进行/.test(error.message),
  );
  releaseFirst();
  await first;
});

test("background sync establishes a baseline, skips unchanged data and syncs changes", async () => {
  const fingerprints = ["baseline", "baseline", "changed", "after-sync"];
  let syncCalls = 0;
  const service = createService({
    getConfigStatus: () => ({
      ready: true,
      tables: { board: { ready: true } },
    }),
    getDrawingStatusFingerprint: async () => fingerprints.shift(),
    syncDrawingStatuses: async () => {
      syncCalls += 1;
      return {
        summary: { updated: 1, unclaimed: 0, drawing: 1, done: 0 },
      };
    },
  });

  assert.equal(await service.runBackgroundStatusSync("first"), null);
  assert.equal(await service.runBackgroundStatusSync("second"), null);
  const changed = await service.runBackgroundStatusSync("third");

  assert.equal(syncCalls, 1);
  assert.equal(changed.length, 1);
  assert.equal(service.statusSyncInfo.skippedCount, 2);
  assert.equal(service.statusSyncInfo.tables.board.lastReason, "table-change:board");
});
