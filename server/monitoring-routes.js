import { apiErrorCodes, sendError, successResponse } from "./api-response.js";

export function createMonitoringRoutes({
  buildHealthStatus,
  getConfigStatus,
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
  }

  return { registerRoutes };
}
