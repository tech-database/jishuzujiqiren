import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  LoginAttemptLimiter,
  getRequestClientIp,
} from "./login-attempt-limiter.js";
import { ApiError, apiErrorCodes, sendError, successResponse } from "./api-response.js";

const defaultSessionCookie = "tech_admin_session";
const defaultSessionTtlMs = 8 * 60 * 60 * 1000;

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((entry) => entry.trim().split("="))
      .filter(([key]) => key)
      .map(([key, ...value]) => [decodeURIComponent(key), decodeURIComponent(value.join("="))]),
  );
}

function securePasswordEquals(candidate, expected) {
  const left = createHash("sha256").update(String(candidate || "")).digest();
  const right = createHash("sha256").update(String(expected || "")).digest();
  return timingSafeEqual(left, right);
}

export function createAdminAccess({
  password,
  sessionCookie = defaultSessionCookie,
  sessionTtlMs = defaultSessionTtlMs,
  loginLimiter = new LoginAttemptLimiter(),
} = {}) {
  const sessions = new Map();

  function readAdminSession(req) {
    const token = parseCookies(req.headers.cookie)[sessionCookie];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return { token, ...session };
  }

  function adminCookie(req, token, maxAgeSeconds) {
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
    return [
      `${sessionCookie}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${maxAgeSeconds}`,
      secure ? "Secure" : "",
    ].filter(Boolean).join("; ");
  }

  function requireAdminAccess(req, res, next) {
    if (readAdminSession(req)) {
      next();
      return;
    }
    sendError(
      res,
      new ApiError(apiErrorCodes.ADMIN_REQUIRED, "需要管理员权限", { statusCode: 401 }),
      apiErrorCodes.ADMIN_REQUIRED,
      401,
    );
  }

  function registerRoutes(app) {
    app.get("/api/admin/session", (req, res) => {
      const session = readAdminSession(req);
      res.json(successResponse({
        authenticated: Boolean(session),
        expiresAt: session?.expiresAt || null,
      }));
    });

    app.post("/api/admin/login", (req, res) => {
      const clientIp = getRequestClientIp(req);
      const currentLimit = loginLimiter.check(clientIp);
      if (!currentLimit.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil(currentLimit.retryAfterMs / 1000));
        res.setHeader("Retry-After", String(retryAfterSeconds));
        sendError(
          res,
          new ApiError(
            apiErrorCodes.ADMIN_RATE_LIMITED,
            `管理员登录失败次数过多，请在 ${Math.ceil(retryAfterSeconds / 60)} 分钟后重试`,
            { statusCode: 429, details: { retryAfterSeconds } },
          ),
          apiErrorCodes.ADMIN_RATE_LIMITED,
          429,
        );
        return;
      }
      if (!securePasswordEquals(req.body?.password, password)) {
        const failedLimit = loginLimiter.recordFailure(clientIp);
        if (!failedLimit.allowed) {
          const retryAfterSeconds = Math.max(1, Math.ceil(failedLimit.retryAfterMs / 1000));
          res.setHeader("Retry-After", String(retryAfterSeconds));
          sendError(
            res,
            new ApiError(
              apiErrorCodes.ADMIN_RATE_LIMITED,
              "管理员登录连续失败 5 次，已锁定 10 分钟",
              { statusCode: 429, details: { retryAfterSeconds } },
            ),
            apiErrorCodes.ADMIN_RATE_LIMITED,
            429,
          );
          return;
        }
        sendError(
          res,
          new ApiError(
            apiErrorCodes.ADMIN_LOGIN_FAILED,
            `管理员验证失败，还可尝试 ${failedLimit.remainingAttempts} 次`,
            {
              statusCode: 401,
              details: { remainingAttempts: failedLimit.remainingAttempts },
            },
          ),
          apiErrorCodes.ADMIN_LOGIN_FAILED,
          401,
        );
        return;
      }
      loginLimiter.recordSuccess(clientIp);
      const token = randomBytes(32).toString("base64url");
      const expiresAt = Date.now() + sessionTtlMs;
      sessions.set(token, { expiresAt });
      res.setHeader("Set-Cookie", adminCookie(req, token, Math.floor(sessionTtlMs / 1000)));
      res.json(successResponse({ authenticated: true, expiresAt }));
    });

    app.post("/api/admin/logout", (req, res) => {
      const session = readAdminSession(req);
      if (session) sessions.delete(session.token);
      res.setHeader("Set-Cookie", adminCookie(req, "", 0));
      res.json(successResponse({ authenticated: false }));
    });
  }

  return {
    readAdminSession,
    registerRoutes,
    requireAdminAccess,
  };
}
