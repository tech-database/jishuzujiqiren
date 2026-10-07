import assert from "node:assert/strict";
import test from "node:test";
import {
  assertQuoteWriteCount,
  buildQuoteFileQueue,
  getUnreadQuoteFiles,
  mergeQuotePreviewRows,
} from "./useQuoteStatisticsController.js";

test("marks an existing preview as read and only the newly added file as pending", () => {
  const files = [
    { name: "already.xlsx", size: 10, lastModified: 1 },
    { name: "new.xlsx", size: 20, lastModified: 2 },
  ];
  const previewRows = [
    { key: "already.xlsx:10:1", status: "ready" },
  ];

  assert.deepEqual(
    buildQuoteFileQueue(files, previewRows).map(({ label, isRead }) => ({ label, isRead })),
    [
      { label: "已读取", isRead: true },
      { label: "待读取", isRead: false },
    ],
  );
  assert.deepEqual(
    getUnreadQuoteFiles(files, previewRows).map((file) => file.name),
    ["new.xlsx"],
  );
});

test("exposes a file preview error in the upload queue", () => {
  const files = [{ name: "empty.xlsx", size: 10, lastModified: 1 }];
  const previewRows = [{
    key: "empty.xlsx:10:1",
    status: "preview_error",
    error: "表格中没有可写入的数据行。",
  }];

  assert.deepEqual(
    buildQuoteFileQueue(files, previewRows).map(({ label, error }) => ({ label, error })),
    [{ label: "读取失败", error: "表格中没有可写入的数据行。" }],
  );
});

test("accepts only the expected quote or order write count", () => {
  assert.doesNotThrow(() => assertQuoteWriteCount({ count: 1 }));
  assert.doesNotThrow(() => assertQuoteWriteCount({ count: 3 }, 3));
  assert.throws(
    () => assertQuoteWriteCount({ count: 0 }),
    /应创建 1 条记录，实际创建 0 条/,
  );
  assert.throws(
    () => assertQuoteWriteCount({ count: 2 }, 3),
    /应创建 3 条记录，实际创建 2 条/,
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
