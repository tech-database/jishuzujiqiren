import {
  millisecondsUntilNextShanghaiHour,
  recentShanghaiDateRange,
} from "./date-range.js";
import {
  getDrawingStatusFingerprint,
  syncDrawingStatuses,
} from "./bot-core.js";
import { getConfigStatus } from "./runtime-config.js";

export function createStatusSyncService({
  intervalMs,
  dailyFullHour,
  now = () => Date.now(),
  services = {},
} = {}) {
  const readConfigStatus = services.getConfigStatus || getConfigStatus;
  const readStatusFingerprint =
    services.getDrawingStatusFingerprint || getDrawingStatusFingerprint;
  const synchronizeDrawingStatuses =
    services.syncDrawingStatuses || syncDrawingStatuses;
  const scheduleTimeout = services.setTimeout || setTimeout;
  const millisecondsUntilDailyRun =
    services.millisecondsUntilNextShanghaiHour || millisecondsUntilNextShanghaiHour;
  const recentDateRange = services.recentShanghaiDateRange || recentShanghaiDateRange;

  const runningTables = new Set();
  const backgroundFingerprints = {};
  let backgroundCheckRunning = false;
  const statusSyncInfo = {
    enabled: true,
    mode: "on_change",
    intervalMs,
    running: false,
    lastReason: "",
    lastCheckedAt: "",
    lastChangedAt: "",
    lastSkippedAt: "",
    lastStartedAt: "",
    lastFinishedAt: "",
    lastError: "",
    lastSummary: null,
    skippedCount: 0,
    dailyFull: {
      hour: dailyFullHour,
      lastStartedAt: "",
      lastFinishedAt: "",
      lastError: "",
      summaries: {},
    },
    tables: {},
  };

  const timestamp = () => new Date(now()).toISOString();
  const defaultStatusDateRange = () => recentDateRange(7);

  function getTableSyncInfo(tableKey) {
    if (!statusSyncInfo.tables[tableKey]) {
      statusSyncInfo.tables[tableKey] = {
        running: false,
        range: null,
        lastReason: "",
        lastCheckedAt: "",
        lastChangedAt: "",
        lastSkippedAt: "",
        lastStartedAt: "",
        lastFinishedAt: "",
        lastError: "",
        lastSummary: null,
        skippedCount: 0,
      };
    }
    return statusSyncInfo.tables[tableKey];
  }

  async function runStatusSync(
    reason,
    range = {},
    { skipIfRunning = false, suppressErrors = false } = {},
  ) {
    if (!readConfigStatus().ready) {
      if (skipIfRunning || suppressErrors) return null;
      throw new Error("配置未加载，无法进行状态检测");
    }
    const syncRange = {
      startDate: range.startDate || "",
      endDate: range.endDate || "",
      tableKey: range.tableKey || "board",
      fillMissingTimestamps: range.fillMissingTimestamps !== false,
    };
    const tableSyncInfo = getTableSyncInfo(syncRange.tableKey);
    if (runningTables.has(syncRange.tableKey)) {
      if (skipIfRunning) return null;
      const error = new Error(
        `${syncRange.tableKey === "paint" ? "油漆" : "胶板"}状态检测正在进行，请稍后再试`,
      );
      error.statusCode = 409;
      throw error;
    }
    runningTables.add(syncRange.tableKey);
    statusSyncInfo.running = true;
    statusSyncInfo.lastReason = reason;
    statusSyncInfo.lastStartedAt = timestamp();
    statusSyncInfo.lastError = "";
    statusSyncInfo.range = syncRange;
    Object.assign(tableSyncInfo, {
      running: true,
      range: syncRange,
      lastReason: reason,
      lastStartedAt: statusSyncInfo.lastStartedAt,
      lastError: "",
    });
    try {
      const result = await synchronizeDrawingStatuses(syncRange);
      statusSyncInfo.lastSummary = result.summary;
      tableSyncInfo.lastSummary = result.summary;
      if (result.summary.updated > 0) {
        console.log(
          `Drawing status sync (${reason}): updated=${result.summary.updated}, unclaimed=${result.summary.unclaimed}, drawing=${result.summary.drawing}, done=${result.summary.done}`,
        );
      }
      return result;
    } catch (error) {
      statusSyncInfo.lastError = error.message;
      tableSyncInfo.lastError = error.message;
      console.error(`Drawing status sync failed (${reason}):`, error.message);
      if (!suppressErrors) throw error;
      return null;
    } finally {
      runningTables.delete(syncRange.tableKey);
      statusSyncInfo.running = runningTables.size > 0;
      statusSyncInfo.lastFinishedAt = timestamp();
      tableSyncInfo.running = false;
      tableSyncInfo.lastFinishedAt = statusSyncInfo.lastFinishedAt;
    }
  }

  async function refreshBackgroundFingerprint(tableKey, range = defaultStatusDateRange()) {
    backgroundFingerprints[tableKey] = await readStatusFingerprint({
      ...range,
      tableKey,
    });
    return backgroundFingerprints[tableKey];
  }

  async function runBackgroundStatusSync(reason = "timer") {
    if (backgroundCheckRunning || runningTables.size > 0 || !readConfigStatus().ready) {
      return null;
    }
    backgroundCheckRunning = true;
    const results = [];
    const errors = [];
    try {
      const configuredTableKeys = Object.entries(readConfigStatus().tables || {})
        .filter(([tableKey, tableStatus]) =>
          ["board", "paint"].includes(tableKey) && tableStatus.ready)
        .map(([tableKey]) => tableKey);
      for (const tableKey of configuredTableKeys) {
        const range = { ...defaultStatusDateRange(), tableKey };
        const tableSyncInfo = getTableSyncInfo(tableKey);
        statusSyncInfo.range = range;
        statusSyncInfo.lastCheckedAt = timestamp();
        tableSyncInfo.range = range;
        tableSyncInfo.lastCheckedAt = statusSyncInfo.lastCheckedAt;
        tableSyncInfo.lastError = "";
        try {
          const fingerprint = await readStatusFingerprint(range);
          if (!backgroundFingerprints[tableKey]) {
            backgroundFingerprints[tableKey] = fingerprint;
            statusSyncInfo.lastReason = `baseline:${tableKey}`;
            statusSyncInfo.lastSkippedAt = timestamp();
            statusSyncInfo.skippedCount += 1;
            tableSyncInfo.lastReason = statusSyncInfo.lastReason;
            tableSyncInfo.lastSkippedAt = statusSyncInfo.lastSkippedAt;
            tableSyncInfo.skippedCount += 1;
            continue;
          }
          if (fingerprint === backgroundFingerprints[tableKey]) {
            statusSyncInfo.lastReason = `no-change:${tableKey}`;
            statusSyncInfo.lastSkippedAt = timestamp();
            statusSyncInfo.skippedCount += 1;
            tableSyncInfo.lastReason = statusSyncInfo.lastReason;
            tableSyncInfo.lastSkippedAt = statusSyncInfo.lastSkippedAt;
            tableSyncInfo.skippedCount += 1;
            continue;
          }
          statusSyncInfo.lastChangedAt = timestamp();
          tableSyncInfo.lastChangedAt = statusSyncInfo.lastChangedAt;
          const result = await runStatusSync(`table-change:${tableKey}`, range, {
            skipIfRunning: true,
            suppressErrors: true,
          });
          if (result) {
            await refreshBackgroundFingerprint(tableKey, range);
            results.push(result);
          }
        } catch (error) {
          errors.push(`${tableKey === "paint" ? "油漆" : "胶板"}：${error.message}`);
          tableSyncInfo.lastError = error.message;
          console.error(
            `Drawing status change check failed (${reason}:${tableKey}):`,
            error.message,
          );
        }
      }
      statusSyncInfo.lastError = errors.join("；");
      return results.length > 0 ? results : null;
    } finally {
      backgroundCheckRunning = false;
    }
  }

  async function runDailyFullStatusSync() {
    if (backgroundCheckRunning || runningTables.size > 0 || !readConfigStatus().ready) {
      return false;
    }
    backgroundCheckRunning = true;
    statusSyncInfo.dailyFull.lastStartedAt = timestamp();
    statusSyncInfo.dailyFull.lastError = "";
    statusSyncInfo.dailyFull.summaries = {};
    const results = [];
    const errors = [];
    try {
      const configuredTableKeys = Object.entries(readConfigStatus().tables || {})
        .filter(([tableKey, tableStatus]) =>
          ["board", "paint"].includes(tableKey) && tableStatus.ready)
        .map(([tableKey]) => tableKey);
      for (const tableKey of configuredTableKeys) {
        try {
          const result = await runStatusSync(
            "daily-full",
            { tableKey, fillMissingTimestamps: false },
            { skipIfRunning: true },
          );
          if (result) {
            results.push(result);
            statusSyncInfo.dailyFull.summaries[tableKey] = result.summary;
            const missingTimestamps =
              Number(result.summary.missingClaimTime || 0) +
              Number(result.summary.missingCompleteTime || 0);
            if (missingTimestamps > 0) {
              console.warn(
                `Historical timestamp anomalies (${tableKey}): missingClaim=${result.summary.missingClaimTime}, missingComplete=${result.summary.missingCompleteTime}; timestamps preserved`,
              );
            }
          }
          await refreshBackgroundFingerprint(tableKey);
        } catch (error) {
          errors.push(`${tableKey === "paint" ? "油漆" : "胶板"}：${error.message}`);
        }
      }
      statusSyncInfo.dailyFull.lastError = errors.join("；");
      return results;
    } catch (error) {
      statusSyncInfo.dailyFull.lastError = error.message;
      console.error("Daily full drawing status sync failed:", error.message);
      return null;
    } finally {
      statusSyncInfo.dailyFull.lastFinishedAt = timestamp();
      backgroundCheckRunning = false;
    }
  }

  function scheduleDailyFullStatusSync(retryDelayMs = null) {
    const delay = retryDelayMs ?? millisecondsUntilDailyRun(dailyFullHour);
    const timer = scheduleTimeout(async () => {
      const result = await runDailyFullStatusSync();
      scheduleDailyFullStatusSync(result === false ? 5 * 60 * 1000 : null);
    }, delay);
    timer.unref?.();
  }

  return {
    refreshBackgroundFingerprint,
    runBackgroundStatusSync,
    runDailyFullStatusSync,
    runStatusSync,
    scheduleDailyFullStatusSync,
    statusSyncInfo,
  };
}
