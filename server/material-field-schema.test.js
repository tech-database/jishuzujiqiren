import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidateAllFeishuCaches,
  refreshDrawingOwnerRoster,
} from "./bot-core.js";

test("人员名单只查询真实存在的下单建料号字段", async () => {
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
            { field_name: "下单建料号", type: 1 },
            { field_name: "图号", type: 1 },
            { field_name: "绘图人", type: 1 },
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
              record_id: "record-1",
              fields: {
                下单建料号: "ORDER-MATERIAL-001",
                图号: "UNUSED-DRAWING-CODE",
                绘图人: "测试人员",
              },
            },
          ],
        },
      });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  try {
    const result = await refreshDrawingOwnerRoster({ tableKey: "board" });
    assert.equal(result.items[0].totalRecords, 1);
    assert.deepEqual(searches[0].field_names, ["绘图人", "下单建料号"]);
    assert.equal(searches[0].field_names.includes("图号"), false);
    assert.equal(searches[0].field_names.includes("下单建材料号"), false);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});
