import {
  buildMetricCards,
  buildStatusDistribution,
  calculateCompletionRate,
  normalizeStatusData,
} from "../../utils/monitoringDataTransform.js";

export function buildMonitoringViewModel({
  backgroundSyncStatus,
  configReady,
  formatDisplayTime,
  healthLoading,
  healthStatus,
  statusResult,
  targetTable,
}) {
  const normalized = normalizeStatusData(statusResult, null);
  const failedHealthChecks = Object.entries(healthStatus?.checks || {}).filter(
    ([, check]) => check?.ok === false,
  );
  const hasHealthError = Boolean(healthStatus && !healthStatus.ok);
  const hasBackgroundError = Boolean(backgroundSyncStatus?.lastError);
  const historicalTimestampAnomalies = Object.values(
    backgroundSyncStatus?.dailyFull?.summaries || {},
  ).reduce(
    (total, summary) =>
      total +
      Number(summary?.missingClaimTime || 0) +
      Number(summary?.missingCompleteTime || 0),
    0,
  );
  const hasMonitoringIssue =
    hasHealthError || hasBackgroundError || historicalTimestampAnomalies > 0;

  return {
    completionRate: calculateCompletionRate(normalized.summary),
    distribution: buildStatusDistribution(normalized.summary),
    hasBackgroundError,
    hasHealthError,
    hasMonitoringIssue,
    healthErrorText:
      failedHealthChecks
        .map(([, check]) => check.message)
        .filter(Boolean)
        .join("；") ||
      healthStatus?.label ||
      "飞书连接健康检查未通过",
    healthLabel:
      healthLoading && !healthStatus
        ? "检测中"
        : hasHealthError || hasBackgroundError
          ? "异常待处理"
          : healthStatus?.ok && backgroundSyncStatus?.lastCheckedAt
            ? "运行正常"
            : configReady
              ? "等待检测"
              : "未知状态",
    healthTone:
      hasHealthError || hasBackgroundError
        ? "error"
        : healthStatus?.ok && backgroundSyncStatus?.lastCheckedAt
          ? "online"
          : "standby",
    historicalTimestampAnomalies,
    intervalLabel: backgroundSyncStatus?.intervalMs
      ? `${Math.round(backgroundSyncStatus.intervalMs / 1000)} 秒自动检查`
      : "自动检查间隔未提供",
    lastCheckedLabel: backgroundSyncStatus?.lastCheckedAt
      ? formatDisplayTime(backgroundSyncStatus.lastCheckedAt)
      : "等待首次检测",
    metrics: buildMetricCards(normalized, backgroundSyncStatus).filter(
      (metric) => metric.key !== "lastCheckedAt",
    ),
    normalized,
    selectedTableLabel: targetTable === "paint" ? "油漆表" : "胶板表",
  };
}
