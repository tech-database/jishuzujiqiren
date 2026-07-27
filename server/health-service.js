import { readFile } from "node:fs/promises";
import { getTenantAccessToken } from "./feishu-client.js";
import { getBitableFieldMap } from "./bitable-client.js";
import {
  getBitableConfig,
  getConfigStatus,
} from "./runtime-config.js";

export function createHealthService({
  websocketStatusPath,
  services = {},
  now = () => Date.now(),
} = {}) {
  const readConfigStatus = services.getConfigStatus || getConfigStatus;
  const loadTenantAccessToken = services.getTenantAccessToken || getTenantAccessToken;
  const readBitableConfig = services.getBitableConfig || getBitableConfig;
  const readBitableFieldMap = services.getBitableFieldMap || getBitableFieldMap;
  const readStatusFile = services.readFile || readFile;
  const isLongConnectionServerHosted =
    services.isLongConnectionServerHosted ||
    (() => process.env.FEISHU_LONG_CONNECTION_ENABLED === "false");

  async function checkBitableTable(token, tableKey) {
    const tableConfig = readBitableConfig(tableKey);
    const fields = await readBitableFieldMap(token, tableConfig);
    return {
      ok: true,
      table: tableConfig.key,
      label: tableConfig.label,
      fieldCount: fields.size,
    };
  }

  async function readWebsocketHealth() {
    if (isLongConnectionServerHosted()) {
      return {
        ok: true,
        message: "飞书长连接由服务器托管",
      };
    }

    try {
      const status = JSON.parse(await readStatusFile(websocketStatusPath, "utf8"));
      const updatedAt = new Date(status.updatedAt).getTime();
      const stale = !updatedAt || now() - updatedAt > 45000;
      if (stale) {
        return {
          ok: false,
          message: "飞书长连接心跳超时",
        };
      }
      return {
        ok: Boolean(status.connected),
        message: status.message || (status.connected ? "飞书长连接已连接" : "飞书长连接未连接"),
      };
    } catch (error) {
      return {
        ok: false,
        message: `未读取到飞书长连接心跳：${error.message}`,
      };
    }
  }

  async function buildHealthStatus() {
    const configReady = readConfigStatus().ready;
    const checks = {
      config: { ok: configReady, message: configReady ? "配置已加载" : "配置缺失" },
      feishu: { ok: false, message: "" },
      board: { ok: false, message: "" },
      paint: { ok: false, message: "" },
      websocket: { ok: false, message: "" },
    };

    let token = "";
    try {
      token = await loadTenantAccessToken();
      checks.feishu = { ok: true, message: "飞书凭证有效" };
    } catch (error) {
      checks.feishu = { ok: false, message: error.message };
    }

    if (token) {
      for (const tableKey of ["board", "paint"]) {
        try {
          const result = await checkBitableTable(token, tableKey);
          checks[tableKey] = {
            ok: true,
            message: `${result.label}表正常，${result.fieldCount} 个字段`,
          };
        } catch (error) {
          checks[tableKey] = { ok: false, message: error.message };
        }
      }
    }

    checks.websocket = await readWebsocketHealth();

    const ok = Object.values(checks).every((item) => item.ok);
    return {
      ok,
      label: ok ? "飞书连接正常" : "飞书连接异常",
      checkedAt: new Date(now()).toISOString(),
      checks,
    };
  }

  return {
    buildHealthStatus,
    readWebsocketHealth,
  };
}
