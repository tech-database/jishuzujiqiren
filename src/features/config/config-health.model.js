export function healthFromResponse(data, checkedAt = new Date().toISOString()) {
  if (data.ok) return data.health;
  return {
    ok: false,
    label: "飞书连接异常",
    checkedAt,
    checks: {
      error: {
        ok: false,
        message: data.error || "健康检查失败",
      },
    },
  };
}

export function healthFromError(error, checkedAt = new Date().toISOString()) {
  return {
    ok: false,
    label: "飞书连接异常",
    checkedAt,
    checks: {
      network: {
        ok: false,
        message: error?.message || "网络连接失败",
      },
    },
  };
}
