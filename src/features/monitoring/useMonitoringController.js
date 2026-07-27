import { useEffect, useRef, useState } from "react";
import { getDrawingOwnerStats } from "../drawing/drawing.api.js";
import {
  getBackgroundSyncStatus,
  recalculateDrawingDurations as recalculateDrawingDurationsApi,
  syncDrawingStatuses,
} from "./monitoring.api.js";
import {
  addDays,
  buildStatusCacheKey,
  combineStatusResults,
  extractBackgroundStatusResults,
  formatDateInput,
  statusTableKeys,
} from "./status.utils.js";

export function useMonitoringController({ activeTab, configReady, resetVersion = 0, targetTable }) {
  const [statusActionRunning, setStatusActionRunning] = useState(false);
  const [statusState, setStatusState] = useState(null);
  const [statusResultsByKey, setStatusResultsByKey] = useState({});
  const statusResultsRef = useRef({});
  const statusRequestsRef = useRef(new Map());
  const cacheGenerationRef = useRef(0);
  const [statusPendingKeys, setStatusPendingKeys] = useState({});
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState(null);
  const [ownerStats, setOwnerStats] = useState(null);
  const [ownerStatsLoading, setOwnerStatsLoading] = useState(false);
  const [ownerStatsState, setOwnerStatsState] = useState(null);
  const [statusDateRange, setStatusDateRange] = useState(() => {
    const today = new Date();
    return {
      startDate: formatDateInput(addDays(today, -6)),
      endDate: formatDateInput(today),
    };
  });

  const activeStatusCacheKey = buildStatusCacheKey(targetTable, statusDateRange);
  const statusResult = statusResultsByKey[activeStatusCacheKey] || null;
  const aggregateStatusResult = combineStatusResults(statusResultsByKey, statusDateRange);
  const statusSyncing =
    statusActionRunning ||
    statusTableKeys.some((tableKey) => statusPendingKeys[buildStatusCacheKey(tableKey, statusDateRange)]);

  function storeStatusResult(cacheKey, result) {
    statusResultsRef.current = { ...statusResultsRef.current, [cacheKey]: result };
    setStatusResultsByKey(statusResultsRef.current);
  }

  function resetMonitoring() {
    cacheGenerationRef.current += 1;
    statusResultsRef.current = {};
    statusRequestsRef.current.clear();
    setStatusResultsByKey({});
    setStatusPendingKeys({});
    setBackgroundSyncStatus(null);
    setOwnerStats(null);
    setOwnerStatsState(null);
  }

  async function fetchTableStatus(tableKey, range, { force = false } = {}) {
    const cacheKey = buildStatusCacheKey(tableKey, range);
    if (!force && statusResultsRef.current[cacheKey]) return statusResultsRef.current[cacheKey];
    if (statusRequestsRef.current.has(cacheKey)) return statusRequestsRef.current.get(cacheKey);

    setStatusPendingKeys((current) => ({ ...current, [cacheKey]: true }));
    const requestGeneration = cacheGenerationRef.current;
    const request = (async () => {
      const data = await syncDrawingStatuses({ ...range, tableKey });
      if (!data.ok) throw new Error(data.error);
      const result = { ...data, source: "direct", refreshedAt: new Date().toISOString() };
      if (requestGeneration === cacheGenerationRef.current) storeStatusResult(cacheKey, result);
      return result;
    })();

    statusRequestsRef.current.set(cacheKey, request);
    try {
      return await request;
    } finally {
      statusRequestsRef.current.delete(cacheKey);
      setStatusPendingKeys((current) => {
        const next = { ...current };
        delete next[cacheKey];
        return next;
      });
    }
  }

  async function syncDrawingStatus({ silent = false, force = true } = {}) {
    const range = { ...statusDateRange };
    if (!silent) {
      setStatusState(null);
      setStatusActionRunning(true);
    }
    try {
      await Promise.all(statusTableKeys.map((tableKey) => fetchTableStatus(tableKey, range, { force })));
      const combined = combineStatusResults(statusResultsRef.current, range);
      if (combined?.summary) {
        setStatusState({
          ok: true,
          text: `两表检测完成：未领取 ${combined.summary.unclaimed} 个，绘图中 ${combined.summary.drawing} 个，绘图完成 ${combined.summary.done} 个`,
        });
      }
      return combined;
    } catch (error) {
      if (!(silent && String(error.message || "").includes("状态检测正在进行"))) {
        setStatusState({ ok: false, text: error.message });
      }
      return null;
    } finally {
      if (!silent) setStatusActionRunning(false);
    }
  }

  async function recalculateDrawingDurations() {
    setStatusState(null);
    setStatusActionRunning(true);
    try {
      const data = await recalculateDrawingDurationsApi({ ...statusDateRange, tableKey: targetTable });
      if (!data.ok) throw new Error(data.error);
      setStatusState({
        ok: true,
        text: `用时重算完成：检查 ${data.summary.scanned} 条，可计算 ${data.summary.eligible} 条，更新 ${data.summary.updated} 条，缺少时间 ${data.summary.missingTime} 条，跳过空白 ${data.summary.skippedBlank || 0} 条`,
      });
      await fetchTableStatus(targetTable, { ...statusDateRange }, { force: true });
    } catch (error) {
      setStatusState({ ok: false, text: error.message });
    } finally {
      setStatusActionRunning(false);
    }
  }

  async function loadBackgroundSyncStatus() {
    try {
      const data = await getBackgroundSyncStatus();
      if (!data.ok) return;
      setBackgroundSyncStatus(data.status);
      const cachedResults = extractBackgroundStatusResults(
        data.status,
        statusResultsRef.current,
      );
      if (Object.keys(cachedResults).length > 0) {
        const nextResults = { ...statusResultsRef.current, ...cachedResults };
        statusResultsRef.current = nextResults;
        setStatusResultsByKey(nextResults);
      }
    } catch {
      setBackgroundSyncStatus(null);
    }
  }

  async function loadDrawingOwnerStats({ silent = false } = {}) {
    if (!silent) {
      setOwnerStatsLoading(true);
      setOwnerStatsState(null);
    }
    try {
      const data = await getDrawingOwnerStats();
      if (!data.ok) throw new Error(data.error);
      setOwnerStats(data);
      setOwnerStatsState(null);
    } catch (error) {
      setOwnerStatsState({ ok: false, text: error.message });
    } finally {
      if (!silent) setOwnerStatsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "status" || !configReady) return;
    syncDrawingStatus({ silent: true, force: false });
    // The explicit scalar dependencies define when status data should refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, configReady, statusDateRange.startDate, statusDateRange.endDate]);

  useEffect(() => {
    if (resetVersion > 0) resetMonitoring();
  }, [resetVersion]);

  useEffect(() => {
    if (activeTab !== "status") return undefined;
    loadBackgroundSyncStatus();
    const timer = window.setInterval(loadBackgroundSyncStatus, 3000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "owners" || !configReady) return undefined;
    loadDrawingOwnerStats();
    const timer = window.setInterval(() => loadDrawingOwnerStats({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [activeTab, configReady]);

  return {
    aggregateStatusResult,
    backgroundSyncStatus,
    formatDisplayTime,
    loadDrawingOwnerStats,
    ownerStats,
    ownerStatsLoading,
    ownerStatsState,
    recalculateDrawingDurations,
    resetMonitoring,
    setStatusDateRange,
    statusDateRange,
    statusResult,
    statusState,
    statusSyncing,
    syncDrawingStatus,
  };
}

export function formatDisplayTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}
