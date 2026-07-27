import { useCallback, useEffect, useMemo, useState } from "react";
import { getDrawingAnalytics } from "./analytics.api.js";
import {
  analyticsRangeError,
  initialAnalyticsDateRange,
} from "./analytics.model.js";

export function useAnalyticsController({ configReady, targetTable }) {
  const [dateRange, setDateRange] = useState(initialAnalyticsDateRange);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(
    async (signal) => {
      if (!configReady) return;
      const rangeError = analyticsRangeError(dateRange);
      if (rangeError) {
        setError(rangeError);
        setData(null);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const result = await getDrawingAnalytics({
          tableKey: targetTable,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          signal,
        });
        if (!result.ok) throw new Error(result.error || "数据统计失败");
        setData(result);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "数据统计失败");
          setData(null);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [configReady, dateRange, targetTable],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics]);

  return {
    data,
    dateRange,
    durationItems: useMemo(
      () => (data?.owners || []).filter((item) => item.averageDuration !== null),
      [data?.owners],
    ),
    error,
    loadAnalytics,
    loading,
    setDateRange,
  };
}
