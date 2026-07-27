export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function requestJson(path, options = {}) {
  const { body, headers, ...requestOptions } = options;
  const hasJsonBody = body != null && !(body instanceof ArrayBuffer) && !(body instanceof FormData);
  const response = await fetch(path, {
    ...requestOptions,
    headers: hasJsonBody
      ? { "Content-Type": "application/json", ...headers }
      : headers,
    body: hasJsonBody ? JSON.stringify(body) : body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || response.statusText || "请求失败", {
      status: response.status,
      data,
    });
  }
  return data;
}

export function getJson(path, options) {
  return requestJson(path, { ...options, method: "GET" });
}

export function postJson(path, body, options) {
  return requestJson(path, { ...options, method: "POST", body });
}

export function postBinary(path, body, options) {
  return requestJson(path, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...options?.headers },
    body,
  });
}
