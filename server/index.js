import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminAccess } from "./admin-access.js";
import { createConfigRoutes } from "./config-routes.js";
import { createDrawingRoutes } from "./drawing-routes.js";
import { createFeishuWebhookRoutes } from "./feishu-webhook-routes.js";
import { createHealthService } from "./health-service.js";
import { createHomeDashboardRoutes } from "./home-dashboard-routes.js";
import { createImportRoutes } from "./import-routes.js";
import { createMonitoringRoutes } from "./monitoring-routes.js";
import { loadRuntimeLogs } from "./runtime-log-reader.js";
import { createQuoteDashboardRoutes } from "./quote-dashboard-routes.js";
import { createQuoteStatisticsRoutes } from "./quote-statistics-routes.js";
import { createStatusSyncService } from "./status-sync-service.js";
import { refreshDrawingOwnerRoster } from "./bot-core.js";
import { getConfigStatus } from "./runtime-config.js";

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
const {
  readAdminSession,
  registerRoutes: registerAdminRoutes,
  requireAdminAccess,
} = createAdminAccess({
  password: process.env.ADMIN_ACCESS_PASSWORD || "888000",
});
const { registerRoutes: registerConfigRoutes } = createConfigRoutes({
  envPath,
  port,
  configWritePassword,
  readAdminSession,
  requireAdminAccess,
});
const {
  refreshBackgroundFingerprint,
  runBackgroundStatusSync,
  runStatusSync,
  scheduleDailyFullStatusSync,
  statusSyncInfo,
} = createStatusSyncService({
  intervalMs: statusSyncIntervalMs,
  dailyFullHour: dailyFullStatusSyncHour,
});
const { buildHealthStatus } = createHealthService({ websocketStatusPath });
const { registerRoutes: registerMonitoringRoutes } = createMonitoringRoutes({
  buildHealthStatus,
  getConfigStatus,
  loadRuntimeLogs,
  requireAdminAccess,
  statusSyncInfo,
});
const { registerRoutes: registerHomeDashboardRoutes } = createHomeDashboardRoutes({
  buildHealthStatus,
  statusSyncInfo,
});
const { registerRoutes: registerDrawingRoutes } = createDrawingRoutes({
  readAdminSession,
  refreshBackgroundFingerprint,
  runStatusSync,
});
const { registerRoutes: registerImportRoutes } = createImportRoutes();
const { registerRoutes: registerQuoteDashboardRoutes } = createQuoteDashboardRoutes();
const { registerRoutes: registerQuoteStatisticsRoutes } = createQuoteStatisticsRoutes();
const { registerRoutes: registerFeishuWebhookRoutes } = createFeishuWebhookRoutes({
  enabled: feishuWebhookEnabled,
});

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
registerAdminRoutes(app);
registerMonitoringRoutes(app);

registerConfigRoutes(app);
registerImportRoutes(app);
registerQuoteDashboardRoutes(app);
registerQuoteStatisticsRoutes(app);
registerDrawingRoutes(app);
registerHomeDashboardRoutes(app);
registerFeishuWebhookRoutes(app);

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
