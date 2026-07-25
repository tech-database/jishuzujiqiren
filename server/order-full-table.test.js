import assert from "node:assert/strict";
import test from "node:test";
import { confirmDrawingOrders, invalidateAllFeishuCaches } from "./bot-core.js";

test("order confirmation continues through all pages instead of stopping at 500 records", async () => {
  const originalFetch = globalThis.fetch;
  let searchRequests = 0;
  const searchBodies = [];
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
            { field_name: "是否下单", type: 1 },
            { field_name: "附彩图", type: 17 },
            { field_name: "销售总价", type: 2 },
          ],
        },
      });
    }
    if (requestUrl.includes("/records/search?")) {
      searchRequests += 1;
      searchBodies.push(JSON.parse(options.body || "{}"));
      const isSecondPage = requestUrl.includes("page_token=next-page");
      return Response.json({
        code: 0,
        data: isSecondPage
          ? {
              has_more: false,
              items: [
                {
                  record_id: "target-on-second-page",
                  fields: { 下单建料号: "ORDER-001", 是否下单: "" },
                },
              ],
            }
          : {
              has_more: true,
              page_token: "next-page",
              items: [
                {
                  record_id: "other-on-first-page",
                  fields: { 下单建料号: "OTHER-001", 是否下单: "" },
                },
              ],
            },
      });
    }
    if (options.method === "PUT") {
      updates.push(requestUrl);
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    const { result, missing } = await confirmDrawingOrders({
      materialCodes: ["ORDER-001"],
      tableKey: "board",
    });

    assert.equal(searchRequests, 2);
    assert.deepEqual(
      searchBodies.map((body) => body.field_names),
      [
        ["下单建料号", "是否下单"],
        ["下单建料号", "是否下单"],
      ],
    );
    assert.equal(updates.length, 1);
    assert.match(updates[0], /target-on-second-page/);
    assert.equal(result.length, 1);
    assert.deepEqual(missing, []);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});

test("order confirmation rejects duplicate material codes across pages before writing", async () => {
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
            { field_name: "是否下单", type: 1 },
          ],
        },
      });
    }
    if (requestUrl.includes("/records/search?")) {
      const isSecondPage = requestUrl.includes("page_token=next-page");
      return Response.json({
        code: 0,
        data: isSecondPage
          ? {
              has_more: false,
              items: [{
                record_id: "duplicate-second-page",
                fields: { 下单建料号: "ORDER-DUP", 是否下单: "" },
              }],
            }
          : {
              has_more: true,
              page_token: "next-page",
              items: [{
                record_id: "duplicate-first-page",
                fields: { 下单建料号: "ORDER-DUP", 是否下单: "" },
              }],
            },
      });
    }
    if (options.method === "PUT") {
      updates.push(requestUrl);
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    await assert.rejects(
      confirmDrawingOrders({
        materialCodes: ["ORDER-DUP"],
        tableKey: "board",
      }),
      /下单确认发现重复料号：ORDER-DUP\(2条\).*本次未修改任何记录/,
    );
    assert.equal(updates.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});
