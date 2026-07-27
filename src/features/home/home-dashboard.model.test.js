import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTodaySummary,
  defaultPerformanceRange,
  formatDateInput,
} from "./home-dashboard.model.js";

test("formats local dates for native date inputs", () => {
  assert.equal(formatDateInput(new Date(2026, 6, 7)), "2026-07-07");
});

test("builds the default performance range from the current month", () => {
  assert.deepEqual(defaultPerformanceRange(new Date(2026, 6, 27)), {
    startDate: "2026-07-01",
    endDate: "2026-07-27",
  });
});

test("combines board and paint status counts for today's summary", () => {
  assert.deepEqual(
    buildTodaySummary({
      today: {
        board: { summary: { unclaimed: 2, drawing: 3, done: 4 } },
        paint: { summary: { unclaimed: 1, drawing: 2, done: 5 } },
      },
    }),
    {
      total: 17,
      unclaimed: 3,
      drawing: 5,
      done: 9,
    },
  );
});

test("uses zeroes when dashboard data has not loaded", () => {
  assert.deepEqual(buildTodaySummary(null), {
    total: 0,
    unclaimed: 0,
    drawing: 0,
    done: 0,
  });
});
