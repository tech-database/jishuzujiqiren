import assert from "node:assert/strict";
import test from "node:test";
import {
  LoginAttemptLimiter,
  getRequestClientIp,
} from "./login-attempt-limiter.js";

test("locks one IP for ten minutes after five consecutive failures", () => {
  let now = 1000;
  const limiter = new LoginAttemptLimiter({ now: () => now });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = limiter.recordFailure("10.0.0.1");
    assert.equal(result.allowed, true);
    assert.equal(result.remainingAttempts, 5 - attempt);
  }
  const locked = limiter.recordFailure("10.0.0.1");
  assert.equal(locked.allowed, false);
  assert.equal(locked.retryAfterMs, 10 * 60 * 1000);

  now += 10 * 60 * 1000 + 1;
  assert.equal(limiter.check("10.0.0.1").allowed, true);
});

test("a successful login clears previous failures", () => {
  const limiter = new LoginAttemptLimiter();
  limiter.recordFailure("10.0.0.2");
  limiter.recordFailure("10.0.0.2");
  limiter.recordSuccess("10.0.0.2");

  const result = limiter.check("10.0.0.2");
  assert.equal(result.allowed, true);
  assert.equal(result.remainingAttempts, 5);
});

test("different IP addresses are limited independently", () => {
  const limiter = new LoginAttemptLimiter();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    limiter.recordFailure("10.0.0.3");
  }
  assert.equal(limiter.check("10.0.0.3").allowed, false);
  assert.equal(limiter.check("10.0.0.4").allowed, true);
});

test("uses a proxy header only when the direct connection is local", () => {
  assert.equal(
    getRequestClientIp({
      socket: { remoteAddress: "::1" },
      headers: { "x-forwarded-for": "203.0.113.10, 127.0.0.1" },
    }),
    "203.0.113.10",
  );
  assert.equal(
    getRequestClientIp({
      socket: { remoteAddress: "198.51.100.8" },
      headers: { "x-forwarded-for": "203.0.113.11" },
    }),
    "198.51.100.8",
  );
});
