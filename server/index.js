import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { parse as parseDotenv } from "dotenv";
import {
  formatShanghaiDate,
  millisecondsUntilNextShanghaiHour,
  parseShanghaiDateBoundary,
  recentShanghaiDateRange,
} from "./date-range.js";
import {
  LoginAttemptLimiter,
  getRequestClientIp,
} from "./login-attempt-limiter.js";
import {
  claimDrawingOwners,
  completeDrawings,
  confirmDrawingOrders,
  createBitableRecords,
  extractMaterialCodes,
  extractTextFromFeishuEvent,
  fetchFeishuJson,
  getBitableConfig,
  getConfigStatus,
  getDrawingStatusFingerprint,
  getFeishuCacheStatus,
  getBitableFieldMap,
  getTenantAccessToken,
  invalidateAllFeishuCaches,
  invalidateBitableRecordCache,
  parseSpreadsheetBuffer,
  queryDrawingClaimStatus,
  queryDrawingAnalytics,
  queryHomeDashboardTable,
  queryDrawingOwnerStats,
  queryUnclaimedDrawings,
  recalculateDrawingDurations,
  refreshDrawingOwnerRoster,
  syncDrawingStatuses,
  writeFromText,
} from "./bot-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const app = express();
const port = Number(process.env.PORT || 8787);
const envPath = path.join(rootDir, ".env");
const statusSyncIntervalMs = Number(process.env.STATUS_SYNC_INTERVAL_MS || 10000);
const dailyFullStatusSyncHour = Math.min(
  23,
  Math.max(0, Math.floor(Number(process.env.DAILY_FULL_STATUS_SYNC_HOUR ?? 2) || 0)),
);
const feishuWebhookEnabled = process.env.FEISHU_WEBHOOK_ENABLED === "true";
const websocketStatusPath = path.join(__dirname, ".runtime", "long-connection-status.json");
const configWritePassword = process.env.CONFIG_WRITE_PASSWORD || "888888";
const adminAccessPassword = process.env.ADMIN_ACCESS_PASSWORD || "888000";
const adminSessionCookie = "tech_admin_session";
const adminSessionTtlMs = 8 * 60 * 60 * 1000;
const adminSessions = new Map();
const adminLoginLimiter = new LoginAttemptLimiter();
const statusSyncRunningTables = new Set();
let backgroundStatusCheckRunning = false;
let lastDashboardForceRefreshAt = 0;
const dashboardForceRefreshCooldownMs = 15000;
const lastBackgroundFingerprints = {};
const serverStartedAt = new Date().toISOString();
const statusSyncInfo = {
  enabled: true,
  mode: "on_change",
  intervalMs: statusSyncIntervalMs,
  running: false,
  lastReason: "",
  lastCheckedAt: "",
  lastChangedAt: "",
  lastSkippedAt: "",
  lastStartedAt: "",
  lastFinishedAt: "",
  lastError: "",
  lastSummary: null,
  skippedCount: 0,
  dailyFull: {
    hour: dailyFullStatusSyncHour,
    lastStartedAt: "",
    lastFinishedAt: "",
    lastError: "",
    summaries: {},
  },
  tables: {},
};

function getTableSyncInfo(tableKey) {
  if (!statusSyncInfo.tables[tableKey]) {
    statusSyncInfo.tables[tableKey] = {
      running: false,
      range: null,
      lastReason: "",
      lastCheckedAt: "",
      lastChangedAt: "",
      lastSkippedAt: "",
      lastStartedAt: "",
      lastFinishedAt: "",
      lastError: "",
      lastSummary: null,
      skippedCount: 0,
    };
  }
  return statusSyncInfo.tables[tableKey];
}

const localCorsOrigins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || localCorsOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "2mb" }));

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((entry) => entry.trim().split("="))
      .filter(([key]) => key)
      .map(([key, ...value]) => [decodeURIComponent(key), decodeURIComponent(value.join("="))]),
  );
}

