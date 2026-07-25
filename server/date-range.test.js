import assert from "node:assert/strict";
import test from "node:test";
import {
  formatShanghaiDateTime,
  millisecondsUntilNextShanghaiHour,
  parseShanghaiDateBoundary,
  parseShanghaiDateTime,
  recentShanghaiDateRange,
} from "./date-range.js";
import { buildBitableRecordSearchBody } from "./bot-core.js";

test("builds an inclusive recent seven-day range in Asia/Shanghai", () => {
  assert.deepEqual(recentShanghaiDateRange(7, new Date("2026-07-24T03:00:00.000Z")), {
    startDate: "2026-07-18",
    endDate: "2026-07-24",
  });
});

test("uses Shanghai day boundaries independently of the server timezone", () => {
  assert.equal(parseShanghaiDateBoundary("2026-07-24"), Date.parse("2026-07-23T16:00:00.000Z"));
  assert.equal(parseShanghaiDateBoundary("2026-07-24", true), Date.parse("2026-07-24T15:59:59.999Z"));
  assert.equal(parseShanghaiDateBoundary("2026-02-30"), null);
});

test("formats and parses drawing timestamps as Shanghai time", () => {
  const timestamp = Date.parse("2026-07-24T16:30:45.000Z");
  assert.equal(formatShanghaiDateTime(timestamp), "2026-07-25 00:30:45");
  assert.equal(parseShanghaiDateTime("2026-07-25 00:30:45"), timestamp);
  assert.equal(parseShanghaiDateTime("2026-02-30 12:00:00"), null);
  assert.equal(parseShanghaiDateTime("2026-07-25 24:00:00"), null);
});

test("schedules the daily full scan for the next 02:00 in Shanghai", () => {
  assert.equal(
    millisecondsUntilNextShanghaiHour(2, new Date("2026-07-24T17:00:00.000Z")),
    60 * 60 * 1000,
  );
  assert.equal(
    millisecondsUntilNextShanghaiHour(2, new Date("2026-07-24T19:00:00.000Z")),
    23 * 60 * 60 * 1000,
  );
});

test("builds a server-side Feishu filter for the selected inclusive date range", () => {
  assert.deepEqual(buildBitableRecordSearchBody({
    startDate: "2026-07-18",
    endDate: "2026-07-24",
  }), {
    filter: {
      conjunction: "and",
      conditions: [
        {
          field_name: "日期",
          operator: "isGreater",
          value: ["ExactDate", String(Date.parse("2026-07-17T15:59:59.999Z"))],
        },
        {
          field_name: "日期",
          operator: "isLess",
          value: ["ExactDate", String(Date.parse("2026-07-24T16:00:00.000Z"))],
        },
      ],
    },
  });
  assert.deepEqual(buildBitableRecordSearchBody(), {});
});

test("combines targeted owner-stat filters with selected fields", () => {
  assert.deepEqual(buildBitableRecordSearchBody({
    fieldNames: ["绘图人", "状态"],
    filterConditions: [{
      field_name: "状态",
      operator: "is",
      value: ["绘图中"],
    }],
  }), {
    field_names: ["绘图人", "状态"],
    filter: {
      conjunction: "and",
      conditions: [{
        field_name: "状态",
        operator: "is",
        value: ["绘图中"],
      }],
    },
  });
  assert.equal(buildBitableRecordSearchBody({
    filterConditions: [
      { field_name: "状态", operator: "is", value: ["绘图中"] },
      { field_name: "领图具体时间", operator: "contains", value: ["2026-07-24"] },
    ],
    filterConjunction: "or",
  }).filter.conjunction, "or");
});

test("builds a server-side unclaimed filter without loading unrelated fields", () => {
  assert.deepEqual(buildBitableRecordSearchBody({
    fieldNames: ["绘图人", "下单建料号", "图号"],
    filterConditions: [{
      field_name: "绘图人",
      operator: "isEmpty",
      value: [],
    }],
  }), {
    field_names: ["绘图人", "下单建料号", "图号"],
    filter: {
      conjunction: "and",
      conditions: [{
        field_name: "绘图人",
        operator: "isEmpty",
        value: [],
      }],
    },
  });
});
