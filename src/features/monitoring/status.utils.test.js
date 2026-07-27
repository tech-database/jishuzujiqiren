import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  buildStatusCacheKey,
  combineStatusResults,
  extractBackgroundStatusResults,
  formatDateInput,
} from "./status.utils.js";

test("builds stable monitoring cache keys", () => {
  assert.equal(
    buildStatusCacheKey("board", {
      startDate: "2026-07-01",
      endDate: "2026-07-27",
    }),
    "board:2026-07-01:2026-07-27",
  );
});

test("combines board and paint monitoring summaries", () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-27" };
  const result = combineStatusResults(
    {
      [buildStatusCacheKey("board", range)]: {
        summary: { total: 5, unclaimed: 1, drawing: 2, done: 2, updated: 1 },
      },
      [buildStatusCacheKey("paint", range)]: {
        summary: { total: 7, unclaimed: 2, drawing: 1, done: 4, updated: 3 },
      },
    },
    range,
  );

  assert.deepEqual(result.summary, {
    total: 12,
    unclaimed: 3,
    drawing: 3,
    done: 6,
    updated: 4,
    missingClaimTime: 0,
    missingCompleteTime: 0,
    timestampsBackfilled: 0,
  });
});

test("waits until both monitoring tables have results", () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-27" };
  assert.equal(
    combineStatusResults(
      {
        [buildStatusCacheKey("board", range)]: { summary: { total: 1 } },
      },
      range,
    ),
    null,
  );
});

test("uses local calendar arithmetic for monitoring ranges", () => {
  const today = new Date(2026, 6, 27);
  assert.equal(formatDateInput(addDays(today, -6)), "2026-07-21");
});

test("extracts only newer background monitoring results", () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-27" };
  const cacheKey = buildStatusCacheKey("board", range);
  const result = extractBackgroundStatusResults(
    {
      tables: {
        board: {
          range,
          lastSummary: { total: 10 },
          lastFinishedAt: "2026-07-27T09:00:00.000Z",
        },
        paint: { range: null, lastSummary: null },
      },
    },
    {
      [cacheKey]: {
        refreshedAt: "2026-07-27T08:00:00.000Z",
      },
    },
  );

  assert.equal(result[cacheKey].source, "background");
  assert.equal(result[cacheKey].summary.total, 10);
});
