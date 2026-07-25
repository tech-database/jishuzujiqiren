import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLogEntries } from "../src/utils/monitoringDataTransform.js";

test("monitoring logs expose the real failed health check", () => {
  const logs = normalizeLogEntries({
    backgroundSyncStatus: { lastCheckedAt: "2026-07-25T00:00:00.000Z" },
    healthStatus: {
      ok: false,
      label: "\u98de\u4e66\u8fde\u63a5\u5f02\u5e38",
      checks: {
        websocket: {
          ok: false,
          message: "\u98de\u4e66\u957f\u8fde\u63a5\u6b63\u5728\u91cd\u8fde",
        },
      },
    },
    formatDisplayTime: () => "2026/7/25 08:00:00",
  });

  assert.equal(logs[0].id, "health-error");
  assert.equal(logs[0].level, "error");
  assert.match(logs[0].message, /\u98de\u4e66\u957f\u8fde\u63a5\u6b63\u5728\u91cd\u8fde/);
});
