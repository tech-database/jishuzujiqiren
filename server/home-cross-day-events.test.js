import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidateAllFeishuCaches,
  queryHomeDashboardTable,
} from "./bot-core.js";

const fields = {
  date: "\u65e5\u671f",
  owner: "\u7ed8\u56fe\u4eba",
  status: "\u72b6\u6001",
  claimTime: "\u9886\u56fe\u5177\u4f53\u65f6\u95f4",
  completeTime: "\u5b8c\u6210\u56fe\u5177\u4f53\u65f6\u95f4",
  material: "\u4e0b\u5355\u5efa\u6599\u53f7",
};

test("home realtime events include today's completion for a previous-day task", async () => {
  const originalFetch = globalThis.fetch;
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
            { field_name: fields.date, type: 5 },
            { field_name: fields.owner, type: 1 },
            { field_name: fields.status, type: 1 },
            { field_name: fields.claimTime, type: 5 },
            { field_name: fields.completeTime, type: 5 },
            { field_name: fields.material, type: 1 },
          ],
        },
      });
    }
    if (requestUrl.includes("/records/search?")) {
      const body = JSON.parse(options.body || "{}");
      const items = body.sort
        ? [{
            record_id: "cross-day-task",
            fields: {
              [fields.date]: Date.parse("2026-07-24T00:00:00+08:00"),
              [fields.owner]: "\u6d4b\u8bd5\u4eba\u5458",
              [fields.status]: "\u5df2\u5b8c\u6210",
              [fields.claimTime]: Date.parse("2026-07-24T09:00:00+08:00"),
              [fields.completeTime]: Date.parse("2026-07-25T10:00:00+08:00"),
              [fields.material]: "TASK-YESTERDAY",
            },
          }]
        : [{
            record_id: "today-task",
            fields: {
              [fields.date]: Date.parse("2026-07-25T00:00:00+08:00"),
              [fields.status]: "\u672a\u9886\u53d6",
              [fields.material]: "TASK-TODAY",
            },
          }];
      return Response.json({
        code: 0,
        data: { has_more: false, items },
      });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    const result = await queryHomeDashboardTable({
      startDate: "2026-07-25",
      endDate: "2026-07-25",
      tableKey: "board",
    });

    assert.equal(result.summary.total, 1);
    assert.equal(result.summary.unclaimed, 1);
    assert.equal(
      result.events.some((event) =>
        event.id.includes("cross-day-task:complete")),
      true,
    );
    assert.equal(
      result.events.some((event) =>
        event.id.includes("cross-day-task:claim")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});
