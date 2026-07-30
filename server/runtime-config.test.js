import assert from "node:assert/strict";
import test from "node:test";
import { drawingTableKeys, resolveTableKey } from "./runtime-config.js";

test("quote table resolution stays separate from drawing table fan-out", () => {
  assert.equal(resolveTableKey("quote"), "quote");
  assert.equal(resolveTableKey("报价统计"), "quote");
  assert.deepEqual(drawingTableKeys(), ["board", "paint"]);
  assert.deepEqual(drawingTableKeys("quote"), []);
});
