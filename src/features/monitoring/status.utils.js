export const statusTableKeys = ["board", "paint"];

export function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildStatusCacheKey(tableKey, range) {
  return `${tableKey}:${range.startDate || ""}:${range.endDate || ""}`;
}

export function combineStatusResults(resultsByKey, range) {
  const tableResults = statusTableKeys.map((tableKey) => resultsByKey[buildStatusCacheKey(tableKey, range)]);
  if (tableResults.some((result) => !result?.summary)) return null;

  const summary = tableResults.reduce(
    (combined, result) => ({
      total: combined.total + Number(result.summary.total || 0),
      unclaimed: combined.unclaimed + Number(result.summary.unclaimed || 0),
      drawing: combined.drawing + Number(result.summary.drawing || 0),
      done: combined.done + Number(result.summary.done || 0),
      updated: combined.updated + Number(result.summary.updated || 0),
      missingClaimTime: combined.missingClaimTime + Number(result.summary.missingClaimTime || 0),
      missingCompleteTime: combined.missingCompleteTime + Number(result.summary.missingCompleteTime || 0),
      timestampsBackfilled: combined.timestampsBackfilled + Number(result.summary.timestampsBackfilled || 0),
    }),
    {
      total: 0,
      unclaimed: 0,
      drawing: 0,
      done: 0,
      updated: 0,
      missingClaimTime: 0,
      missingCompleteTime: 0,
      timestampsBackfilled: 0,
    },
  );
  return { table: "all", tables: statusTableKeys, summary };
}

export function extractBackgroundStatusResults(status, existingResults = {}) {
  const cachedResults = {};
  for (const [tableKey, tableStatus] of Object.entries(status?.tables || {})) {
    if (!tableStatus?.lastSummary || !tableStatus?.range) continue;
    const cacheKey = buildStatusCacheKey(tableKey, tableStatus.range);
    const existing = existingResults[cacheKey];
    const refreshedAt = tableStatus.lastFinishedAt || tableStatus.lastCheckedAt || "";
    if (
      existing?.refreshedAt &&
      refreshedAt &&
      Date.parse(existing.refreshedAt) >= Date.parse(refreshedAt)
    ) {
      continue;
    }
    cachedResults[cacheKey] = {
      table: tableKey,
      summary: tableStatus.lastSummary,
      source: "background",
      refreshedAt,
    };
  }
  return cachedResults;
}
