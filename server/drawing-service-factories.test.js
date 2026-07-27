import assert from "node:assert/strict";
import test from "node:test";

import { drawingMaterialFields, drawingOrderField } from "./drawing-fields.js";
import { createDrawingOrderService } from "./drawing-order-service.js";

test("drawing services can replace Feishu dependencies without module mocking", async () => {
  const calls = [];
  const service = createDrawingOrderService({
    drawingTableKeys: () => ["board"],
    getBitableConfig: () => ({ key: "board", label: "胶板" }),
    getTenantAccessToken: async () => "test-token",
    getBitableFieldMap: async () =>
      new Map([
        [drawingMaterialFields[0], 1],
        [drawingOrderField, 7],
      ]),
    listBitableRecords: async (token, tableConfig, options) => {
      calls.push({ token, tableConfig, options });
      return [{
        record_id: "record-1",
        fields: {
          [drawingMaterialFields[0]]: "A-001",
          [drawingOrderField]: false,
        },
      }];
    },
    executeVerifiedUpdatePlans: async (token, plans) => ({
      applied: plans,
      failed: [],
      errors: [],
    }),
  });

  const result = await service.confirmDrawingOrders({
    materialCodes: ["A-001"],
    tableKey: "board",
  });

  assert.deepEqual(result.missing, []);
  assert.equal(result.result[0].changed, true);
  assert.equal(calls[0].token, "test-token");
  assert.equal(calls[0].tableConfig.key, "board");
  assert.ok(calls[0].options.fieldNames.includes(drawingOrderField));
});
