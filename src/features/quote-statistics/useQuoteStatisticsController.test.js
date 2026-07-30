import assert from "node:assert/strict";
import test from "node:test";
import { assertSingleQuoteWrite } from "./useQuoteStatisticsController.js";

test("accepts only an explicit one-record quote write result", () => {
  assert.doesNotThrow(() => assertSingleQuoteWrite({ count: 1 }));
  assert.throws(
    () => assertSingleQuoteWrite({ count: 0 }),
    /应创建 1 条记录，实际创建 0 条/,
  );
  assert.throws(
    () => assertSingleQuoteWrite({ count: 2 }),
    /应创建 1 条记录，实际创建 2 条/,
  );
});
