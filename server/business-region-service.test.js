import assert from "node:assert/strict";
import test from "node:test";
import { applyBusinessRegion, resolveBusinessRegion } from "./business-region-service.js";

test("personnel region mapping overrides the region stored in a record", () => {
  const fields = { 业务: "李艳", 区域: "华南区", 总价: 100 };
  assert.equal(resolveBusinessRegion(fields), "国际贸易");
  assert.deepEqual(applyBusinessRegion(fields), {
    业务: "李艳",
    区域: "国际贸易",
    总价: 100,
  });
});

test("unmapped personnel never fall back to the region stored in the uploaded record", () => {
  const fields = { 业务: "未登记人员", 区域: "待核实" };
  assert.equal(resolveBusinessRegion(fields, "未匹配"), "未匹配");
  assert.throws(() => applyBusinessRegion(fields), /人员区域中未找到业务“未登记人员”/);
});
