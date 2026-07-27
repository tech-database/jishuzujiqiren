import assert from "node:assert/strict";
import test from "node:test";
import { formatClock, formatDate } from "./dashboard-formatters.js";

test("uses a readable fallback for missing or invalid dashboard timestamps", () => {
  assert.equal(formatDate("not-a-date"), "—");
  assert.equal(formatClock(""), "—");
  assert.equal(formatClock("not-a-date"), "—");
});

test("formats dashboard dates and clocks for the Chinese locale", () => {
  const value = new Date(2026, 6, 27, 9, 8, 7);

  assert.match(formatDate(value), /2026.*07.*27/);
  assert.match(formatClock(value), /09:08:07/);
});
