import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getHomeDashboard } from "./home.api.js";
import {
  buildTodaySummary,
  defaultPerformanceRange,
  formatDateInput,
} from "./home-dashboard.model.js";

export function useHomeDashboardController() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  const [performanceRange, setPerformanceRange] = useState(defaultPerformanceRange);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const requestRef = useRef(null);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const performanceRangeRef = useRef(performanceRange);
  const lastPerformanceRefreshAtRef = useRef(0);
  const mountedRef = useRef(true);

  const loadDashboard = useCallback(
    ({ force = false, bypassCache = false, includePerformance = true } = {}) => {
      if (requestRef.current && !force) return requestRef.current;
      if (force) controllerRef.current?.abort();

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const controller = new AbortController();
      controllerRef.current = controller;
      const selectedRange = performanceRangeRef.current;
      const request = (async () => {
        try {
          const result = await getHomeDashboard({
            startDate: selectedRange.startDate,
            endDate: selectedRange.endDate,
            includePerformance,
            forceRefresh: bypassCache,
            signal: controller.signal,
          });
          if (!result.ok) throw new Error(result.error || "首页数据加载失败");
          if (mountedRef.current && requestId === requestIdRef.current) {
            setData((previous) => ({
              ...previous,
              ...result,
              performance: result.performance || previous?.performance,
              range: result.performance ? result.range : previous?.range,
            }));
            if (result.performanceIncluded) {
              lastPerformanceRefreshAtRef.current = Date.now();
            }
            setError("");
          }
        } catch (requestError) {
          if (
            requestError.name !== "AbortError" &&
            mountedRef.current &&
            requestId === requestIdRef.current
          ) {
            setError(requestError.message || "首页数据加载失败");
          }
        } finally {
          if (mountedRef.current && requestId === requestIdRef.current) {
            setLoading(false);
            if (includePerformance) setPerformanceLoading(false);
            setManualRefreshing(false);
            requestRef.current = null;
            if (controllerRef.current === controller) controllerRef.current = null;
          }
        }
      })();
      requestRef.current = request;
      return request;
    },
    [],
  );

  useEffect(() => {
    performanceRangeRef.current = performanceRange;
    setPerformanceLoading(true);
    loadDashboard({ force: true });
  }, [loadDashboard, performanceRange]);

  useEffect(() => {
    mountedRef.current = true;
    let refreshTimer;
    let clockTimer;

    const stopTimers = () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(clockTimer);
      refreshTimer = undefined;
      clockTimer = undefined;
    };
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        const includePerformance =
          Date.now() - lastPerformanceRefreshAtRef.current >= 60000;
        await loadDashboard({ includePerformance });
        if (mountedRef.current && document.visibilityState !== "hidden") {
          scheduleRefresh();
        }
      }, 10000);
    };
    const startTimers = () => {
      stopTimers();
      setNow(new Date());
      loadDashboard().finally(() => {
        if (mountedRef.current && document.visibilityState !== "hidden") {
          scheduleRefresh();
        }
      });
      clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    };
    const handleVisibility = () => {
      const visible = document.visibilityState !== "hidden";
      setPageVisible(visible);
      if (visible) startTimers();
      else stopTimers();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    handleVisibility();
    return () => {
      mountedRef.current = false;
      stopTimers();
      controllerRef.current?.abort();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadDashboard]);

  const todaySummary = useMemo(() => buildTodaySummary(data), [data]);

  const resetPerformanceRange = () => {
    setPerformanceRange(defaultPerformanceRange());
  };
  const forceRefreshDashboard = () => {
    setManualRefreshing(true);
    setPerformanceLoading(true);
    loadDashboard({ force: true, bypassCache: true });
  };

  return {
    data,
    error,
    forceRefreshDashboard,
    loadDashboard,
    loading,
    manualRefreshing,
    now,
    pageVisible,
    performanceLoading,
    performanceRange,
    resetPerformanceRange,
    setPerformanceRange,
    todayInput: formatDateInput(now),
    todaySummary,
  };
}
