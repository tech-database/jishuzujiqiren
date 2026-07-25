import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidateAllFeishuCaches,
  queryDrawingAnalytics,
  queryHomeDashboardTable,
  queryDrawingOwnerStats,
  queryUnclaimedDrawings,
  recalculateDrawingDurations,
  syncDrawingStatuses,
} from "./bot-core.js";

function installFeishuMock() {
  const originalFetch = globalThis.fetch;
  const writes = [];
  const searches = [];

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
            { field_name: "日期", type: 5 },
            { field_name: "领图具体时间", type: 5 },
            { field_name: "完成图具体时间", type: 5 },
            { field_name: "用时（分）", type: 2 },
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
          items: [
            {
              record_id: "blank-template",
              fields: { 分值: 0, 绘图人: "模板人员", 状态: "绘图中" },
            },
            { record_id: "real-task", fields: { 下单建料号: "TASK-001" } },
          ],
        },
      });
    }
    if (options.method === "PUT") {
      writes.push({
        url: requestUrl,
        body: JSON.parse(options.body),
      });
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  return {
    searches,
    writes,
    restore() {
      globalThis.fetch = originalFetch;
      invalidateAllFeishuCaches();
    },
  };
}

test("ignores blank template rows in every dashboard and status statistic", async () => {
  invalidateAllFeishuCaches();
  const mock = installFeishuMock();

  try {
    const unclaimed = await queryUnclaimedDrawings({ tableKey: "board" });
    assert.equal(unclaimed.count, 1);
    assert.equal(unclaimed.items[0].recordId, "real-task");

    const synced = await syncDrawingStatuses({ tableKey: "board" });
    assert.deepEqual(synced.summary, {
      total: 1,
      unclaimed: 1,
      drawing: 0,
      done: 0,
      updated: 1,
      skippedBlank: 1,
      missingClaimTime: 0,
      missingCompleteTime: 0,
      timestampsBackfilled: 0,
      fillMissingTimestamps: true,
    });
    assert.equal(synced.rosterRefreshed, true);
    assert.equal(mock.writes.length, 1);
    assert.match(mock.writes[0].url, /real-task/);
    assert.equal(mock.writes[0].body.fields["状态"], "未领取");

    const home = await queryHomeDashboardTable({ tableKey: "board" });
    assert.deepEqual(home.summary, {
      total: 1,
      unclaimed: 1,
      drawing: 0,
      done: 0,
    });

    const analytics = await queryDrawingAnalytics({ tableKey: "board" });
    assert.equal(analytics.summary.total, 1);
    assert.equal(analytics.owners.find((item) => item.name === "未分配")?.count, 1);
    assert.equal(analytics.owners.some((item) => item.name === "模板人员"), false);

    const ownerStats = await queryDrawingOwnerStats({ tableKey: "board" });
    assert.equal(ownerStats.items.some((item) => item.owner === "模板人员"), false);

    const durationResult = await recalculateDrawingDurations({ tableKey: "board" });
    assert.deepEqual(durationResult.summary, {
      scanned: 1,
      eligible: 0,
      updated: 0,
      missingTime: 1,
      invalidTime: 0,
      skippedBlank: 1,
    });
    assert.deepEqual(mock.searches.at(-1).field_names, [
      "\u65e5\u671f",
      "\u9886\u56fe\u5177\u4f53\u65f6\u95f4",
      "\u5b8c\u6210\u56fe\u5177\u4f53\u65f6\u95f4",
      "\u7528\u65f6\uff08\u5206\uff09",
      "\u4e0b\u5355\u5efa\u6599\u53f7",
    ]);
    assert.equal(
      mock.searches.some(
        (search) =>
          search.field_names?.length === 1 &&
          search.field_names[0] === "绘图人" &&
          !search.filter,
      ),
      false,
    );
  } finally {
    mock.restore();
  }
});
