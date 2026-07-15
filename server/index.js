import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import {
  claimDrawingOwners,
  completeDrawings,
  createBitableRecords,
  extractMaterialCodes,
  extractTextFromFeishuEvent,
  getBitableConfig,
  getConfigStatus,
  getDrawingStatusFingerprint,
  getTenantAccessToken,
  parseSpreadsheetBuffer,
  queryDrawingClaimStatus,
  queryDrawingOwnerStats,
  queryUnclaimedDrawings,
  syncDrawingStatuses,
  writeFromText,
} from "./bot-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const app = express();
const port = Number(process.env.PORT || 8787);
const envPath = path.join(rootDir, ".env");
const statusSyncIntervalMs = Number(process.env.STATUS_SYNC_INTERVAL_MS || 10000);
const websocketStatusPath = path.join(__dirname, ".runtime", "long-connection-status.json");
const configWritePassword = process.env.CONFIG_WRITE_PASSWORD || "888888";
let statusSyncRunning = false;
const lastBackgroundFingerprints = {};
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
};

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

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function defaultStatusDateRange() {
  const today = new Date();
  return {
    startDate: formatDateInput(addDays(today, -2)),
    endDate: formatDateInput(today),
  };
}

async function replyToMessage(messageId, text) {
  if (process.env.FEISHU_REPLY_ENABLED !== "true" || !messageId) return;
  const token = await getTenantAccessToken();
  await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
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
  const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields?page_size=100`;
  const response = await fetch(fieldsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || response.statusText);
  }
  return {
    ok: true,
    table: tableConfig.key,
    label: tableConfig.label,
    fieldCount: data.data?.items?.length || 0,
  };
}

async function readWebsocketHealth() {
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

function applyRuntimeConfig(config) {
  const entries = {
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
  for (const [key, value] of Object.entries(entries)) process.env[key] = value;
  return entries;
}

function serializeEnv(entries) {
  return `${Object.entries(entries)
    .map(([key, value]) => `${key}=${String(value).replace(/\r?\n/g, "\\n")}`)
    .join("\n")}\n`;
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
  if (statusSyncRunning) {
    if (skipIfRunning) return null;
    const error = new Error("状态检测正在进行，请稍后再试");
    error.statusCode = 409;
    throw error;
  }
  statusSyncRunning = true;
  statusSyncInfo.running = true;
  statusSyncInfo.lastReason = reason;
  statusSyncInfo.lastStartedAt = new Date().toISOString();
  statusSyncInfo.lastError = "";
  const syncRange = {
    startDate: range.startDate || "",
    endDate: range.endDate || "",
    tableKey: range.tableKey || "board",
  };
  statusSyncInfo.range = syncRange;
  try {
    const result = await syncDrawingStatuses(syncRange);
    statusSyncInfo.lastSummary = result.summary;
    if (result.summary.updated > 0) {
      console.log(
        `Drawing status sync (${reason}): updated=${result.summary.updated}, unclaimed=${result.summary.unclaimed}, drawing=${result.summary.drawing}, done=${result.summary.done}`,
      );
    }
    return result;
  } catch (error) {
    statusSyncInfo.lastError = error.message;
    console.error(`Drawing status sync failed (${reason}):`, error.message);
    if (!suppressErrors) throw error;
    return null;
  } finally {
    statusSyncRunning = false;
    statusSyncInfo.running = false;
    statusSyncInfo.lastFinishedAt = new Date().toISOString();
  }
}

async function runBackgroundStatusSync(reason = "timer") {
  if (statusSyncRunning || !getConfigStatus().ready) return null;
  const results = [];
  for (const tableKey of ["board", "paint"]) {
    const range = { ...defaultStatusDateRange(), tableKey };
    statusSyncInfo.range = range;
    statusSyncInfo.lastCheckedAt = new Date().toISOString();
    statusSyncInfo.lastError = "";
    try {
      const fingerprint = await getDrawingStatusFingerprint(range);
      if (!lastBackgroundFingerprints[tableKey]) {
        lastBackgroundFingerprints[tableKey] = fingerprint;
        statusSyncInfo.lastReason = `baseline:${tableKey}`;
        statusSyncInfo.lastSkippedAt = new Date().toISOString();
        statusSyncInfo.skippedCount += 1;
        continue;
      }
      if (fingerprint === lastBackgroundFingerprints[tableKey]) {
        statusSyncInfo.lastReason = `no-change:${tableKey}`;
        statusSyncInfo.lastSkippedAt = new Date().toISOString();
        statusSyncInfo.skippedCount += 1;
        continue;
      }
      statusSyncInfo.lastChangedAt = new Date().toISOString();
      const result = await runStatusSync(`table-change:${tableKey}`, range, { skipIfRunning: true, suppressErrors: true });
      if (result) {
        lastBackgroundFingerprints[tableKey] = await getDrawingStatusFingerprint(range);
        results.push(result);
      }
    } catch (error) {
      statusSyncInfo.lastError = error.message;
      console.error(`Drawing status change check failed (${reason}:${tableKey}):`, error.message);
    }
  }
  return results.length > 0 ? results : null;
}

app.get("/api/background-status-sync", (_req, res) => {
  res.json({ ok: true, status: statusSyncInfo });
});

app.get("/api/config", (_req, res) => {
  res.json({ ok: true, config: publicConfig(), status: getConfigStatus() });
});

app.post("/api/config", async (req, res) => {
  try {
    assertConfigWritePassword(req.body?.adminPassword);
    const entries = applyRuntimeConfig(req.body || {});
    await writeFile(envPath, serializeEnv(entries), "utf8");
    res.json({ ok: true, config: publicConfig(), status: getConfigStatus() });
  } catch (error) {
    res.status(error.statusCode || 400).json({ ok: false, error: error.message });
  }
});

app.post("/api/check-connection", async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const tableConfig = getBitableConfig(req.body?.tableKey);
    const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields?page_size=100`;
    const response = await fetch(fieldsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
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
      const records = await parseSpreadsheetBuffer(req.body);
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
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
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
    const materialCodes =
      Array.isArray(req.body?.materialCodes) && req.body.materialCodes.length > 0
        ? req.body.materialCodes
        : extractMaterialCodes(req.body?.text || "");
    const result = await completeDrawings({
      materialCodes,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
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

app.post("/webhook/feishu", async (req, res) => {
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
        ? `Parsed ${result.count} row(s), but config is missing.`
        : `Created ${result.count} bitable record(s).`,
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    const messageId = body?.event?.message?.message_id;
    await replyToMessage(messageId, `Write failed: ${error.message}`);
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.use(express.static(path.join(rootDir, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Tech bot server: http://127.0.0.1:${port}`);
  console.log(`Feishu webhook: http://127.0.0.1:${port}/webhook/feishu`);
  runBackgroundStatusSync("startup");
  setInterval(() => runBackgroundStatusSync("timer"), statusSyncIntervalMs);
});
