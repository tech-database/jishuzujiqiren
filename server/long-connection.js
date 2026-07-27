import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requireCreateCommandTableKey } from "./bot-command-parser.js";
import {
  claimDrawingOwners,
  completeDrawings,
  confirmDrawingOrders,
  createBitableRecords,
  extractMaterialCodes,
  queryUnclaimedDrawings,
  syncDrawingStatuses,
  writeFromText,
} from "./bot-core.js";
import { createFeishuMessageHistory } from "./feishu-message-history.js";
import { createFeishuResourceDownloader } from "./feishu-resource-downloader.js";
import { createLongConnectionCommandHandlers } from "./long-connection-command-handlers.js";
import { createLongConnectionDispatcher } from "./long-connection-dispatcher.js";
import { registerLongConnectionLifecycle } from "./long-connection-lifecycle.js";
import {
  chatKey,
  isActivationMessage,
  isCompletionMessage,
} from "./long-connection-message.js";
import { createLongConnectionSpreadsheetHandler } from "./long-connection-spreadsheet-handler.js";
import { createRuntimeLogger } from "./runtime-logger.js";
import { createSpreadsheetProcessingState } from "./spreadsheet-processing-state.js";
import { createSpreadsheetSessionManager } from "./spreadsheet-session-manager.js";
import { ensureConfig } from "./runtime-config.js";
import { parseSpreadsheetBuffer } from "./spreadsheet-parser.js";
import { createWebsocketStatusStore } from "./websocket-status-store.js";

const runtimeDir = path.join(path.dirname(fileURLToPath(import.meta.url)), ".runtime");
const logger = createRuntimeLogger({ service: "feishu-long-connection" });
const activationReply =
  "收到新增指令，请上传你要写入的 Excel 表格，全部上传后发送：@机器人 完成。";
const noFilesReply = "本次新增未收到你上传的 Excel 表格，已结束。";
const historyPermissionError =
  "无法主动读取群消息历史，需要在飞书开放平台为应用开启权限 im:message.group_msg，发布后重启机器人。";

if (process.env.FEISHU_LONG_CONNECTION_ENABLED === "false") {
  logger.info("long_connection_disabled");
  process.exit(0);
}

ensureConfig();
const processing = createSpreadsheetProcessingState({
  runtimeDir,
  stateFilePath: path.join(runtimeDir, "spreadsheet-processed.json"),
  onCommandPersistError: (error) => logger.error("command_state_persist_failed", { error }),
});
await processing.load();

const { Client, createLarkChannel } = await import("@larksuiteoapi/node-sdk");
const feishuConfig = {
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
};
const client = new Client(feishuConfig);
const channel = createLarkChannel({ ...feishuConfig, transport: "websocket" });
const { getStatus, persistStatus } = createWebsocketStatusStore({
  runtimeDir,
  statusFilePath: path.join(runtimeDir, "long-connection-status.json"),
});
const sessions = createSpreadsheetSessionManager({
  onSenderMismatch: (message, pending) =>
    logger.info("spreadsheet_sender_mismatch", {
      actualSenderId: message.senderId,
      expectedSenderId: pending.senderId,
    }),
});
const messageHistory = createFeishuMessageHistory({
  client,
  isActivationMessage,
  isCompletionMessage,
  parseActivationTableKey: requireCreateCommandTableKey,
  permissionErrorMessage: historyPermissionError,
  onSessionRecovered: (message, pending) =>
    logger.info("spreadsheet_session_recovered", {
      chat: chatKey(message),
      tableKey: pending.tableKey,
    }),
});

async function sendReply(chatId, text) {
  if (process.env.FEISHU_REPLY_ENABLED === "true") {
    logger.info("reply_sending", { chatId, textLength: String(text || "").length });
    await channel.send(chatId, { text });
    return;
  }
  logger.info("reply_skipped", { chatId, textLength: String(text || "").length });
}

async function runOnce(message, commandName, handler) {
  const outcome = await processing.runCommand(message.messageId, handler);
  if (outcome.skipped) {
    logger.info("duplicate_command_skipped", {
      commandName,
      messageId: message.messageId,
      state: outcome.status,
    });
  }
  return outcome;
}

const commandHandlers = createLongConnectionCommandHandlers({
  claimDrawingOwners,
  completeDrawings,
  confirmDrawingOrders,
  extractMaterialCodes,
  queryUnclaimedDrawings,
  sendReply,
  syncDrawingStatuses,
  logger,
});
const spreadsheetHandler = createLongConnectionSpreadsheetHandler({
  createBitableRecords,
  downloadResource: createFeishuResourceDownloader({ client, logger }),
  messageHistory,
  noFilesReply,
  parseSpreadsheetBuffer,
  processing,
  sendReply,
  sessions,
  writeFromText,
  logger,
});

channel.on(
  "message",
  createLongConnectionDispatcher({
    activationReply,
    getWebsocketStatus: getStatus,
    handlers: {
      ...commandHandlers,
      runOnce,
      spreadsheetCompletion: spreadsheetHandler.handleCompletion,
    },
    logger,
    messageHistory,
    persistWebsocketStatus: persistStatus,
    sendReply,
    spreadsheetSessions: sessions,
  }),
);

const connect = registerLongConnectionLifecycle({
  channel,
  getStatus,
  persistStatus,
  pollSpreadsheetSessions: spreadsheetHandler.pollSessions,
  logger,
});

try {
  await connect();
  logger.info("long_connection_connected");
} catch (error) {
  logger.error("long_connection_failed", { error });
  await persistStatus({
    connected: false,
    state: "failed",
    message: error?.message || String(error),
  });
  process.exit(1);
}
