import assert from "node:assert/strict";
import test from "node:test";
import { completeDrawings, invalidateAllFeishuCaches } from "./bot-core.js";

function drawingFields() {
  return [
    { field_name: "下单建料号", type: 1 },
    { field_name: "绘图人", type: 1 },
    { field_name: "状态", type: 1 },
    { field_name: "完成图具体时间", type: 5 },
  ];
}

function openRecords() {
  return [
    {
      record_id: "record-a",
      fields: { 下单建料号: "BATCH-A", 绘图人: "测试人员", 状态: "绘图中" },
    },
    {
      record_id: "record-b",
      fields: { 下单建料号: "BATCH-B", 绘图人: "测试人员", 状态: "绘图中" },
    },
  ];
}

test("updates multiple drawings in one table with one batch request", async () => {
  const originalFetch = globalThis.fetch;
  const batches = [];
  invalidateAllFeishuCaches();

  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "test-token", expire: 7200 });
    }
    if (requestUrl.includes("/fields?")) {
      return Response.json({ code: 0, data: { items: drawingFields() } });
    }
    if (requestUrl.includes("/records/search?")) {
      return Response.json({ code: 0, data: { has_more: false, items: openRecords() } });
    }
    if (requestUrl.includes("/records/batch_update") && options.method === "POST") {
      batches.push(JSON.parse(options.body || "{}"));
      return Response.json({ code: 0, data: { records: [] } });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    const result = await completeDrawings({
      materialCodes: ["BATCH-A", "BATCH-B"],
      tableKey: "board",
      senderName: "测试人员",
    });

    assert.equal(result.length, 2);
    assert.equal(batches.length, 1);
    assert.deepEqual(
      batches[0].records.map((record) => record.record_id),
      ["record-a", "record-b"],
    );
    assert.equal(batches[0].records.every((record) => record.fields["状态"] === "绘图完成"), true);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});

test("rechecks records after a failed batch and reports the actual partial result", async () => {
  const originalFetch = globalThis.fetch;
  const verifiedRecordIds = [];
  invalidateAllFeishuCaches();

  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "test-token", expire: 7200 });
    }
    if (requestUrl.includes("/fields?")) {
      return Response.json({ code: 0, data: { items: drawingFields() } });
    }
    if (requestUrl.includes("/records/search?")) {
      return Response.json({ code: 0, data: { has_more: false, items: openRecords() } });
    }
    if (requestUrl.includes("/records/batch_update") && options.method === "POST") {
      return Response.json({ code: 1255001, msg: "simulated timeout" });
    }
    const recordMatch = requestUrl.match(/\/records\/(record-[ab])$/);
    if (recordMatch && !options.method) {
      const recordId = recordMatch[1];
      verifiedRecordIds.push(recordId);
      return Response.json({
        code: 0,
        data: {
          record: {
            record_id: recordId,
            fields: {
              下单建料号: recordId === "record-a" ? "BATCH-A" : "BATCH-B",
              绘图人: "测试人员",
              状态: recordId === "record-a" ? "绘图完成" : "绘图中",
            },
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    await assert.rejects(
      completeDrawings({
        materialCodes: ["BATCH-A", "BATCH-B"],
        tableKey: "board",
        senderName: "测试人员",
      }),
      /图纸完成部分执行，已成功：BATCH-A；未成功：BATCH-B/,
    );
    assert.deepEqual(verifiedRecordIds.sort(), ["record-a", "record-b"]);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});
