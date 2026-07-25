import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTenantTokenTtlMs,
  fetchFeishuJsonWithTimeout,
  fetchFeishuJson,
  feishuRequestTimeoutMs,
  invalidateAllFeishuCaches,
} from "./bot-core.js";
import { feishuCacheTtl } from "./feishu-cache.js";

test("calculates token TTL from Feishu expire with a five-minute refresh buffer", () => {
  assert.equal(calculateTenantTokenTtlMs(7200), 115 * 60 * 1000);
  assert.equal(calculateTenantTokenTtlMs(240), 120 * 1000);
  assert.equal(calculateTenantTokenTtlMs(undefined), feishuCacheTtl.token);
});

test("refreshes an invalid tenant token and retries the Feishu request once", async () => {
  const originalFetch = globalThis.fetch;
  let tokenRequests = 0;
  let apiRequests = 0;
  const authorizations = [];
  invalidateAllFeishuCaches();

  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("/tenant_access_token/internal")) {
      tokenRequests += 1;
      return Response.json({
        code: 0,
        tenant_access_token: tokenRequests === 1 ? "token-old" : "token-new",
        expire: 7200,
      });
    }

    apiRequests += 1;
    const authorization = new Headers(options.headers || {}).get("Authorization");
    authorizations.push(authorization);
    if (authorization === "Bearer token-old") {
      return Response.json({ code: 99991663, msg: "tenant access token invalid" });
    }
    return Response.json({ code: 0, data: { ok: true } });
  };

  try {
    const { data } = await fetchFeishuJson("https://open.feishu.cn/open-apis/mock");
    assert.deepEqual(data, { code: 0, data: { ok: true } });
    assert.equal(tokenRequests, 2);
    assert.equal(apiRequests, 2);
    assert.deepEqual(authorizations, ["Bearer token-old", "Bearer token-new"]);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAllFeishuCaches();
  }
});

test("aborts an unresponsive Feishu request after its configured timeout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options = {}) =>
    new Promise((resolve, reject) => {
      options.signal?.addEventListener(
        "abort",
        () => reject(options.signal.reason || new Error("aborted")),
        { once: true },
      );
    });

  try {
    await assert.rejects(
      fetchFeishuJsonWithTimeout("https://open.feishu.cn/open-apis/mock", {}, 10),
      /飞书接口响应超时（1秒），请重试/,
    );
    assert.deepEqual(feishuRequestTimeoutMs, {
      standard: 180 * 1000,
      batchWrite: 300 * 1000,
      mediaUpload: 360 * 1000,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
