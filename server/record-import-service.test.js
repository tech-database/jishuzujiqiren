import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRequiredBitableFields,
  createBitableWriteError,
} from "./record-import-service.js";

test("turns Feishu 91403 into an actionable document permission error", () => {
  const error = createBitableWriteError(
    { status: 403 },
    { code: 91403, msg: "Forbidden" },
  );

  assert.equal(error.code, "BITABLE_WRITE_FORBIDDEN");
  assert.equal(error.statusCode, 403);
  assert.match(error.message, /添加为可编辑的文档应用/);
  assert.deepEqual(error.details, { feishuCode: 91403 });
});

test("keeps a generic message for non-permission write failures", () => {
  const error = createBitableWriteError(
    { status: 500 },
    { code: 99999 },
    { batch: true },
  );

  assert.match(error.message, /批量写入飞书多维表记录失败/);
  assert.deepEqual(error.details, { feishuCode: 99999 });
});

test("rejects a target table that is missing required fields", () => {
  assert.throws(
    () => assertRequiredBitableFields(
      new Map([
        ["报价日期", 1],
        ["报价员", 1],
        ["总价", 2],
      ]),
      ["报价日期", "报价员", "区域", "总价"],
      { tableLabel: "报价统计" },
    ),
    (error) => {
      assert.equal(error.code, "BITABLE_SCHEMA_MISMATCH");
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.details.missingFields, ["区域"]);
      return true;
    },
  );
});

test("rejects required fields that exist but cannot be converted for writing", () => {
  assert.throws(
    () => assertRequiredBitableFields(
      new Map([
        ["报价员", 11],
        ["总价", 2],
      ]),
      ["报价员", "总价"],
      {
        tableLabel: "报价统计",
        convertedRecord: { 总价: 300 },
      },
    ),
    (error) => {
      assert.equal(error.code, "BITABLE_SCHEMA_MISMATCH");
      assert.deepEqual(error.details.unwritableFields, ["报价员"]);
      return true;
    },
  );
});
