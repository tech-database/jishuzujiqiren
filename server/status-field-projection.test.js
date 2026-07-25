import assert from "node:assert/strict";
import test from "node:test";
import {
  getDrawingStatusFingerprint,
  invalidateAllFeishuCaches,
  syncDrawingStatuses,
} from "./bot-core.js";

test("status detection reads only fields that can affect drawing status", async () => {
  const originalFetch = globalThis.fetch;
  const searches = [];
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
            { field_name: "日期", type: 5 },
            { field_name: "绘图人", type: 1 },
            { field_name: "状态", type: 1 },
            { field_name: "领图具体时间", type: 1 },
            { field_name: "完成图具体时间", type: 1 },
            { field_name: "用时（分）", type: 2 },
            { field_name: "料号", type: 1 },
            { field_name: "附彩图", type: 17 },
            { field_name: "销售总价", type: 2 },
            { field_name: "注意事项/材质说明", type: 1 },
          ],
        },
      });
    }
    if (requestUrl.includes("/records/search?")) {
      searches.push(JSON.parse(options.body || "{}"));
      return Response.json({
        code: 0,
        data: {
          has_more: false,
          items: [{
            record_id: "record-1",
            fields: {
              日期: Date.parse("2026-07-24T00:00:00.000Z"),
              料号: "TASK-001",
              状态: "未领取",
            },
          }],
        },
      });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    const range = {
      startDate: "2026-07-24",
      endDate: "2026-07-24",
      tableKey: "board",
    };
    await getDrawingStatusFingerprint(range);
    await syncDrawingStatuses(range);

    assert.equal(searches.length, 2);
    for (const search of searches) {
      assert.deepEqual(search.field_names, [
        "日期",
        "绘图人",
        "状态",
        "领图具体时间",
        "完成图具体时间",
        "用时（分）",
        "料号",
      ]);
      assert.equal(search.field_names.includes("附彩图"), false);
      assert.equal(search.field_names.includes("销售总价"), false);
      assert.equal(search.field_names.includes("注意事项/材质说明"), false);
    }
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});
