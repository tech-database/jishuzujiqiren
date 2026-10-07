import assert from "node:assert/strict";
import test from "node:test";
import { queryDrawingAnalytics } from "./drawing-statistics-service.js";

test("excludes unassigned records from personnel charts without reducing overall totals", async () => {
  const fieldNames = ["下单建料号", "绘图人", "分值", "用时", "区域", "业务"];
  const result = await queryDrawingAnalytics(
    {},
    {
      getBitableConfig: () => ({ key: "board", label: "胶板" }),
      getTenantAccessToken: async () => "token",
      getBitableFieldMap: async () => new Map(fieldNames.map((name) => [name, 1])),
      listCachedBitableRecords: async () => [
        {
          record_id: "assigned",
          fields: { 下单建料号: "J-001", 绘图人: "胡海龙", 分值: 10, 用时: 60 },
        },
        {
          record_id: "unassigned",
          fields: { 下单建料号: "J-002", 绘图人: "", 分值: 20, 用时: 120 },
        },
      ],
    },
  );

  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.totalScore, 30);
  assert.equal(result.summary.averageDuration, 90);
  assert.equal(result.summary.owners, 1);
  assert.deepEqual(result.owners, [
    {
      name: "胡海龙",
      count: 1,
      score: 10,
      scoredRecords: 1,
      averageDuration: 60,
      durationRecords: 1,
    },
  ]);
});
