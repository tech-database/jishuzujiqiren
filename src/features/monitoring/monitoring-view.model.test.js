import assert from "node:assert/strict";
import test from "node:test";
import { buildMonitoringViewModel } from "./monitoring-view.model.js";

const formatDisplayTime = (value) => `formatted:${value}`;

test("reports healthy monitoring only after health and background checks succeed", () => {
  const view = buildMonitoringViewModel({
    backgroundSyncStatus: {
      intervalMs: 3000,
      lastCheckedAt: "2026-07-27T08:00:00.000Z",
    },
    configReady: true,
    formatDisplayTime,
    healthLoading: false,
    healthStatus: { ok: true, checks: {} },
    statusResult: null,
    statusState: null,
    targetTable: "paint",
  });

  assert.equal(view.healthTone, "online");
  assert.equal(view.healthLabel, "运行正常");
  assert.equal(view.selectedTableLabel, "油漆表");
  assert.equal(view.intervalLabel, "3 秒自动检查");
  assert.equal(view.lastCheckedLabel, "formatted:2026-07-27T08:00:00.000Z");
});

test("surfaces failed health check messages", () => {
  const view = buildMonitoringViewModel({
    backgroundSyncStatus: null,
    configReady: true,
    formatDisplayTime,
    healthLoading: false,
    healthStatus: {
      ok: false,
      checks: {
        feishu: { ok: false, message: "飞书凭证失效" },
        table: { ok: false, message: "数据表不可访问" },
      },
    },
    statusResult: null,
    statusState: null,
    targetTable: "board",
  });

  assert.equal(view.hasMonitoringIssue, true);
  assert.equal(view.healthTone, "error");
  assert.equal(view.healthErrorText, "飞书凭证失效；数据表不可访问");
});

test("counts historical missing claim and completion timestamps", () => {
  const view = buildMonitoringViewModel({
    backgroundSyncStatus: {
      dailyFull: {
        summaries: {
          board: { missingClaimTime: 2, missingCompleteTime: 1 },
          paint: { missingClaimTime: 3, missingCompleteTime: 4 },
        },
      },
    },
    configReady: true,
    formatDisplayTime,
    healthLoading: false,
    healthStatus: { ok: true },
    statusResult: null,
    statusState: null,
    targetTable: "board",
  });

  assert.equal(view.historicalTimestampAnomalies, 10);
  assert.equal(view.hasMonitoringIssue, true);
});