function securePasswordEquals(candidate, expected) {
  const left = createHash("sha256").update(String(candidate || "")).digest();
  const right = createHash("sha256").update(String(expected || "")).digest();
  return timingSafeEqual(left, right);
}

function readAdminSession(req) {
  const token = parseCookies(req.headers.cookie)[adminSessionCookie];
  if (!token) return null;
  const session = adminSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function adminCookie(req, token, maxAgeSeconds) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return [
    `${adminSessionCookie}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function requireAdminAccess(req, res, next) {
  if (readAdminSession(req)) {
    next();
    return;
  }
  res.status(401).json({ ok: false, error: "需要管理员权限" });
}

app.get("/api/admin/session", (req, res) => {
  const session = readAdminSession(req);
  res.json({ ok: true, authenticated: Boolean(session), expiresAt: session?.expiresAt || null });
});

app.post("/api/admin/login", (req, res) => {
  const clientIp = getRequestClientIp(req);
  const currentLimit = adminLoginLimiter.check(clientIp);
  if (!currentLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(currentLimit.retryAfterMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      ok: false,
      error: `管理员登录失败次数过多，请在 ${Math.ceil(retryAfterSeconds / 60)} 分钟后重试`,
      retryAfterSeconds,
    });
    return;
  }
  if (!securePasswordEquals(req.body?.password, adminAccessPassword)) {
    const failedLimit = adminLoginLimiter.recordFailure(clientIp);
    if (!failedLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(failedLimit.retryAfterMs / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        ok: false,
        error: "管理员登录连续失败 5 次，已锁定 10 分钟",
        retryAfterSeconds,
      });
      return;
    }
    res.status(401).json({
      ok: false,
      error: `管理员验证失败，还可尝试 ${failedLimit.remainingAttempts} 次`,
    });
    return;
  }
  adminLoginLimiter.recordSuccess(clientIp);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + adminSessionTtlMs;
  adminSessions.set(token, { expiresAt });
  res.setHeader("Set-Cookie", adminCookie(req, token, Math.floor(adminSessionTtlMs / 1000)));
  res.json({ ok: true, authenticated: true, expiresAt });
});

app.post("/api/admin/logout", (req, res) => {
  const session = readAdminSession(req);
  if (session) adminSessions.delete(session.token);
  res.setHeader("Set-Cookie", adminCookie(req, "", 0));
  res.json({ ok: true, authenticated: false });
});

function parseDashboardDate(value, fallback) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback;
  return parseShanghaiDateBoundary(text) === null ? fallback : text;
}

function defaultStatusDateRange() {
  return recentShanghaiDateRange(7);
}

async function replyToMessage(messageId, text) {
  if (process.env.FEISHU_REPLY_ENABLED !== "true" || !messageId) return;
  const token = await getTenantAccessToken();
  await fetchFeishuJson(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  });
}

async function checkBitableTable(token, tableKey) {
  const tableConfig = getBitableConfig(tableKey);
  const fields = await getBitableFieldMap(token, tableConfig);
  return {
    ok: true,
    table: tableConfig.key,
    label: tableConfig.label,
    fieldCount: fields.size,
  };
}

async function readWebsocketHealth() {
  if (process.env.FEISHU_LONG_CONNECTION_ENABLED === "false") {
    return {
      ok: true,
      message: "飞书长连接由服务器托管",
    };
  }

  try {
    const status = JSON.parse(await readFile(websocketStatusPath, "utf8"));
    const updatedAt = new Date(status.updatedAt).getTime();
    const stale = !updatedAt || Date.now() - updatedAt > 45000;
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
  const checks = {
    config: { ok: getConfigStatus().ready, message: getConfigStatus().ready ? "配置已加载" : "配置缺失" },
    feishu: { ok: false, message: "" },
    board: { ok: false, message: "" },
    paint: { ok: false, message: "" },
    websocket: { ok: false, message: "" },
  };

  let token = "";
  try {
    token = await getTenantAccessToken();
    checks.feishu = { ok: true, message: "飞书凭证有效" };
  } catch (error) {
    checks.feishu = { ok: false, message: error.message };
  }

  if (token) {
    for (const tableKey of ["board", "paint"]) {
      try {
        const result = await checkBitableTable(token, tableKey);
        checks[tableKey] = { ok: true, message: `${result.label}表正常，${result.fieldCount} 个字段` };
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
    checkedAt: new Date().toISOString(),
    checks,
  };
}

app.get("/api/status", (_req, res) => {
  res.json(getConfigStatus());
});

app.get("/api/health", async (_req, res) => {
  try {
    const health = await buildHealthStatus();
    res.status(health.ok ? 200 : 503).json({ ok: true, health });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

function publicConfig() {
  return {
    appId: process.env.FEISHU_APP_ID || "",
    appSecretSet: Boolean(process.env.FEISHU_APP_SECRET),
    bitableAppToken: process.env.FEISHU_BITABLE_APP_TOKEN || "",
    bitableTableId: process.env.FEISHU_BITABLE_TABLE_ID || "",
    paintBitableAppToken: process.env.FEISHU_PAINT_BITABLE_APP_TOKEN || "",
    paintBitableTableId: process.env.FEISHU_PAINT_BITABLE_TABLE_ID || "",
    replyEnabled: process.env.FEISHU_REPLY_ENABLED === "true",
    nameIdMap: getConfigStatus().nameIdMap || {},
  };
}

function buildRuntimeConfigEntries(config) {
  return {
    PORT: String(port),
    FEISHU_APP_ID: config.appId || "",
    FEISHU_APP_SECRET: config.appSecret || process.env.FEISHU_APP_SECRET || "",
    FEISHU_BITABLE_APP_TOKEN: config.bitableAppToken || "",
    FEISHU_BITABLE_TABLE_ID: config.bitableTableId || "",
    FEISHU_PAINT_BITABLE_APP_TOKEN: config.paintBitableAppToken || "",
    FEISHU_PAINT_BITABLE_TABLE_ID: config.paintBitableTableId || "",
    FIELD_MAP_JSON: JSON.stringify(config.fieldMap || {}),
    NAME_ID_MAP_JSON: JSON.stringify(config.nameIdMap || {}),
    FEISHU_REPLY_ENABLED: config.replyEnabled ? "true" : "false",
  };
}

function applyRuntimeConfig(entries) {
  for (const [key, value] of Object.entries(entries)) process.env[key] = value;
  invalidateAllFeishuCaches();
}

function serializeEnv(entries) {
  return `${Object.entries(entries)
    .map(([key, value]) => `${key}='${String(value).replace(/\r?\n/g, "\\n").replace(/'/g, "\\'")}'`)
    .join("\n")}\n`;
}

async function readEnvEntries() {
  try {
    return parseDotenv(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function assertConfigWritePassword(password) {
  if (String(password || "") !== configWritePassword) {
    const error = new Error("管理密码错误，未保存改动");
    error.statusCode = 401;
    throw error;
  }
}

async function runStatusSync(reason, range = {}, { skipIfRunning = false, suppressErrors = false } = {}) {
  if (!getConfigStatus().ready) {
    if (skipIfRunning || suppressErrors) return null;
    throw new Error("配置未加载，无法进行状态检测");
  }
  const syncRange = {
    startDate: range.startDate || "",
    endDate: range.endDate || "",
    tableKey: range.tableKey || "board",
    fillMissingTimestamps: range.fillMissingTimestamps !== false,
  };
  const tableSyncInfo = getTableSyncInfo(syncRange.tableKey);
  if (statusSyncRunningTables.has(syncRange.tableKey)) {
    if (skipIfRunning) return null;
    const error = new Error(`${syncRange.tableKey === "paint" ? "油漆" : "胶板"}状态检测正在进行，请稍后再试`);
    error.statusCode = 409;
    throw error;
  }
  statusSyncRunningTables.add(syncRange.tableKey);
  statusSyncInfo.running = true;
  statusSyncInfo.lastReason = reason;
  statusSyncInfo.lastStartedAt = new Date().toISOString();
  statusSyncInfo.lastError = "";
  statusSyncInfo.range = syncRange;
  Object.assign(tableSyncInfo, {
    running: true,
    range: syncRange,
    lastReason: reason,
    lastStartedAt: statusSyncInfo.lastStartedAt,
    lastError: "",
  });
  try {
    const result = await syncDrawingStatuses(syncRange);
    statusSyncInfo.lastSummary = result.summary;
    tableSyncInfo.lastSummary = result.summary;
    if (result.summary.updated > 0) {
      console.log(
        `Drawing status sync (${reason}): updated=${result.summary.updated}, unclaimed=${result.summary.unclaimed}, drawing=${result.summary.drawing}, done=${result.summary.done}`,
      );
    }
    return result;
  } catch (error) {
    statusSyncInfo.lastError = error.message;
    tableSyncInfo.lastError = error.message;
    console.error(`Drawing status sync failed (${reason}):`, error.message);
    if (!suppressErrors) throw error;
    return null;
  } finally {
    statusSyncRunningTables.delete(syncRange.tableKey);
    statusSyncInfo.running = statusSyncRunningTables.size > 0;
    statusSyncInfo.lastFinishedAt = new Date().toISOString();
    tableSyncInfo.running = false;
    tableSyncInfo.lastFinishedAt = statusSyncInfo.lastFinishedAt;
  }
}

async function runBackgroundStatusSync(reason = "timer") {
  if (backgroundStatusCheckRunning || statusSyncRunningTables.size > 0 || !getConfigStatus().ready) return null;
  backgroundStatusCheckRunning = true;
  const results = [];
  const errors = [];
  try {
    const configuredTableKeys = Object.entries(getConfigStatus().tables || {})
      .filter(([, tableStatus]) => tableStatus.ready)
      .map(([tableKey]) => tableKey);
    for (const tableKey of configuredTableKeys) {
      const range = { ...defaultStatusDateRange(), tableKey };
      const tableSyncInfo = getTableSyncInfo(tableKey);
      statusSyncInfo.range = range;
      statusSyncInfo.lastCheckedAt = new Date().toISOString();
      tableSyncInfo.range = range;
      tableSyncInfo.lastCheckedAt = statusSyncInfo.lastCheckedAt;
      tableSyncInfo.lastError = "";
      try {
        const fingerprint = await getDrawingStatusFingerprint(range);
        if (!lastBackgroundFingerprints[tableKey]) {
          lastBackgroundFingerprints[tableKey] = fingerprint;
          statusSyncInfo.lastReason = `baseline:${tableKey}`;
          statusSyncInfo.lastSkippedAt = new Date().toISOString();
          statusSyncInfo.skippedCount += 1;
          tableSyncInfo.lastReason = statusSyncInfo.lastReason;
          tableSyncInfo.lastSkippedAt = statusSyncInfo.lastSkippedAt;
          tableSyncInfo.skippedCount += 1;
          continue;
        }
        if (fingerprint === lastBackgroundFingerprints[tableKey]) {
          statusSyncInfo.lastReason = `no-change:${tableKey}`;
          statusSyncInfo.lastSkippedAt = new Date().toISOString();
          statusSyncInfo.skippedCount += 1;
          tableSyncInfo.lastReason = statusSyncInfo.lastReason;
          tableSyncInfo.lastSkippedAt = statusSyncInfo.lastSkippedAt;
          tableSyncInfo.skippedCount += 1;
          continue;
        }
        statusSyncInfo.lastChangedAt = new Date().toISOString();
        tableSyncInfo.lastChangedAt = statusSyncInfo.lastChangedAt;
        const result = await runStatusSync(`table-change:${tableKey}`, range, { skipIfRunning: true, suppressErrors: true });
        if (result) {
          lastBackgroundFingerprints[tableKey] = await getDrawingStatusFingerprint(range);
          results.push(result);
        }
      } catch (error) {
        errors.push(`${tableKey === "paint" ? "油漆" : "胶板"}：${error.message}`);
        tableSyncInfo.lastError = error.message;
        console.error(`Drawing status change check failed (${reason}:${tableKey}):`, error.message);
      }
    }
    statusSyncInfo.lastError = errors.join("；");
    return results.length > 0 ? results : null;
  } finally {
    backgroundStatusCheckRunning = false;
  }
}

async function runDailyFullStatusSync() {
  if (backgroundStatusCheckRunning || statusSyncRunningTables.size > 0 || !getConfigStatus().ready) return false;
  backgroundStatusCheckRunning = true;
  statusSyncInfo.dailyFull.lastStartedAt = new Date().toISOString();
  statusSyncInfo.dailyFull.lastError = "";
  statusSyncInfo.dailyFull.summaries = {};
  const results = [];
  const errors = [];
  try {
    const configuredTableKeys = Object.entries(getConfigStatus().tables || {})
      .filter(([, tableStatus]) => tableStatus.ready)
      .map(([tableKey]) => tableKey);
    for (const tableKey of configuredTableKeys) {
      try {
        const result = await runStatusSync(
          "daily-full",
          { tableKey, fillMissingTimestamps: false },
          { skipIfRunning: true },
        );
        if (result) {
          results.push(result);
          statusSyncInfo.dailyFull.summaries[tableKey] = result.summary;
          const missingTimestamps =
            Number(result.summary.missingClaimTime || 0) + Number(result.summary.missingCompleteTime || 0);
          if (missingTimestamps > 0) {
            console.warn(
              `Historical timestamp anomalies (${tableKey}): missingClaim=${result.summary.missingClaimTime}, missingComplete=${result.summary.missingCompleteTime}; timestamps preserved`,
            );
          }
        }
        lastBackgroundFingerprints[tableKey] = await getDrawingStatusFingerprint({
          ...defaultStatusDateRange(),
          tableKey,
        });
      } catch (error) {
        errors.push(`${tableKey === "paint" ? "油漆" : "胶板"}：${error.message}`);
      }
    }
    statusSyncInfo.dailyFull.lastError = errors.join("；");
    return results;
  } catch (error) {
    statusSyncInfo.dailyFull.lastError = error.message;
    console.error("Daily full drawing status sync failed:", error.message);
    return null;
  } finally {
    statusSyncInfo.dailyFull.lastFinishedAt = new Date().toISOString();
    backgroundStatusCheckRunning = false;
  }
}

function scheduleDailyFullStatusSync(retryDelayMs = null) {
  const delay = retryDelayMs ?? millisecondsUntilNextShanghaiHour(dailyFullStatusSyncHour);
  const timer = setTimeout(async () => {
    const result = await runDailyFullStatusSync();
    scheduleDailyFullStatusSync(result === false ? 5 * 60 * 1000 : null);
  }, delay);
  timer.unref?.();
}

app.get("/api/background-status-sync", (_req, res) => {
  res.json({ ok: true, status: statusSyncInfo });
});

app.get("/api/config", (_req, res) => {
  const adminAuthenticated = Boolean(readAdminSession(_req));
  const config = adminAuthenticated
    ? publicConfig()
    : {
        appId: "",
        appSecretSet: Boolean(process.env.FEISHU_APP_SECRET),
        bitableAppToken: "",
        bitableTableId: "",
        paintBitableAppToken: "",
        paintBitableTableId: "",
        replyEnabled: false,
        nameIdMap: {},
      };
  res.json({ ok: true, config, status: getConfigStatus(), adminAuthenticated });
});

app.post("/api/config", requireAdminAccess, async (req, res) => {
  try {
    assertConfigWritePassword(req.body?.adminPassword);
    const entries = buildRuntimeConfigEntries(req.body || {});
    const existingEntries = await readEnvEntries();
    await writeFile(envPath, serializeEnv({ ...existingEntries, ...entries }), "utf8");
    applyRuntimeConfig(entries);
    res.json({ ok: true, config: publicConfig(), status: getConfigStatus() });
  } catch (error) {
    res.status(error.statusCode || 400).json({ ok: false, error: error.message });
  }
});

app.post("/api/check-connection", requireAdminAccess, async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const tableConfig = getBitableConfig(req.body?.tableKey);
    const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields?page_size=100`;
    const { response, data } = await fetchFeishuJson(fieldsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok || data.code !== 0) {
      throw new Error(data.msg || response.statusText);
    }
    res.json({
      ok: true,
      message: "连接成功",
      table: tableConfig.key,
      fieldCount: data.data?.items?.length || 0,
      fields: (data.data?.items || []).map((field) => field.field_name),
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/test-message", async (req, res) => {
  try {
    const result = await writeFromText(req.body?.text, {
      dryRun: req.body?.dryRun !== false,
      tableKey: req.body?.tableKey,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post(
  "/api/upload-spreadsheet",
  express.raw({ limit: "50mb", type: "*/*" }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new Error("上传文件为空");
      }
      const fileName = String(req.query.fileName || "spreadsheet.xlsx");
      if (!/\.(xlsx|xls|csv)$/i.test(fileName)) {
        throw new Error("仅支持 xlsx、xls、csv 文件");
      }
      const records = await parseSpreadsheetBuffer(req.body, { fileName });
      const result = await createBitableRecords(records, { tableKey: req.query.tableKey });
      res.json({
        ok: true,
        table: req.query.tableKey || "board",
        fileName,
        count: result.length,
        parsedCount: records.length,
        resultCount: result.length,
        warnings: result.warnings || [],
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  },
);

app.post("/api/claim-drawing", async (req, res) => {
  try {
    const materialCodes =
      Array.isArray(req.body?.materialCodes) && req.body.materialCodes.length > 0
        ? req.body.materialCodes
        : extractMaterialCodes(req.body?.text || "");
    const result = await claimDrawingOwners({
      materialCodes,
      senderName: req.body?.senderName,
      senderId: req.body?.senderId,
      tableKey: req.body?.tableKey,
    });
    res.json({
      ok: true,
      count: result.length,
      materialCodes: [...new Set(result.map((item) => item.materialCode))],
      result,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/complete-drawing", async (req, res) => {
  try {
    if (!readAdminSession(req)) {
      return res.status(403).json({
        ok: false,
        error: "管理员网页代完成需要先通过管理员密码验证",
      });
    }
    const materialCodes =
      Array.isArray(req.body?.materialCodes) && req.body.materialCodes.length > 0
        ? req.body.materialCodes
        : extractMaterialCodes(req.body?.text || "");
    const result = await completeDrawings({
      materialCodes,
      tableKey: req.body?.tableKey,
      allowOwnerOverride: true,
    });
    const updated = result.filter((item) => item.changed);
    const alreadyCompleted = result.filter((item) => !item.changed);
    const adminOverrides = updated.filter((item) => item.adminOverride);
    res.json({
      ok: true,
      count: updated.length,
      matchedCount: result.length,
      alreadyCompletedCount: alreadyCompleted.length,
      adminOverrideCount: adminOverrides.length,
      warning:
        adminOverrides.length > 0
          ? `管理员已代为完成 ${adminOverrides.length} 条图纸`
          : "",
      materialCodes: [...new Set(result.map((item) => item.materialCode))],
      result,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/confirm-orders", async (req, res) => {
  try {
    const materialCodes =
      Array.isArray(req.body?.materialCodes) && req.body.materialCodes.length > 0
        ? req.body.materialCodes
        : extractMaterialCodes(req.body?.text || "");
    const { result, missing } = await confirmDrawingOrders({
      materialCodes,
      tableKey: req.body?.tableKey,
    });
    const updated = result.filter((item) => item.changed);
    const alreadyConfirmed = result.filter((item) => !item.changed);
    res.json({
      ok: true,
      count: updated.length,
      matchedCount: result.length,
      alreadyConfirmedCount: alreadyConfirmed.length,
      materialCodes: [...new Set(result.map((item) => item.materialCode))],
      missing,
      result,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/query-drawing-claims", async (req, res) => {
  try {
    const materialCodes =
      Array.isArray(req.body?.materialCodes) && req.body.materialCodes.length > 0
        ? req.body.materialCodes
        : extractMaterialCodes(req.body?.text || "");
    const result = await queryDrawingClaimStatus({ materialCodes, tableKey: req.body?.tableKey });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/query-unclaimed-drawings", async (req, res) => {
  try {
    const result = await queryUnclaimedDrawings({ tableKey: req.body?.tableKey });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/drawing-owner-stats", async (req, res) => {
  try {
    const result = await queryDrawingOwnerStats({ tableKey: req.query.tableKey });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/home-dashboard", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    const now = new Date();
    const today = formatShanghaiDate(now);
    const defaultRangeStart = `${today.slice(0, 7)}-01`;
    const rangeEnd = parseDashboardDate(req.query.endDate, today);
    const rangeStart = parseDashboardDate(req.query.startDate, defaultRangeStart);
    const includePerformance = req.query.includePerformance !== "0";
    if (rangeStart > rangeEnd) throw new Error("绩效统计开始日期不能晚于结束日期");
    if (rangeEnd > today) throw new Error("绩效统计结束日期不能晚于今天");
    const forceRefreshRequested = req.query.forceRefresh === "1";
    const forceRefreshApplied =
      forceRefreshRequested &&
      now.getTime() - lastDashboardForceRefreshAt >= dashboardForceRefreshCooldownMs;
    if (forceRefreshApplied) {
      invalidateBitableRecordCache("board");
      invalidateBitableRecordCache("paint");
      await refreshDrawingOwnerRoster();
      lastDashboardForceRefreshAt = now.getTime();
    }
    const [personnel, boardToday, paintToday, boardPerformance, paintPerformance, health] =
      await Promise.all([
        queryDrawingOwnerStats(),
        queryHomeDashboardTable({ startDate: today, endDate: today, tableKey: "board" }),
        queryHomeDashboardTable({ startDate: today, endDate: today, tableKey: "paint" }),
        includePerformance
          ? queryDrawingAnalytics({ startDate: rangeStart, endDate: rangeEnd, tableKey: "board" })
          : null,
        includePerformance
          ? queryDrawingAnalytics({ startDate: rangeStart, endDate: rangeEnd, tableKey: "paint" })
          : null,
        buildHealthStatus(),
      ]);

    const systemEvents = [
      {
        id: `config:${serverStartedAt}`,
        time: serverStartedAt,
        type: "配置",
        source: "系统",
        content: getConfigStatus().ready ? "运行配置已加载" : "运行配置尚未完整加载",
        status: getConfigStatus().ready ? "正常" : "异常",
      },
      health.checkedAt && {
        id: `health:${health.checkedAt}`,
        time: health.checkedAt,
        type: "检测",
        source: "监控中心",
        content: health.ok ? "任务状态与飞书连接检测通过" : "检测到连接或配置异常",
        status: health.ok ? "正常" : "异常",
      },
      statusSyncInfo.lastFinishedAt && {
        id: `sync:${statusSyncInfo.lastFinishedAt}`,
        time: statusSyncInfo.lastFinishedAt,
        type: "同步",
        source: "数据服务",
        content: "胶板与油漆状态同步完成",
        status: statusSyncInfo.lastError ? "异常" : "成功",
      },
      ...Object.entries(health.checks || {})
        .filter(([, check]) => !check.ok)
        .map(([key, check]) => ({
          id: `health-check:${key}:${health.checkedAt}`,
          time: health.checkedAt,
          type: key === "websocket" ? "连接" : "检测",
          source: key === "board" ? "胶板" : key === "paint" ? "油漆" : key === "websocket" ? "飞书接口" : "监控中心",
          content: check.message || `${key}检测异常`,
          status: "异常",
        })),
    ].filter(Boolean);

    const realtimeLogs = [
      ...boardToday.events,
      ...paintToday.events,
      ...systemEvents,
    ]
      .sort((left, right) => Date.parse(right.time) - Date.parse(left.time))
      .slice(0, 8);

    res.json({
      ok: true,
      checkedAt: now.toISOString(),
      range: { startDate: rangeStart, endDate: rangeEnd },
      configReady: getConfigStatus().ready,
      health,
      personnel,
      today: { board: boardToday, paint: paintToday },
      ...(includePerformance
        ? { performance: { board: boardPerformance, paint: paintPerformance } }
        : {}),
      performanceIncluded: includePerformance,
      realtimeLogs,
      cache: {
        ...getFeishuCacheStatus(),
        forceRefreshRequested,
        forceRefreshApplied,
        forceRefreshCooldownMs: dashboardForceRefreshCooldownMs,
      },
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/drawing-analytics", async (req, res) => {
  try {
    const result = await queryDrawingAnalytics({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      tableKey: req.query.tableKey,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/sync-drawing-statuses", async (req, res) => {
  try {
    const manualRange = {
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      tableKey: req.body?.tableKey,
    };
    const result = await runStatusSync("manual", manualRange);
    try {
      const refreshedTableKey = manualRange.tableKey || "board";
      lastBackgroundFingerprints[refreshedTableKey] = await getDrawingStatusFingerprint({
        ...defaultStatusDateRange(),
        tableKey: refreshedTableKey,
      });
    } catch {
      // A failed fingerprint refresh should not turn a completed manual sync into a failed request.
    }
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.statusCode || 400).json({ ok: false, error: error.message });
  }
});

app.post("/api/recalculate-drawing-durations", async (req, res) => {
  try {
    const result = await recalculateDrawingDurations({
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      tableKey: req.body?.tableKey,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/webhook/feishu", async (req, res) => {
  if (!feishuWebhookEnabled) {
    return res.status(404).json({ ok: false, error: "接口未启用" });
  }

  const body = req.body || {};

  if (body.type === "url_verification" && body.challenge) {
    return res.json({ challenge: body.challenge });
  }

  const expectedToken = process.env.FEISHU_VERIFICATION_TOKEN;
  const incomingToken = body.token || body.header?.token;
  if (expectedToken && expectedToken !== incomingToken) {
    return res.status(401).json({ ok: false, error: "invalid verification token" });
  }

  try {
    const text = extractTextFromFeishuEvent(body);
    const result = await writeFromText(text);
    const messageId = body?.event?.message?.message_id;
    await replyToMessage(
      messageId,
      result.dryRun
        ? `已解析 ${result.count} 条记录，但系统配置不完整，未执行写入。`
        : `已成功写入 ${result.count} 条多维表记录。`,
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    const messageId = body?.event?.message?.message_id;
    await replyToMessage(messageId, `写入失败：${error.message}`);
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.use(express.static(path.join(rootDir, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Tech bot server: http://127.0.0.1:${port}`);
  console.log(
    feishuWebhookEnabled
      ? `Feishu webhook: http://127.0.0.1:${port}/webhook/feishu`
      : "Feishu webhook: disabled",
  );
  refreshDrawingOwnerRoster()
    .catch((error) => {
      console.error("Drawing owner roster startup refresh failed:", error.message);
    })
    .finally(() => {
      runBackgroundStatusSync("startup");
      setInterval(() => runBackgroundStatusSync("timer"), statusSyncIntervalMs);
    });
  scheduleDailyFullStatusSync();
});
