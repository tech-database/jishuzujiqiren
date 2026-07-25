import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidateAllFeishuCaches,
  syncDrawingStatuses,
} from "./bot-core.js";

test("historical full scan reports missing timestamps without backfilling them", async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  invalidateAllFeishuCaches();

  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/tenant_access_token/internal")) {
      return Response.json({
        code: 0,
        tenant_access_token: "test-token",
        expire: 7200,
      });
    }
    if (requestUrl.includes("/fields?")) {
      return Response.json({
        code: 0,
        data: {
          items: [
            { field_name: "下单建料号", type: 1 },
            { field_name: "绘图人", type: 1 },
            { field_name: "状态", type: 1 },
            { field_name: "领图具体时间", type: 5 },
            { field_name: "完成图具体时间", type: 5 },
            { field_name: "用时（分）", type: 2 },
          ],
        },
      });
    }
    if (requestUrl.includes("/records/search?")) {
      return Response.json({
        code: 0,
        data: {
          has_more: false,
          items: [{
            record_id: "historical-done",
            fields: {
              下单建料号: "HIST-001",
              绘图人: "测试人员",
              状态: "绘图完成",
              领图具体时间: Date.parse("2026-07-01T01:00:00.000Z"),
            },
          }],
        },
      });
    }
    if (options.method === "PUT") {
      writes.push(JSON.parse(options.body || "{}"));
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    const result = await syncDrawingStatuses({
      tableKey: "board",
      fillMissingTimestamps: false,
    });

    assert.equal(result.summary.done, 1);
    assert.equal(result.summary.missingClaimTime, 0);
    assert.equal(result.summary.missingCompleteTime, 1);
    assert.equal(result.summary.timestampsBackfilled, 0);
    assert.equal(result.summary.fillMissingTimestamps, false);
    assert.equal(result.summary.updated, 0);
    assert.equal(Object.hasOwn(result, "items"), false);
    assert.deepEqual(writes, []);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});
