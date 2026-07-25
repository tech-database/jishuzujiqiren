import assert from "node:assert/strict";
import test from "node:test";
import {
  claimDrawingOwners,
  createBitableRecords,
  invalidateAllFeishuCaches,
} from "./bot-core.js";

function installFeishuMock(records, { includeOwner = false } = {}) {
  const originalFetch = globalThis.fetch;
  const writes = [];
  const searches = [];

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
      const items = [
        { field_name: "料号", type: 1 },
        { field_name: "状态", type: 1 },
        { field_name: "日期", type: 5 },
      ];
      if (includeOwner) items.push({ field_name: "绘图人", type: 1 });
      return Response.json({ code: 0, data: { items } });
    }
    if (requestUrl.includes("/records/search?")) {
      searches.push(JSON.parse(options.body || "{}"));
      return Response.json({
        code: 0,
        data: {
          has_more: true,
          page_token: "ignored-next-page",
          items: records,
        },
      });
    }
    if (["POST", "PUT"].includes(options.method)) {
      writes.push({
        url: requestUrl,
        method: options.method,
        body: options.body ? JSON.parse(options.body) : null,
      });
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${requestUrl}`);
  };

  return {
    searches,
    writes,
    restore() {
      globalThis.fetch = originalFetch;
      invalidateAllFeishuCaches();
    },
  };
}

test("blocks an upload when its material code already exists in the target table", async () => {
  invalidateAllFeishuCaches();
  const mock = installFeishuMock([
    { record_id: "existing-record", fields: { 料号: "DUP-001" } },
  ]);

  try {
    await assert.rejects(
      createBitableRecords([{ 料号: "DUP-001" }], { tableKey: "board" }),
      /胶板表最近500条中已存在相同料号：DUP-001/,
    );
    assert.equal(mock.writes.length, 0);
    assert.equal(mock.searches.length, 1);
    assert.deepEqual(mock.searches[0].field_names, ["料号"]);
    assert.deepEqual(mock.searches[0].sort, [{ field_name: "日期", desc: true }]);
  } finally {
    mock.restore();
  }
});

test("blocks a drawing claim when one material code matches multiple records", async () => {
  invalidateAllFeishuCaches();
  const mock = installFeishuMock(
    [
      { record_id: "duplicate-1", fields: { 料号: "DUP-002", 绘图人: "", 日期: 1577836800000 } },
      { record_id: "duplicate-2", fields: { 料号: "DUP-002", 绘图人: "", 日期: 1577836800000 } },
    ],
    { includeOwner: true },
  );

  try {
    await assert.rejects(
      claimDrawingOwners({
        materialCodes: ["DUP-002"],
        senderName: "测试人员",
        senderId: "test-user",
        tableKey: "board",
        startDate: "2026-07-24",
        endDate: "2026-07-24",
      }),
      /胶板领图发现重复料号：DUP-002\(2条\).*本次未修改任何记录/,
    );
    assert.equal(mock.writes.length, 0);
    assert.equal(mock.searches.length, 1);
  } finally {
    mock.restore();
  }
});

test("reports a missing drawing claim material code in Chinese", async () => {
  invalidateAllFeishuCaches();
  const mock = installFeishuMock([], { includeOwner: true });

  try {
    await assert.rejects(
      claimDrawingOwners({
        materialCodes: ["MISSING-001"],
        senderName: "测试人员",
        senderId: "test-user",
        tableKey: "board",
      }),
      /未找到料号：MISSING-001/,
    );
    assert.equal(mock.writes.length, 0);
  } finally {
    mock.restore();
  }
});

test("always writes today's date instead of a date supplied by the spreadsheet", async () => {
  invalidateAllFeishuCaches();
  const mock = installFeishuMock([]);

  try {
    await createBitableRecords(
      [{ 料号: "NEW-001", 日期: "2020-01-02" }],
      { tableKey: "board" },
    );

    assert.equal(mock.writes.length, 1);
    const writtenDate = mock.writes[0].body.fields["日期"];
    const dateParts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(new Date())
        .map((part) => [part.type, part.value]),
    );
    const expectedDate =
      Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day)) -
      8 * 60 * 60 * 1000;
    assert.equal(writtenDate, expectedDate);
  } finally {
    mock.restore();
  }
});
