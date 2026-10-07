import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessRegionMap,
  mapToBusinessRegionRows,
  normalizeBusinessRegionMap,
} from "./config.model.js";

test("normalizes and round-trips personnel region rows", () => {
  assert.deepEqual(normalizeBusinessRegionMap({ " 李艳 ": " 国际贸易 ", 空白: "" }), {
    李艳: "国际贸易",
  });
  assert.deepEqual(mapToBusinessRegionRows({ 李艳: "国际贸易" }), [
    { name: "李艳", region: "国际贸易" },
  ]);
  assert.deepEqual(buildBusinessRegionMap([
    { name: " 李艳 ", region: " 国际贸易 " },
    { name: "", region: "华南区" },
  ]), { 李艳: "国际贸易" });
});
