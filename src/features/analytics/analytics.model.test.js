import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsRangeError,
  formatAnalyticsMetric,
  initialAnalyticsDateRange,
} from "./analytics.model.js";

test("builds analytics ranges from the current month", () => {
  assert.deepEqual(initialAnalyticsDateRange(new Date(2026, 6, 27)), {
    startDate: "2026-07-01",
    endDate: "2026-07-27",
  });
});

test("rejects reversed analytics date ranges", () => {
  assert.equal(
    analyticsRangeError({ startDate: "2026-07-27", endDate: "2026-07-01" }),
    "开始日期不能晚于结束日期",
  );
  assert.equal(
    analyticsRangeError({ startDate: "2026-07-01", endDate: "2026-07-27" }),
    "",
  );
});

test("formats analytics values and unavailable data", () => {
  assert.equal(formatAnalyticsMetric(12.34, " 分"), "12.3 分");
  assert.equal(formatAnalyticsMetric(null), "暂无数据");
});
