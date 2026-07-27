import { readFileSync } from "node:fs";
import { parse as parseDotenv } from "dotenv";

const requiredConfig = [
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_BITABLE_APP_TOKEN",
  "FEISHU_BITABLE_TABLE_ID",
];

const tableDefinitions = {
  board: {
    label: "胶板",
    appTokenEnv: "FEISHU_BITABLE_APP_TOKEN",
    tableIdEnv: "FEISHU_BITABLE_TABLE_ID",
  },
  paint: {
    label: "油漆",
    appTokenEnv: "FEISHU_PAINT_BITABLE_APP_TOKEN",
    tableIdEnv: "FEISHU_PAINT_BITABLE_TABLE_ID",
  },
};

const envFileUrl = new URL("../.env", import.meta.url);

export function readRuntimeEnvValue(key) {
  try {
    const env = parseDotenv(readFileSync(envFileUrl));
    if (Object.prototype.hasOwnProperty.call(env, key)) return env[key];
  } catch {
    // Fall back to the process environment when the local .env file is unavailable.
  }
  return process.env[key];
}

function readJsonRuntimeEnvValue(key, fallback = {}) {
  const rawValue = readRuntimeEnvValue(key);
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue);
  } catch {
    try {
      return JSON.parse(rawValue.replace(/\\"/g, '"'));
    } catch {
      return fallback;
    }
  }
}

export function resolveTableKey(tableKey) {
  const text = String(tableKey || "").trim().toLowerCase();
  if (text === "paint" || text === "油漆") return "paint";
  return "board";
}

function getBitableTablesStatus() {
  return Object.fromEntries(
    Object.entries(tableDefinitions).map(([key, definition]) => [
      key,
      {
        label: definition.label,
        appTokenSet: Boolean(readRuntimeEnvValue(definition.appTokenEnv)),
        tableIdSet: Boolean(readRuntimeEnvValue(definition.tableIdEnv)),
        ready: Boolean(
          readRuntimeEnvValue(definition.appTokenEnv) &&
            readRuntimeEnvValue(definition.tableIdEnv),
        ),
      },
    ]),
  );
}

export function readFieldMap() {
  const parsed = readJsonRuntimeEnvValue("FIELD_MAP_JSON");
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

export function readNameIdMap() {
  try {
    const parsed = readJsonRuntimeEnvValue("NAME_ID_MAP_JSON");
    if (Array.isArray(parsed)) {
      return Object.fromEntries(
        parsed
          .map((item) => [
            String(item?.id || item?.userId || "").trim(),
            String(item?.name || "").trim(),
          ])
          .filter(([id, name]) => id && name),
      );
    }
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([id, name]) => [String(id || "").trim(), String(name || "").trim()])
        .filter(([id, name]) => id && name),
    );
  } catch {
    return {};
  }
}

export function getConfigStatus() {
  const missing = requiredConfig.filter((key) => !readRuntimeEnvValue(key));
  return {
    ready: missing.length === 0,
    missing,
    webhookPath: "/webhook/feishu",
    webhookEnabled: readRuntimeEnvValue("FEISHU_WEBHOOK_ENABLED") === "true",
    table: {
      appTokenSet: Boolean(readRuntimeEnvValue("FEISHU_BITABLE_APP_TOKEN")),
      tableIdSet: Boolean(readRuntimeEnvValue("FEISHU_BITABLE_TABLE_ID")),
    },
    tables: getBitableTablesStatus(),
    fieldMap: readFieldMap(),
    nameIdMap: readNameIdMap(),
    replyEnabled: readRuntimeEnvValue("FEISHU_REPLY_ENABLED") === "true",
  };
}

export function getBitableConfig(tableKey = "board") {
  const resolvedKey = resolveTableKey(tableKey);
  const definition = tableDefinitions[resolvedKey];
  const appToken = readRuntimeEnvValue(definition.appTokenEnv) || "";
  const tableId = readRuntimeEnvValue(definition.tableIdEnv) || "";
  if (!appToken || !tableId) {
    throw new Error(`${definition.label}多维表配置未填写完整`);
  }
  return {
    key: resolvedKey,
    label: definition.label,
    appToken,
    tableId,
  };
}

export function drawingTableKeys(tableKey) {
  return tableKey ? [resolveTableKey(tableKey)] : Object.keys(tableDefinitions);
}

export function ensureConfig() {
  const missing = requiredConfig.filter((key) => !readRuntimeEnvValue(key));
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

export function resolveDrawingOwnerValue(senderName, senderId, ownerType) {
  const cleanSenderId = String(senderId || "").trim();
  const cleanSenderName = String(senderName || "").trim();
  const mappedName = cleanSenderId
    ? String(readNameIdMap()[cleanSenderId] || "").trim()
    : "";
  if (mappedName) return mappedName;
  if (ownerType === 11 && cleanSenderId) return [{ id: cleanSenderId }];
  if (cleanSenderId) return cleanSenderId;
  return cleanSenderName;
}

export function resolveMappedOwnerName(ownerValue) {
  const cleanOwner = String(ownerValue || "").trim();
  if (!cleanOwner) return "";
  return String(readNameIdMap()[cleanOwner] || "").trim();
}
