export const apiErrorCodes = Object.freeze({
  ADMIN_REQUIRED: "ADMIN_REQUIRED",
  ADMIN_LOGIN_FAILED: "ADMIN_LOGIN_FAILED",
  ADMIN_RATE_LIMITED: "ADMIN_RATE_LIMITED",
  CONFIG_SAVE_FAILED: "CONFIG_SAVE_FAILED",
  CONNECTION_CHECK_FAILED: "CONNECTION_CHECK_FAILED",
  DRAWING_CLAIM_FAILED: "DRAWING_CLAIM_FAILED",
  DRAWING_COMPLETE_FAILED: "DRAWING_COMPLETE_FAILED",
  DRAWING_QUERY_FAILED: "DRAWING_QUERY_FAILED",
  DRAWING_STATUS_SYNC_FAILED: "DRAWING_STATUS_SYNC_FAILED",
  DRAWING_DURATION_RECALC_FAILED: "DRAWING_DURATION_RECALC_FAILED",
  ORDER_CONFIRMATION_FAILED: "ORDER_CONFIRMATION_FAILED",
  SPREADSHEET_IMPORT_FAILED: "SPREADSHEET_IMPORT_FAILED",
  QUOTE_STATISTICS_FAILED: "QUOTE_STATISTICS_FAILED",
  DASHBOARD_QUERY_FAILED: "DASHBOARD_QUERY_FAILED",
  HEALTH_CHECK_FAILED: "HEALTH_CHECK_FAILED",
  WEBHOOK_DISABLED: "WEBHOOK_DISABLED",
  WEBHOOK_TOKEN_INVALID: "WEBHOOK_TOKEN_INVALID",
  WEBHOOK_PROCESSING_FAILED: "WEBHOOK_PROCESSING_FAILED",
});

export class ApiError extends Error {
  constructor(code, message, { statusCode = 400, details, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function successResponse(data = {}, { code = "OK", message = "" } = {}) {
  const normalizedData = data && typeof data === "object" && !Array.isArray(data)
    ? data
    : { value: data };
  return {
    ok: true,
    code,
    message,
    data: normalizedData,
    ...normalizedData,
  };
}

export function errorResponse(error, fallbackCode, fallbackStatus = 400) {
  const normalizedError = error instanceof Error ? error : new Error(String(error || "请求失败"));
  const message = normalizedError.message || "请求失败";
  return {
    status: normalizedError.statusCode || fallbackStatus,
    body: {
      ok: false,
      code: normalizedError.code || fallbackCode,
      message,
      error: message,
      details: normalizedError.details || null,
      data: null,
      ...(normalizedError.details &&
      typeof normalizedError.details === "object" &&
      !Array.isArray(normalizedError.details)
        ? normalizedError.details
        : {}),
    },
  };
}

export function sendError(res, error, fallbackCode, fallbackStatus = 400) {
  const { status, body } = errorResponse(error, fallbackCode, fallbackStatus);
  return res.status(status).json(body);
}
