import assert from "node:assert/strict";
import test from "node:test";
import { createDrawingOrderService } from "./drawing-order-service.js";

test("all-table order synchronization can report every missing code without stopping", async () => {
  let updateCalls = 0;
  const service = createDrawingOrderService({
    drawingTableKeys: () => ["board", "paint"],
    getBitableConfig: (key) => ({ key, label: key === "board" ? "胶板" : "油漆" }),
    getTenantAccessToken: async () => "token",
    getBitableFieldMap: async () => new Map([
      ["下单建料号", 1],
      ["是否下单", 1],
    ]),
    listBitableRecords: async (_token, tableConfig) => tableConfig.key === "board"
      ? [{ record_id: "board-1", fields: { 下单建料号: "FOUND-001", 是否下单: "" } }]
      : [],
    executeVerifiedUpdatePlans: async () => {
      updateCalls += 1;
      return { applied: [], failed: [] };
    },
  });

  const result = await service.confirmDrawingOrders({
    materialCodes: ["MISSING-001"],
    allowMissing: true,
  });
  assert.deepEqual(result, { result: [], missing: ["MISSING-001"] });
  assert.equal(updateCalls, 0);
});

test("a duplicated material code is skipped when any matching record was already confirmed", async () => {
  let receivedPlans;
  const service = createDrawingOrderService({
    drawingTableKeys: () => ["board", "paint"],
    getBitableConfig: (key) => ({ key, label: key === "board" ? "胶板" : "油漆" }),
    getTenantAccessToken: async () => "token",
    getBitableFieldMap: async () => new Map([
      ["下单建料号", 1],
      ["是否下单", 1],
    ]),
    listBitableRecords: async (_token, tableConfig) => tableConfig.key === "board"
      ? [{ record_id: "board-confirmed", fields: { 下单建料号: "ORDER-DUP", 是否下单: "是" } }]
      : [{ record_id: "paint-unconfirmed", fields: { 下单建料号: "ORDER-DUP", 是否下单: "" } }],
    executeVerifiedUpdatePlans: async (_token, plans) => {
      receivedPlans = plans;
      return { applied: [], failed: [] };
    },
  });

  const result = await service.confirmDrawingOrders({ materialCodes: ["ORDER-DUP"] });

  assert.deepEqual(receivedPlans, []);
  assert.deepEqual(result.missing, []);
  assert.equal(result.result.length, 2);
  assert.ok(result.result.every((item) => item.changed === false));
  assert.ok(result.result.every((item) => item.skipped === "already_confirmed"));
});
