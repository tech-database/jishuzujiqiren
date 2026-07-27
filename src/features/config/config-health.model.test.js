import assert from "node:assert/strict";
import test from "node:test";
import {
  healthFromError,
  healthFromResponse,
} from "./config-health.model.js";

test("keeps a successful backend health result unchanged", () => {
  const health = { ok: true, checks: { feishu: { ok: true } } };
  assert.equal(healthFromResponse({ ok: true, health }), health);
});

test("normalizes API and network health failures", () => {
  const checkedAt = "2026-07-27T08:00:00.000Z";
  assert.equal(
    healthFromResponse({ ok: false, error: "检查失败" }, checkedAt).checks.error.message,
    "检查失败",
  );
  assert.equal(
    healthFromError(new Error("网络断开"), checkedAt).checks.network.message,
    "网络断开",
  );
});
