const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const shanghaiOffsetMs = 8 * hourMs;

const workIntervals = Object.freeze([
  [8 * hourMs + 15 * minuteMs, 12 * hourMs],
  [13 * hourMs + 45 * minuteMs, 18 * hourMs],
]);
const fullWorkdayMs = workIntervals.reduce((total, [start, end]) => total + end - start, 0);

function shanghaiDayIndex(timestamp) {
  return Math.floor((timestamp + shanghaiOffsetMs) / dayMs);
}

function overlapMs(start, end, intervalStart, intervalEnd) {
  return Math.max(0, Math.min(end, intervalEnd) - Math.max(start, intervalStart));
}

function workMsWithinShanghaiDay(dayIndex, start, end) {
  const dayStart = dayIndex * dayMs - shanghaiOffsetMs;
  return workIntervals.reduce(
    (total, [intervalStart, intervalEnd]) =>
      total + overlapMs(start, end, dayStart + intervalStart, dayStart + intervalEnd),
    0,
  );
}

export function calculateDrawingWorkDurationMinutes(claimTimestamp, completeTimestamp) {
  const start = Number(claimTimestamp);
  const end = Number(completeTimestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  const startDay = shanghaiDayIndex(start);
  const endDay = shanghaiDayIndex(end);
  let durationMs;

  if (startDay === endDay) {
    durationMs = workMsWithinShanghaiDay(startDay, start, end);
  } else {
    durationMs =
      workMsWithinShanghaiDay(startDay, start, (startDay + 1) * dayMs - shanghaiOffsetMs) +
      workMsWithinShanghaiDay(endDay, endDay * dayMs - shanghaiOffsetMs, end) +
      Math.max(0, endDay - startDay - 1) * fullWorkdayMs;
  }

  return Math.max(0, Math.round(durationMs / minuteMs));
}
