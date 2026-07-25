import assert from "node:assert/strict";
import test from "node:test";
import { completeDrawings, invalidateAllFeishuCaches } from "./bot-core.js";

test("does not overwrite an already completed drawing and updates an unfinished one", async () => {
  const originalFetch = globalThis.fetch;
  const updates = [];
  let searchRequests = 0;
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
            { field_name: "完成图具体时间", type: 5 },
          ],
        },
      });
    }
    if (requestUrl.includes("/records/search?")) {
      searchRequests += 1;
      return Response.json({
        code: 0,
        data: {
          has_more: true,
          page_token: "ignored-next-page",
          items: [
            {
              record_id: "record-done",
              fields: {
                下单建料号: "DONE-001",
                绘图人: "测试人员",
                状态: "绘图完成",
                日期: 1577836800000,
                完成图具体时间: 1700000000000,
              },
            },
            {
              record_id: "record-open",
              fields: {
                下单建料号: "OPEN-001",
                绘图人: "测试人员",
                状态: "绘图中",
                日期: 1577836800000,
              },
            },
          ],
        },
      });
    }
    if (options.method === "PUT") {
      updates.push({
        url: requestUrl,
        body: JSON.parse(options.body),
      });
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    const result = await completeDrawings({
      materialCodes: ["DONE-001", "OPEN-001"],
      tableKey: "board",
      senderName: "测试人员",
      startDate: "2026-07-24",
      endDate: "2026-07-24",
    });

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map(({ materialCode, changed, alreadyCompleted }) => ({
        materialCode,
        changed,
        alreadyCompleted,
      })),
      [
        { materialCode: "DONE-001", changed: false, alreadyCompleted: true },
        { materialCode: "OPEN-001", changed: true, alreadyCompleted: false },
      ],
    );
    assert.equal(updates.length, 1);
    assert.equal(searchRequests, 1);
    assert.match(updates[0].url, /record-open/);
    assert.equal(updates[0].body.fields["状态"], "绘图完成");
    assert.equal(typeof updates[0].body.fields["完成图具体时间"], "number");
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});

test("requires a claim and the matching owner unless an administrator overrides", async () => {
  const originalFetch = globalThis.fetch;
  const updates = [];
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
            { field_name: "完成图具体时间", type: 5 },
          ],
        },
      });
    }
    if (requestUrl.includes("/records/search?")) {
      return Response.json({
        code: 0,
        data: {
          has_more: false,
          items: [
            {
              record_id: "record-unclaimed",
              fields: { 下单建料号: "UNCLAIMED-001", 状态: "未领取" },
            },
            {
              record_id: "record-other-owner",
              fields: { 下单建料号: "OTHER-001", 绘图人: "张三", 状态: "绘图中" },
            },
            {
              record_id: "record-completed",
              fields: {
                下单建料号: "DONE-001",
                绘图人: "张三",
                状态: "绘图完成",
                完成图具体时间: 1700000000000,
              },
            },
            {
              record_id: "record-duplicate-1",
              fields: { 下单建料号: "DUP-001", 绘图人: "李四", 状态: "绘图中" },
            },
            {
              record_id: "record-duplicate-2",
              fields: { 下单建料号: "DUP-001", 绘图人: "李四", 状态: "绘图中" },
            },
          ],
        },
      });
    }
    if (options.method === "PUT") {
      updates.push({
        url: requestUrl,
        body: JSON.parse(options.body),
      });
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    await assert.rejects(
      completeDrawings({
        materialCodes: ["DUP-001"],
        tableKey: "board",
        senderName: "李四",
      }),
      /图纸完成发现重复料号：DUP-001\(2条\).*本次未修改任何记录/,
    );
    await assert.rejects(
      completeDrawings({
        materialCodes: ["UNCLAIMED-001"],
        tableKey: "board",
        senderName: "李四",
      }),
      /尚未领图，请先领图/,
    );
    await assert.rejects(
      completeDrawings({
        materialCodes: ["OTHER-001"],
        tableKey: "board",
        senderName: "李四",
      }),
      /由张三领取，只有领取人本人可以完成/,
    );
    assert.equal(updates.length, 0);

    const overridden = await completeDrawings({
      materialCodes: ["OTHER-001"],
      tableKey: "board",
      allowOwnerOverride: true,
    });
    assert.equal(overridden[0].changed, true);
    assert.equal(overridden[0].adminOverride, true);
    assert.equal(updates.length, 1);

    const completed = await completeDrawings({
      materialCodes: ["DONE-001"],
      tableKey: "board",
      senderName: "李四",
    });
    assert.equal(completed[0].changed, false);
    assert.equal(completed[0].alreadyCompleted, true);
    assert.equal(updates.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});
