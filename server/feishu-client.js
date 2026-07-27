import { feishuCache, feishuCacheTtl } from "./feishu-cache.js";
import { readRuntimeEnvValue } from "./runtime-config.js";

export const feishuRequestTimeoutMs = Object.freeze({
  standard: 180 * 1000,
  batchWrite: 300 * 1000,
  mediaUpload: 360 * 1000,
});

export function extractTextFromFeishuEvent(body) {
  const message = body?.event?.message || body?.event?.message_event?.message;
  if (!message) return "";
  if (message.message_type && message.message_type !== "text") {
    throw new Error(`当前只支持文字消息，收到的消息类型为：${message.message_type}。`);
  }
  const content =
    typeof message.content === "string" ? JSON.parse(message.content) : message.content;
  return content?.text || "";
}

export async function fetchFeishuJsonWithTimeout(
  url,
  options = {},
  timeoutMs = feishuRequestTimeoutMs.standard,
) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternalSignal = () => controller.abort(externalSignal.reason);
  if (externalSignal?.aborted) abortFromExternalSignal();
  else externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json();
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new Error(`飞书接口响应超时（${Math.ceil(timeoutMs / 1000)}秒），请重试`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

export async function getTenantAccessToken() {
  const appId = readRuntimeEnvValue("FEISHU_APP_ID") || "";
  const tokenInfo = await feishuCache.get(`token:${appId}`, {
    ttlMs: (value) => value.ttlMs,
    loader: async () => {
      const { response, data } = await fetchFeishuJsonWithTimeout(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: appId,
            app_secret: readRuntimeEnvValue("FEISHU_APP_SECRET"),
          }),
        },
      );
      if (!response.ok || data.code !== 0) {
        throw new Error("获取飞书访问凭证失败，请稍后重试。");
      }
      return {
        token: data.tenant_access_token,
        ttlMs: calculateTenantTokenTtlMs(data.expire),
      };
    },
  });
  return tokenInfo.token;
}

export function calculateTenantTokenTtlMs(expireSeconds) {
  const expiresMs = Number(expireSeconds) * 1000;
  if (!Number.isFinite(expiresMs) || expiresMs <= 0) return feishuCacheTtl.token;
  if (expiresMs <= feishuCacheTtl.tokenRefreshBuffer) {
    return Math.max(1000, Math.floor(expiresMs / 2));
  }
  return expiresMs - feishuCacheTtl.tokenRefreshBuffer;
}

export function invalidateTenantAccessTokenCache() {
  return feishuCache.invalidatePrefix("token:");
}

const invalidTenantTokenCodes = new Set([99991661, 99991663, 99991664]);

function hasInvalidTenantToken(response, data) {
  if (response.status === 401) return true;
  if (invalidTenantTokenCodes.has(Number(data?.code))) return true;
  return (
    /tenant[_ ]access[_ ]token/i.test(String(data?.msg || "")) &&
    /invalid|expired|expire|失效|过期/i.test(String(data?.msg || ""))
  );
}

export async function fetchFeishuJson(url, options = {}) {
  const { timeoutMs = feishuRequestTimeoutMs.standard, ...requestOptions } = options;
  const execute = async () => {
    const headers = new Headers(requestOptions.headers || {});
    headers.set("Authorization", `Bearer ${await getTenantAccessToken()}`);
    return fetchFeishuJsonWithTimeout(
      url,
      { ...requestOptions, headers },
      timeoutMs,
    );
  };

  let result = await execute();
  if (hasInvalidTenantToken(result.response, result.data)) {
    invalidateTenantAccessTokenCache();
    result = await execute();
  }
  return result;
}
