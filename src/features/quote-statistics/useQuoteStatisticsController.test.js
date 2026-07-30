import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSingleQuoteWrite,
  getUnreadQuoteFiles,
  mergeQuotePreviewRows,
} from "./useQuoteStatisticsController.js";

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

test("reads only new files and failed previews", () => {
  const files = [
    { name: "already.xlsx", size: 10, lastModified: 1 },
    { name: "failed.xlsx", size: 20, lastModified: 2 },
    { name: "new.xlsx", size: 30, lastModified: 3 },
  ];
  const previewRows = [
    { key: "already.xlsx:10:1", status: "ready" },
    { key: "failed.xlsx:20:2", status: "preview_error" },
  ];

  assert.deepEqual(
    getUnreadQuoteFiles(files, previewRows).map((file) => file.name),
    ["failed.xlsx", "new.xlsx"],
  );
});

test("appends new preview rows without removing existing results", () => {
  const existing = [
    { key: "already.xlsx:10:1", status: "ready", total: 100 },
    { key: "failed.xlsx:20:2", status: "preview_error" },
  ];
  const queued = [
    { key: "failed.xlsx:20:2", status: "pending" },
    { key: "new.xlsx:30:3", status: "pending" },
  ];

  assert.deepEqual(
    mergeQuotePreviewRows(existing, queued),
    [
      { key: "already.xlsx:10:1", status: "ready", total: 100 },
      { key: "failed.xlsx:20:2", status: "pending" },
      { key: "new.xlsx:30:3", status: "pending" },
    ],
  );
});
