import { readFile, writeFile } from "node:fs/promises";
import { parse as parseDotenv } from "dotenv";
import {
  fetchFeishuJson,
  getTenantAccessToken,
} from "./feishu-client.js";
import {
  invalidateAllFeishuCaches,
} from "./bitable-client.js";
import {
  getBitableConfig,
  getConfigStatus,
} from "./runtime-config.js";
import { apiErrorCodes, sendError, successResponse } from "./api-response.js";

function publicConfig(readConfigStatus) {
  return {
    appId: process.env.FEISHU_APP_ID || "",
    appSecretSet: Boolean(process.env.FEISHU_APP_SECRET),
    bitableAppToken: process.env.FEISHU_BITABLE_APP_TOKEN || "",
    bitableTableId: process.env.FEISHU_BITABLE_TABLE_ID || "",
    paintBitableAppToken: process.env.FEISHU_PAINT_BITABLE_APP_TOKEN || "",
    paintBitableTableId: process.env.FEISHU_PAINT_BITABLE_TABLE_ID || "",
    quoteBitableAppToken: process.env.FEISHU_QUOTE_BITABLE_APP_TOKEN || "",
    quoteBitableTableId: process.env.FEISHU_QUOTE_BITABLE_TABLE_ID || "",
    replyEnabled: process.env.FEISHU_REPLY_ENABLED === "true",
    nameIdMap: readConfigStatus().nameIdMap || {},
  };
}

function buildRuntimeConfigEntries(config, port) {
  return {
    PORT: String(port),
    FEISHU_APP_ID: config.appId || "",
    FEISHU_APP_SECRET: config.appSecret || process.env.FEISHU_APP_SECRET || "",
    FEISHU_BITABLE_APP_TOKEN: config.bitableAppToken || "",
    FEISHU_BITABLE_TABLE_ID: config.bitableTableId || "",
    FEISHU_PAINT_BITABLE_APP_TOKEN: config.paintBitableAppToken || "",
    FEISHU_PAINT_BITABLE_TABLE_ID: config.paintBitableTableId || "",
    FEISHU_QUOTE_BITABLE_APP_TOKEN: config.quoteBitableAppToken || "",
    FEISHU_QUOTE_BITABLE_TABLE_ID: config.quoteBitableTableId || "",
    FIELD_MAP_JSON: JSON.stringify(config.fieldMap || {}),
    NAME_ID_MAP_JSON: JSON.stringify(config.nameIdMap || {}),
    FEISHU_REPLY_ENABLED: config.replyEnabled ? "true" : "false",
  };
}

function applyRuntimeConfig(entries, invalidateCaches) {
  for (const [key, value] of Object.entries(entries)) process.env[key] = value;
  invalidateCaches();
}

export function serializeEnv(entries) {
  return `${Object.entries(entries)
    .map(([key, value]) => `${key}='${String(value).replace(/\r?\n/g, "\\n").replace(/'/g, "\\'")}'`)
    .join("\n")}\n`;
}

async function readEnvEntries(envPath) {
  try {
    return parseDotenv(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

export function createConfigRoutes({
  envPath,
  port,
  configWritePassword,
  readAdminSession,
  requireAdminAccess,
  services = {},
} = {}) {
  const readConfigStatus = services.getConfigStatus || getConfigStatus;
  const readBitableConfig = services.getBitableConfig || getBitableConfig;
  const loadTenantAccessToken = services.getTenantAccessToken || getTenantAccessToken;
  const requestFeishuJson = services.fetchFeishuJson || fetchFeishuJson;
  const invalidateCaches = services.invalidateAllFeishuCaches || invalidateAllFeishuCaches;

  function assertConfigWritePassword(password) {
    if (String(password || "") !== configWritePassword) {
      const error = new Error("管理密码错误，未保存改动");
      error.statusCode = 401;
      throw error;
    }
  }

  function registerRoutes(app) {
    app.get("/api/config", (req, res) => {
      const adminAuthenticated = Boolean(readAdminSession(req));
      const config = adminAuthenticated
        ? publicConfig(readConfigStatus)
        : {
            appId: "",
            appSecretSet: Boolean(process.env.FEISHU_APP_SECRET),
            bitableAppToken: "",
            bitableTableId: "",
            paintBitableAppToken: "",
            paintBitableTableId: "",
            quoteBitableAppToken: "",
            quoteBitableTableId: "",
            replyEnabled: false,
            nameIdMap: {},
          };
      res.json(successResponse({ config, status: readConfigStatus(), adminAuthenticated }));
    });

    app.post("/api/config", requireAdminAccess, async (req, res) => {
      try {
        assertConfigWritePassword(req.body?.adminPassword);
        const entries = buildRuntimeConfigEntries(req.body || {}, port);
        const existingEntries = await readEnvEntries(envPath);
        await writeFile(envPath, serializeEnv({ ...existingEntries, ...entries }), "utf8");
        applyRuntimeConfig(entries, invalidateCaches);
        res.json(successResponse({
          config: publicConfig(readConfigStatus),
          status: readConfigStatus(),
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.CONFIG_SAVE_FAILED);
      }
    });

    app.post("/api/check-connection", requireAdminAccess, async (req, res) => {
      try {
        const token = await loadTenantAccessToken();
        const tableConfig = readBitableConfig(req.body?.tableKey);
        const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields?page_size=100`;
        const { response, data } = await requestFeishuJson(fieldsUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || data.code !== 0) {
          throw new Error(data.msg || response.statusText);
        }
        res.json(successResponse({
          message: "连接成功",
          table: tableConfig.key,
          fieldCount: data.data?.items?.length || 0,
          fields: (data.data?.items || []).map((field) => field.field_name),
        }));
      } catch (error) {
        sendError(res, error, apiErrorCodes.CONNECTION_CHECK_FAILED);
      }
    });
  }

  return { registerRoutes };
}
