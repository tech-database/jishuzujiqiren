export const adminLoginLimits = Object.freeze({
  maxFailures: 5,
  failureWindowMs: 10 * 60 * 1000,
  lockMs: 10 * 60 * 1000,
});

function normalizeIp(value) {
  const ip = String(value || "").trim();
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip || "unknown";
}

function isLoopbackIp(value) {
  const ip = normalizeIp(value);
  return ip === "127.0.0.1" || ip === "::1";
}

export function getRequestClientIp(req) {
  const remoteIp = normalizeIp(req?.socket?.remoteAddress || req?.connection?.remoteAddress);
  if (isLoopbackIp(remoteIp)) {
    const forwardedIp = String(req?.headers?.["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    if (forwardedIp) return normalizeIp(forwardedIp);
  }
  return remoteIp;
}

export class LoginAttemptLimiter {
  constructor({
    now = () => Date.now(),
    maxFailures = adminLoginLimits.maxFailures,
    failureWindowMs = adminLoginLimits.failureWindowMs,
    lockMs = adminLoginLimits.lockMs,
  } = {}) {
    this.now = now;
    this.maxFailures = maxFailures;
    this.failureWindowMs = failureWindowMs;
    this.lockMs = lockMs;
    this.attempts = new Map();
  }

  prune() {
    const now = this.now();
    for (const [key, state] of this.attempts) {
      const expiresAt = Math.max(
        Number(state.lockedUntil || 0),
        Number(state.lastFailureAt || 0) + this.failureWindowMs,
      );
      if (expiresAt <= now) this.attempts.delete(key);
    }
  }

  check(key) {
    this.prune();
    const state = this.attempts.get(String(key));
    const retryAfterMs = Math.max(0, Number(state?.lockedUntil || 0) - this.now());
    return {
      allowed: retryAfterMs === 0,
      retryAfterMs,
      remainingAttempts: Math.max(0, this.maxFailures - Number(state?.failures || 0)),
    };
  }

  recordFailure(key) {
    this.prune();
    const id = String(key);
    const now = this.now();
    const previous = this.attempts.get(id);
    const withinWindow =
      previous && now - Number(previous.lastFailureAt || 0) < this.failureWindowMs;
    const failures = (withinWindow ? Number(previous.failures || 0) : 0) + 1;
    const lockedUntil = failures >= this.maxFailures ? now + this.lockMs : 0;
    this.attempts.set(id, { failures, lastFailureAt: now, lockedUntil });
    return this.check(id);
  }

  recordSuccess(key) {
    this.attempts.delete(String(key));
  }
}
