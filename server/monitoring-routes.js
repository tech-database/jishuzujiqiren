import { apiErrorCodes, sendError, successResponse } from "./api-response.js";

export function createMonitoringRoutes({
  buildHealthStatus,
  getConfigStatus,
  loadRuntimeLogs,
  requireAdminAccess,
  statusSyncInfo,
} = {}) {
  function registerRoutes(app) {
    app.get("/api/status", (_req, res) => {
      res.json(successResponse({ status: getConfigStatus() }));
    });

    app.get("/api/health", async (_req, res) => {
      try {
        const health = await buildHealthStatus();
        res
          .status(health.ok ? 200 : 503)
          .json(successResponse({ health }, { code: health.ok ? "HEALTHY" : "HEALTH_UNHEALTHY" }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.HEALTH_CHECK_FAILED, 500);
      }
    });

    app.get("/api/background-status-sync", (_req, res) => {
      res.json(successResponse({ status: statusSyncInfo }));
    });

    app.get("/api/admin/runtime-logs", requireAdminAccess, async (req, res) => {
      try {
        const result = await loadRuntimeLogs({ limit: req.query?.limit });
        res.json(successResponse(result));
      } catch (error) {
        sendError(
          res,
          new Error("机器人日志读取失败，请检查服务器日志文件权限。", { cause: error }),
          apiErrorCodes.RUNTIME_LOGS_FAILED,
          500,
        );
      }
    });
  }

  return { registerRoutes };
}
