import { apiErrorCodes, sendError, successResponse } from "./api-response.js";
import { queryQuoteDashboard } from "./quote-dashboard-service.js";

export function createQuoteDashboardRoutes({ services = {}, now = () => new Date() } = {}) {
  const loadQuoteDashboard = services.queryQuoteDashboard || queryQuoteDashboard;

  function registerRoutes(app) {
    app.get("/api/quote-dashboard", async (req, res) => {
      try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
        res.json(successResponse(await loadQuoteDashboard({
          now: now(),
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        })));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DASHBOARD_QUERY_FAILED);
      }
    });
  }

  return { registerRoutes };
}
