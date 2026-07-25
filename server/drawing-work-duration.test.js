import assert from "node:assert/strict";
import test from "node:test";
import { calculateDrawingWorkDurationMinutes } from "./drawing-work-duration.js";

const shanghaiTime = (value) => Date.parse(`${value}+08:00`);

test("counts only the morning and afternoon working periods", () => {
  assert.equal(
    calculateDrawingWorkDurationMinutes(
      shanghaiTime("2026-07-25T08:15:00"),
      shanghaiTime("2026-07-25T18:00:00"),
    ),
    480,
  );
});

test("excludes lunch time from drawing duration", () => {
  assert.equal(
    calculateDrawingWorkDurationMinutes(
      shanghaiTime("2026-07-25T11:30:00"),
      shanghaiTime("2026-07-25T14:15:00"),
    ),
    60,
  );
  assert.equal(
    calculateDrawingWorkDurationMinutes(
      shanghaiTime("2026-07-25T12:00:00"),
      shanghaiTime("2026-07-25T13:45:00"),
    ),
    0,
  );
});

test("excludes overnight time across multiple days", () => {
  assert.equal(
    calculateDrawingWorkDurationMinutes(
      shanghaiTime("2026-07-25T17:30:00"),
      shanghaiTime("2026-07-26T08:30:00"),
    ),
    45,
  );
  assert.equal(
    calculateDrawingWorkDurationMinutes(
      shanghaiTime("2026-07-25T08:15:00"),
      shanghaiTime("2026-07-27T18:00:00"),
    ),
    1440,
  );
});

test("clips times before and after working hours", () => {
  assert.equal(
    calculateDrawingWorkDurationMinutes(
      shanghaiTime("2026-07-25T06:00:00"),
      shanghaiTime("2026-07-25T09:00:00"),
    ),
    45,
  );
  assert.equal(
    calculateDrawingWorkDurationMinutes(
      shanghaiTime("2026-07-25T18:30:00"),
      shanghaiTime("2026-07-26T07:30:00"),
    ),
    0,
  );
});
