const shanghaiOffsetMs = 8 * 60 * 60 * 1000;

function shanghaiDateParts(value = new Date()) {
  const shifted = new Date(new Date(value).getTime() + shanghaiOffsetMs);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
}

function formatParts({ year, month, day }) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatShanghaiDate(value = new Date()) {
  return formatParts(shanghaiDateParts(value));
}

export function formatShanghaiDateTime(value = new Date()) {
  const shifted = new Date(new Date(value).getTime() + shanghaiOffsetMs);
  const pad = (part) => String(part).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(
    shifted.getUTCSeconds(),
  )}`;
}

export function parseShanghaiDateTime(value) {
  const match = String(value || "")
    .trim()
    .replace(/\./g, "-")
    .replace(/\//g, "-")
    .match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
    );
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText = "0", minuteText = "0", secondText = "0"] =
    match;
  const [year, month, day, hour, minute, second] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
  ].map(Number);
  const timestamp = Date.UTC(year, month - 1, day, hour - 8, minute, second);
  const shifted = new Date(timestamp + shanghaiOffsetMs);
  if (
    shifted.getUTCFullYear() !== year ||
    shifted.getUTCMonth() !== month - 1 ||
    shifted.getUTCDate() !== day ||
    shifted.getUTCHours() !== hour ||
    shifted.getUTCMinutes() !== minute ||
    shifted.getUTCSeconds() !== second
  ) {
    return null;
  }
  return timestamp;
}

export function recentShanghaiDateRange(days = 7, value = new Date()) {
  const count = Math.max(1, Math.floor(Number(days) || 1));
  const endParts = shanghaiDateParts(value);
  const startShifted = new Date(Date.UTC(endParts.year, endParts.month, endParts.day - (count - 1)));
  return {
    startDate: formatParts({
      year: startShifted.getUTCFullYear(),
      month: startShifted.getUTCMonth(),
      day: startShifted.getUTCDate(),
    }),
    endDate: formatParts(endParts),
  };
}

export function parseShanghaiDateBoundary(value, endOfDay = false) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const timestamp = endOfDay
    ? Date.UTC(year, month - 1, day, 15, 59, 59, 999)
    : Date.UTC(year, month - 1, day, -8, 0, 0, 0);
  const shifted = new Date(timestamp + shanghaiOffsetMs);
  if (
    shifted.getUTCFullYear() !== year ||
    shifted.getUTCMonth() !== month - 1 ||
    shifted.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

export function millisecondsUntilNextShanghaiHour(hour = 2, value = new Date()) {
  const targetHour = Math.min(23, Math.max(0, Math.floor(Number(hour) || 0)));
  const now = new Date(value).getTime();
  const parts = shanghaiDateParts(value);
  let target = Date.UTC(parts.year, parts.month, parts.day, targetHour - 8, 0, 0, 0);
  if (target <= now) target = Date.UTC(parts.year, parts.month, parts.day + 1, targetHour - 8, 0, 0, 0);
  return target - now;
}
