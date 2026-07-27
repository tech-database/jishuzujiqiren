import { websocketHeartbeatStatus } from "./websocket-status.js";

export function registerLongConnectionLifecycle({
  channel,
  getStatus,
  persistStatus,
  pollSpreadsheetSessions,
  logger = console,
  heartbeatIntervalMs = 15_000,
  pollingIntervalMs = 5_000,
}) {
  channel.on("reconnecting", () => {
    logger.warn?.("Feishu websocket is reconnecting.");
    persistStatus({
      connected: false,
      state: "reconnecting",
      message: "飞书长连接正在重连",
    }).catch((error) => logger.error?.("Failed to write websocket reconnecting status:", error));
  });

  channel.on("reconnected", () => {
    logger.info?.("Feishu websocket reconnected.");
    persistStatus({
      connected: true,
      state: "connected",
      message: "飞书长连接已重新连接",
    }).catch((error) => logger.error?.("Failed to write websocket reconnected status:", error));
  });

  channel.on("error", (error) => {
    logger.error?.("Feishu websocket error:", error);
    persistStatus({
      connected: false,
      state: "error",
      message: error?.message || String(error),
    }).catch((statusError) => logger.error?.("Failed to write websocket status:", statusError));
  });

  return async function connectLongConnection() {
    await persistStatus({
      connected: false,
      state: "connecting",
      message: "正在连接飞书长连接",
    });
    await channel.connect();
    await persistStatus({
      connected: true,
      state: "connected",
      message: "飞书长连接已连接",
    });

    const heartbeatTimer = setInterval(() => {
      const status = websocketHeartbeatStatus(channel.getConnectionStatus?.(), getStatus());
      persistStatus(status).catch((error) =>
        logger.error?.("Failed to write websocket heartbeat:", error),
      );
    }, heartbeatIntervalMs);
    heartbeatTimer.unref?.();

    const pollingTimer = setInterval(() => {
      pollSpreadsheetSessions().catch((error) =>
        logger.error?.("Spreadsheet polling failed:", error),
      );
    }, pollingIntervalMs);
    pollingTimer.unref?.();

    return { heartbeatTimer, pollingTimer };
  };
}
