const SENSITIVE_KEYS = new Set(["appSecret", "bitableAppToken", "paintBitableAppToken"]);

export function isSensitiveConfigKey(key) {
  return SENSITIVE_KEYS.has(key);
}

export function normalizeConfigSnapshot(config = {}) {
  return {
    appId: String(config.appId || ""),
    appSecret: String(config.appSecret || ""),
    appSecretSet: Boolean(config.appSecretSet),
    bitableAppToken: String(config.bitableAppToken || ""),
    bitableTableId: String(config.bitableTableId || ""),
    paintBitableAppToken: String(config.paintBitableAppToken || ""),
    paintBitableTableId: String(config.paintBitableTableId || ""),
    replyEnabled: Boolean(config.replyEnabled),
  };
}

export function isConfigDirty(current, baseline) {
  const currentSnapshot = normalizeConfigSnapshot(current);
  const baselineSnapshot = normalizeConfigSnapshot(baseline);
  return Object.keys(currentSnapshot).some((key) => currentSnapshot[key] !== baselineSnapshot[key]);
}

export function validateConnectionConfig(config = {}) {
  const errors = {};
  const requiredKeys = [
    ["appId", "App ID"],
    ["bitableAppToken", "胶板 App Token"],
    ["bitableTableId", "胶板 Table ID"],
  ];

  for (const [key, label] of requiredKeys) {
    if (!String(config[key] || "").trim()) {
      errors[key] = `${label} 不能为空。`;
    }
  }

  if (!config.appSecretSet && !String(config.appSecret || "").trim()) {
    errors.appSecret = "首次配置需要填写 App Secret。";
  }

  return errors;
}

export function maskSensitiveValue(value, visibleTail = 4) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= visibleTail) return "••••";
  return `${"•".repeat(8)}${text.slice(-visibleTail)}`;
}
