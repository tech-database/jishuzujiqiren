import { apiErrorCodes, sendError, successResponse } from "./api-response.js";
import { queryQuoteDashboard } from "./quote-dashboard-service.js";

export function createQuoteDashboardRoutes({ services = {}, now = () => new Date() } = {}) {
  const loadQuoteDashboard = services.queryQuoteDashboard || queryQuoteDashboard;

  function registerRoutes(app) {
    app.get("/api/quote-dashboard/initial", async (req, res) => {
      try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
        const requestTime = now();
        const [today, month] = await Promise.all([
          loadQuoteDashboard({
            now: requestTime,
            startDate: req.query.today,
            endDate: req.query.today,
          }),
          loadQuoteDashboard({
            now: requestTime,
            startDate: req.query.monthStartDate,
            endDate: req.query.monthEndDate,
          }),
        ]);
        res.json(successResponse({
          checkedAt: requestTime.toISOString(),
          today,
          month,
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DASHBOARD_QUERY_FAILED);
      }
    });

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
