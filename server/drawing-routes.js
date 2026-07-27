import {
  claimDrawingOwners,
  completeDrawings,
  confirmDrawingOrders,
  extractMaterialCodes,
  queryDrawingAnalytics,
  queryDrawingClaimStatus,
  queryDrawingOwnerStats,
  queryUnclaimedDrawings,
  recalculateDrawingDurations,
} from "./bot-core.js";
import { ApiError, apiErrorCodes, sendError, successResponse } from "./api-response.js";

function materialCodesFromRequest(body) {
  return Array.isArray(body?.materialCodes) && body.materialCodes.length > 0
    ? body.materialCodes
    : extractMaterialCodes(body?.text || "");
}

export function createDrawingRoutes({
  readAdminSession,
  runStatusSync,
  refreshBackgroundFingerprint,
  services = {},
} = {}) {
  const claimOwners = services.claimDrawingOwners || claimDrawingOwners;
  const completeDrawingRecords = services.completeDrawings || completeDrawings;
  const confirmOrders = services.confirmDrawingOrders || confirmDrawingOrders;
  const loadDrawingAnalytics = services.queryDrawingAnalytics || queryDrawingAnalytics;
  const loadDrawingClaimStatus =
    services.queryDrawingClaimStatus || queryDrawingClaimStatus;
  const loadDrawingOwnerStats =
    services.queryDrawingOwnerStats || queryDrawingOwnerStats;
  const loadUnclaimedDrawings =
    services.queryUnclaimedDrawings || queryUnclaimedDrawings;
  const recalculateDurations =
    services.recalculateDrawingDurations || recalculateDrawingDurations;

  function registerRoutes(app) {
    app.post("/api/claim-drawing", async (req, res) => {
      try {
        const result = await claimOwners({
          materialCodes: materialCodesFromRequest(req.body),
          senderName: req.body?.senderName,
          senderId: req.body?.senderId,
          tableKey: req.body?.tableKey,
        });
        res.json(successResponse({
          count: result.length,
          materialCodes: [...new Set(result.map((item) => item.materialCode))],
          result,
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_CLAIM_FAILED);
      }
    });

    app.post("/api/complete-drawing", async (req, res) => {
      try {
        if (!readAdminSession(req)) {
          throw new ApiError(
            apiErrorCodes.ADMIN_REQUIRED,
            "管理员网页代完成需要先通过管理员密码验证",
            { statusCode: 403 },
          );
        }
        const result = await completeDrawingRecords({
          materialCodes: materialCodesFromRequest(req.body),
          tableKey: req.body?.tableKey,
          allowOwnerOverride: true,
        });
        const updated = result.filter((item) => item.changed);
        const alreadyCompleted = result.filter((item) => !item.changed);
        const adminOverrides = updated.filter((item) => item.adminOverride);
        res.json(successResponse({
          count: updated.length,
          matchedCount: result.length,
          alreadyCompletedCount: alreadyCompleted.length,
          adminOverrideCount: adminOverrides.length,
          warning:
            adminOverrides.length > 0
              ? `管理员已代为完成 ${adminOverrides.length} 条图纸`
              : "",
          materialCodes: [...new Set(result.map((item) => item.materialCode))],
          result,
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_COMPLETE_FAILED);
      }
    });

    app.post("/api/confirm-orders", async (req, res) => {
      try {
        const { result, missing } = await confirmOrders({
          materialCodes: materialCodesFromRequest(req.body),
          tableKey: req.body?.tableKey,
        });
        const updated = result.filter((item) => item.changed);
        const alreadyConfirmed = result.filter((item) => !item.changed);
        res.json(successResponse({
          count: updated.length,
          matchedCount: result.length,
          alreadyConfirmedCount: alreadyConfirmed.length,
          materialCodes: [...new Set(result.map((item) => item.materialCode))],
          missing,
          result,
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.ORDER_CONFIRMATION_FAILED);
      }
    });

    app.post("/api/query-drawing-claims", async (req, res) => {
      try {
        const result = await loadDrawingClaimStatus({
          materialCodes: materialCodesFromRequest(req.body),
          tableKey: req.body?.tableKey,
        });
        res.json(successResponse(result));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_QUERY_FAILED);
      }
    });

    app.post("/api/query-unclaimed-drawings", async (req, res) => {
      try {
        const result = await loadUnclaimedDrawings({ tableKey: req.body?.tableKey });
        res.json(successResponse(result));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_QUERY_FAILED);
      }
    });

    app.get("/api/drawing-owner-stats", async (req, res) => {
      try {
        const result = await loadDrawingOwnerStats({ tableKey: req.query.tableKey });
        res.json(successResponse(result));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_QUERY_FAILED);
      }
    });

    app.get("/api/drawing-analytics", async (req, res) => {
      try {
        const result = await loadDrawingAnalytics({
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          tableKey: req.query.tableKey,
        });
        res.json(successResponse(result));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_QUERY_FAILED);
      }
    });

    app.post("/api/sync-drawing-statuses", async (req, res) => {
      try {
        const manualRange = {
          startDate: req.body?.startDate,
          endDate: req.body?.endDate,
          tableKey: req.body?.tableKey,
        };
        const result = await runStatusSync("manual", manualRange);
        try {
          await refreshBackgroundFingerprint(manualRange.tableKey || "board");
        } catch {
          // A failed fingerprint refresh should not turn a completed manual sync into a failed request.
        }
        res.json(successResponse(result));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_STATUS_SYNC_FAILED);
      }
    });

    app.post("/api/recalculate-drawing-durations", async (req, res) => {
      try {
        const result = await recalculateDurations({
          startDate: req.body?.startDate,
          endDate: req.body?.endDate,
          tableKey: req.body?.tableKey,
        });
        res.json(successResponse(result));
      } catch (error) {
        sendError(res, error, apiErrorCodes.DRAWING_DURATION_RECALC_FAILED);
      }
    });
  }

  return { registerRoutes };
}
