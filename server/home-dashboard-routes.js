import {
  formatShanghaiDate,
  parseShanghaiDateBoundary,
} from "./date-range.js";
import {
  getFeishuCacheStatus,
  invalidateBitableRecordCache,
} from "./bitable-client.js";
import {
  queryDrawingAnalytics,
  queryDrawingOwnerStats,
  queryHomeDashboardTable,
  refreshDrawingOwnerRoster,
} from "./bot-core.js";
import { apiErrorCodes, sendError, successResponse } from "./api-response.js";
import { getConfigStatus } from "./runtime-config.js";

function parseDashboardDate(value, fallback) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback;
  return parseShanghaiDateBoundary(text) === null ? fallback : text;
}

export function createHomeDashboardRoutes({
  buildHealthStatus,
  statusSyncInfo,
  forceRefreshCooldownMs = 15000,
  serverStartedAt = new Date().toISOString(),
  now = () => new Date(),
  services = {},
} = {}) {
  const readConfigStatus = services.getConfigStatus || getConfigStatus;
  const readFeishuCacheStatus = services.getFeishuCacheStatus || getFeishuCacheStatus;
  const invalidateRecordCache =
    services.invalidateBitableRecordCache || invalidateBitableRecordCache;
  const loadDrawingAnalytics = services.queryDrawingAnalytics || queryDrawingAnalytics;
  const loadDrawingOwnerStats = services.queryDrawingOwnerStats || queryDrawingOwnerStats;
  const loadHomeDashboardTable =
    services.queryHomeDashboardTable || queryHomeDashboardTable;
  const refreshOwnerRoster =
    services.refreshDrawingOwnerRoster || refreshDrawingOwnerRoster;
  let lastForceRefreshAt = 0;

  function registerRoutes(app) {
    app.get("/api/home-dashboard", async (req, res) => {
      try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
        const requestTime = now();
        const today = formatShanghaiDate(requestTime);
        const defaultRangeStart = `${today.slice(0, 7)}-01`;
        const rangeEnd = parseDashboardDate(req.query.endDate, today);
        const rangeStart = parseDashboardDate(req.query.startDate, defaultRangeStart);
        const includePerformance = req.query.includePerformance !== "0";
        if (rangeStart > rangeEnd) throw new Error("绩效统计开始日期不能晚于结束日期");
        if (rangeEnd > today) throw new Error("绩效统计结束日期不能晚于今天");

        const forceRefreshRequested = req.query.forceRefresh === "1";
        const forceRefreshApplied =
          forceRefreshRequested &&
          requestTime.getTime() - lastForceRefreshAt >= forceRefreshCooldownMs;
        if (forceRefreshApplied) {
          invalidateRecordCache("board");
          invalidateRecordCache("paint");
          await refreshOwnerRoster();
          lastForceRefreshAt = requestTime.getTime();
        }

        const [personnel, boardToday, paintToday, boardPerformance, paintPerformance, health] =
          await Promise.all([
            loadDrawingOwnerStats(),
            loadHomeDashboardTable({ startDate: today, endDate: today, tableKey: "board" }),
            loadHomeDashboardTable({ startDate: today, endDate: today, tableKey: "paint" }),
            includePerformance
              ? loadDrawingAnalytics({
                  startDate: rangeStart,
                  endDate: rangeEnd,
                  tableKey: "board",
                })
              : null,
            includePerformance
              ? loadDrawingAnalytics({
                  startDate: rangeStart,
                  endDate: rangeEnd,
                  tableKey: "paint",
                })
              : null,
            buildHealthStatus(),
          ]);

        const configReady = readConfigStatus().ready;
        const systemEvents = [
          {
            id: `config:${serverStartedAt}`,
            time: serverStartedAt,
            type: "配置",
            source: "系统",
            content: configReady ? "运行配置已加载" : "运行配置尚未完整加载",
            status: configReady ? "正常" : "异常",
          },
          health.checkedAt && {
            id: `health:${health.checkedAt}`,
            time: health.checkedAt,
            type: "检测",
            source: "监控中心",
            content: health.ok ? "任务状态与飞书连接检测通过" : "检测到连接或配置异常",
            status: health.ok ? "正常" : "异常",
          },
          statusSyncInfo.lastFinishedAt && {
            id: `sync:${statusSyncInfo.lastFinishedAt}`,
            time: statusSyncInfo.lastFinishedAt,
            type: "同步",
            source: "数据服务",
            content: "胶板与油漆状态同步完成",
            status: statusSyncInfo.lastError ? "异常" : "成功",
          },
          ...Object.entries(health.checks || {})
            .filter(([, check]) => !check.ok)
            .map(([key, check]) => ({
              id: `health-check:${key}:${health.checkedAt}`,
              time: health.checkedAt,
              type: key === "websocket" ? "连接" : "检测",
              source:
                key === "board"
                  ? "胶板"
                  : key === "paint"
                    ? "油漆"
                    : key === "websocket"
                      ? "飞书接口"
                      : "监控中心",
              content: check.message || `${key}检测异常`,
              status: "异常",
            })),
        ].filter(Boolean);

        const realtimeLogs = [
          ...boardToday.events,
          ...paintToday.events,
          ...systemEvents,
        ]
          .sort((left, right) => Date.parse(right.time) - Date.parse(left.time))
          .slice(0, 8);

        res.json(successResponse({
          checkedAt: requestTime.toISOString(),
          range: { startDate: rangeStart, endDate: rangeEnd },
          configReady,
          health,
          personnel,
          today: { board: boardToday, paint: paintToday },
          ...(includePerformance
            ? { performance: { board: boardPerformance, paint: paintPerformance } }
            : {}),
          performanceIncluded: includePerformance,
          realtimeLogs,
          cache: {
            ...readFeishuCacheStatus(),
            forceRefreshRequested,
            forceRefreshApplied,
            forceRefreshCooldownMs,
          },
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DASHBOARD_QUERY_FAILED);
      }
    });
  }

  return { registerRoutes };
}
