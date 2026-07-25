import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidateAllFeishuCaches,
  recalculateDrawingDurations,
  syncDrawingStatuses,
} from "./bot-core.js";

const fieldNames = {
  material: "\u4e0b\u5355\u5efa\u6599\u53f7",
  owner: "\u7ed8\u56fe\u4eba",
  status: "\u72b6\u6001",
  date: "\u65e5\u671f",
  claimTime: "\u9886\u56fe\u5177\u4f53\u65f6\u95f4",
  completeTime: "\u5b8c\u6210\u56fe\u5177\u4f53\u65f6\u95f4",
  duration: "\u7528\u65f6\uff08\u5206\uff09",
};

function fieldDefinitions() {
  return [
    { field_name: fieldNames.material, type: 1 },
    { field_name: fieldNames.owner, type: 1 },
    { field_name: fieldNames.status, type: 1 },
    { field_name: fieldNames.date, type: 5 },
    { field_name: fieldNames.claimTime, type: 5 },
    { field_name: fieldNames.completeTime, type: 5 },
    { field_name: fieldNames.duration, type: 2 },
  ];
}

function installUpdateMock(records) {
  const originalFetch = globalThis.fetch;
  const batches = [];
  const singleUpdates = [];
  invalidateAllFeishuCaches();

  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/tenant_access_token/internal")) {
      return Response.json({
        code: 0,
        tenant_access_token: "test-token",
        expire: 7200,
      });
    }
    if (requestUrl.includes("/fields?")) {
      return Response.json({ code: 0, data: { items: fieldDefinitions() } });
    }
    if (requestUrl.includes("/records/search?")) {
      return Response.json({
        code: 0,
        data: { has_more: false, items: records },
      });
    }
    if (requestUrl.includes("/records/batch_update") && options.method === "POST") {
      batches.push(JSON.parse(options.body || "{}"));
      return Response.json({ code: 0, data: { records: [] } });
    }
    if (/\/records\/[^/]+$/.test(requestUrl) && options.method === "PUT") {
      singleUpdates.push(JSON.parse(options.body || "{}"));
      return Response.json({ code: 0, data: { record: {} } });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  return {
    batches,
    singleUpdates,
    restore() {
      globalThis.fetch = originalFetch;
      invalidateAllFeishuCaches();
    },
  };
}

test("status detection updates multiple records in one batch", async () => {
  const mock = installUpdateMock([
    {
      record_id: "status-a",
      fields: { [fieldNames.material]: "STATUS-A", [fieldNames.status]: "" },
    },
    {
      record_id: "status-b",
      fields: { [fieldNames.material]: "STATUS-B", [fieldNames.status]: "" },
    },
  ]);

  try {
    const result = await syncDrawingStatuses({ tableKey: "board" });
    assert.equal(result.summary.updated, 2);
    assert.equal(mock.batches.length, 1);
    assert.deepEqual(
      mock.batches[0].records.map((record) => record.record_id),
      ["status-a", "status-b"],
    );
  } finally {
    mock.restore();
  }
});

test("status detection keeps every batch within the 500-record limit", async () => {
  const records = Array.from({ length: 501 }, (_, index) => ({
    record_id: `status-${index + 1}`,
    fields: {
      [fieldNames.material]: `STATUS-${index + 1}`,
      [fieldNames.status]: "",
    },
  }));
  const mock = installUpdateMock(records);

  try {
    const result = await syncDrawingStatuses({ tableKey: "board" });
    assert.equal(result.summary.updated, 501);
    assert.equal(mock.batches.length, 1);
    assert.equal(mock.batches[0].records.length, 500);
    assert.equal(mock.singleUpdates.length, 1);
  } finally {
    mock.restore();
  }
});

test("duration recalculation updates multiple records in one batch", async () => {
  const claimTime = Date.parse("2026-07-25T08:00:00+08:00");
  const mock = installUpdateMock([
    {
      record_id: "duration-a",
      fields: {
        [fieldNames.material]: "DURATION-A",
        [fieldNames.claimTime]: claimTime,
        [fieldNames.completeTime]: claimTime + 60 * 60 * 1000,
        [fieldNames.duration]: 0,
      },
    },
    {
      record_id: "duration-b",
      fields: {
        [fieldNames.material]: "DURATION-B",
        [fieldNames.claimTime]: claimTime,
        [fieldNames.completeTime]: claimTime + 2 * 60 * 60 * 1000,
        [fieldNames.duration]: 0,
      },
    },
  ]);

  try {
    const result = await recalculateDrawingDurations({ tableKey: "board" });
    assert.equal(result.summary.updated, 2);
    assert.equal(mock.batches.length, 1);
    assert.deepEqual(
      mock.batches[0].records.map((record) => record.record_id),
      ["duration-a", "duration-b"],
    );
  } finally {
    mock.restore();
  }
});
