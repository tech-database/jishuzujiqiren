import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  claimDrawingOwners,
  completeDrawings,
  createBitableRecords,
  ensureConfig,
  extractMaterialCodes,
  isDrawClaimCommand,
  parseSpreadsheetBuffer,
  queryUnclaimedDrawings,
  syncDrawingStatuses,
  writeFromText,
} from "./bot-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = path.join(__dirname, ".runtime");
const websocketStatusPath = path.join(runtimeDir, "long-connection-status.json");
const REPLY_OK = "\u5199\u5165\u5df2\u7ecf\u5b8c\u6210";
const ACTIVATION_REPLY = "\u6536\u5230\u65b0\u589e\u6307\u4ee4\uff0c\u8bf7\u4e0a\u4f20\u4f60\u8981\u5199\u5165\u7684 Excel \u8868\u683c\uff0c\u5168\u90e8\u4e0a\u4f20\u540e\u53d1\u9001\uff1a@\u673a\u5668\u4eba \u5b8c\u6210\u3002";
const NO_FILES_REPLY = "\u672c\u6b21\u65b0\u589e\u672a\u6536\u5230\u4f60\u4e0a\u4f20\u7684 Excel \u8868\u683c\uff0c\u5df2\u7ed3\u675f\u3002";
const HISTORY_PERMISSION_ERROR =
  "\u65e0\u6cd5\u4e3b\u52a8\u8bfb\u53d6\u7fa4\u6d88\u606f\u5386\u53f2\uff0c\u9700\u8981\u5728\u98de\u4e66\u5f00\u653e\u5e73\u53f0\u4e3a\u5e94\u7528\u5f00\u542f\u6743\u9650 im:message.group_msg\uff0c\u53d1\u5e03\u540e\u91cd\u542f\u673a\u5668\u4eba\u3002";
const ACTIVATION_TTL_MS = 10 * 60 * 1000;
const pendingSpreadsheetChats = new Map();

async function writeWebsocketStatus(status) {
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(
    websocketStatusPath,
    JSON.stringify(
      {
        pid: process.pid,
        updatedAt: new Date().toISOString(),
        ...status,
      },
      null,
      2,
    ),
    "utf8",
  );
}

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

function parseCommandDates(content) {
  const dates = [...String(content || "").matchAll(/\b\d{4}-\d{1,2}-\d{1,2}\b/g)].map((match) => {
    const [year, month, day] = match[0].split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  });
  return dates;
}

function commandDateRange(content) {
  const dates = parseCommandDates(content);
  if (dates.length === 0) return defaultStatusDateRange();
  if (dates.length === 1) return { startDate: dates[0], endDate: dates[0] };
  return { startDate: dates[0], endDate: dates[1] };
}

function optionalCommandDateRange(content) {
  const dates = parseCommandDates(content);
  if (dates.length === 0) return {};
  if (dates.length === 1) return { startDate: dates[0], endDate: dates[0] };
  return { startDate: dates[0], endDate: dates[1] };
}

function commandTableKey(content) {
  return String(content || "").includes("油漆") ? "paint" : "board";
}

function isTableCreateCommand(content) {
  return /(?:胶板|油漆)\s*新增/.test(String(content || ""));
}

function commandHelpText() {
  return [
    "飞书机器人口令：",
    "1. @机器人 胶板新增 / @机器人 油漆新增：开始上传 Excel/CSV，上传完成后发送 @机器人 完成",
    "2. @机器人 料号 领图：自动在胶板/油漆表匹配料号，把发送人写入绘图人并改为绘图中",
    "3. @机器人 料号 绘图完成：自动在胶板/油漆表匹配料号，改为绘图完成并记录完成时间/用时",
    "4. @机器人 查询未领取：统计胶板/油漆表当前未领取图纸",
    "5. @机器人 状态检测：按默认日期范围同步状态并返回数量",
    "6. @机器人 获取ID：回复发送人的飞书用户 ID",
    "日期范围可选：在口令后追加 2026-07-11 2026-07-13；不写则默认前天、昨天、今天。",
  ].join("\n");
}

console.log("Loading config...");
ensureConfig();
console.log("Config loaded.");

console.log("Loading Feishu SDK...");
const { Client, createLarkChannel } = await import("@larksuiteoapi/node-sdk");
console.log("Feishu SDK loaded.");

const feishuConfig = {
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
};

const client = new Client(feishuConfig);
const channel = createLarkChannel({
  ...feishuConfig,
  transport: "websocket",
});

async function sendReply(chatId, text) {
  if (process.env.FEISHU_REPLY_ENABLED === "true") {
    console.log(`Sending reply to ${chatId}: ${text}`);
    await channel.send(chatId, { text });
  } else {
    console.log(`Reply skipped because FEISHU_REPLY_ENABLED is not true: ${text}`);
  }
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function downloadResourceBySdk(messageId, fileKey) {
  const resource = await client.im.v1.messageResource.get({
    path: { message_id: messageId, file_key: fileKey },
    params: { type: "file" },
    data: { type: "file" },
  });
  const buffer = await streamToBuffer(resource.getReadableStream());
  console.log(
    `Downloaded resource bytes=${buffer.length} head=${buffer.subarray(0, 16).toString("hex")}`,
  );
  return buffer;
}

async function handleDrawClaim(message) {
  const range = optionalCommandDateRange(message.content);
  const materialCodes = extractMaterialCodes(message.content);
  const result = await claimDrawingOwners({
    materialCodes,
    senderName: message.senderName,
    senderId: message.senderId,
    ...range,
  });
  const claimedCodes = [...new Set(result.map((item) => item.materialCode))].join("\uFF0C");
  console.log(
    `Drawing owner claimed: ${claimedCodes} -> ${
      message.senderName || message.senderId
    }`,
  );
  await sendReply(message.chatId, `\u9886\u56fe\u6210\u529f\uff1a${claimedCodes}`);
}

async function handleDrawingComplete(message) {
  const range = optionalCommandDateRange(message.content);
  const materialCodes = extractMaterialCodes(message.content);
  const result = await completeDrawings({ materialCodes, ...range });
  const completedCodes = [...new Set(result.map((item) => item.materialCode))].join("\uFF0C");
  await sendReply(message.chatId, `绘图完成已同步：${completedCodes}，共更新 ${result.length} 条记录。`);
}

async function handleUnclaimedQuery(message) {
  const result = await queryUnclaimedDrawings();
  await sendReply(message.chatId, `查询完成：共有 ${result.count} 条图纸未被领取。`);
}

async function handleStatusSync(message) {
  const range = commandDateRange(message.content);
  const tableKey = commandTableKey(message.content);
  const result = await syncDrawingStatuses({ ...range, tableKey });
  await sendReply(
    message.chatId,
    `状态检测完成（${range.startDate} 至 ${range.endDate}）：未领取 ${result.summary.unclaimed} 个，绘图中 ${result.summary.drawing} 个，绘图完成 ${result.summary.done} 个。`,
  );
}

async function handleSpreadsheetMessage(message) {
  const fileResources = message.resources?.filter((resource) => resource.type === "file") || [];
  let count = 0;
  if (fileResources.length > 0) {
    for (const resource of fileResources) {
      if (resource.fileName && !/\.(xlsx|xls|csv)$/i.test(resource.fileName)) {
        console.log(`Skip unsupported file: ${resource.fileName}`);
        continue;
      }
      console.log(`Downloading file: ${resource.fileName || resource.fileKey}`);
      const buffer = await downloadResourceBySdk(message.messageId, resource.fileKey);
      const records = await parseSpreadsheetBuffer(buffer);
      const created = await createBitableRecords(records, { tableKey: message.tableKey });
      count += created.length;
    }
  } else {
    const result = await writeFromText(message.content, { tableKey: message.tableKey });
    count = result.count;
  }
  console.log(`Bitable records created: ${count}`);
  return count;
}

function hasFileResource(message) {
  return message.resources?.some((resource) => resource.type === "file");
}

function isMentionedMessage(message) {
  return Boolean(message.mentionedBot) || /<at\b|@\S+/.test(String(message.content || ""));
}

function chatKey(message) {
  return message.chatId || message.senderId || "default";
}

function isActivationMessage(message) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && !hasFileResource(message) && isTableCreateCommand(content);
}

function isCompletionMessage(message) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && !hasFileResource(message) && content.includes("\u5b8c\u6210");
}

function isHelpCommand(message) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && /口令|帮助|help/i.test(content);
}

function isGetIdCommand(message) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && /获取\s*ID|获取\s*id|我的\s*ID|我的\s*id/i.test(content);
}

async function handleGetId(message) {
  const senderId = message.senderId || message.sender?.id || message.sender?.sender_id?.open_id || "";
  await sendReply(message.chatId, senderId ? `你的飞书用户 ID：${senderId}` : "没有读取到你的飞书用户 ID。");
}

function isDrawingCompleteCommand(message) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && /绘图完成|完成图|图纸完成/.test(content);
}

function isUnclaimedQueryCommand(message) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && /未领取/.test(content) && /查询|统计|多少|全部/.test(content);
}

function isStatusSyncCommand(message) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && /状态检测|检测状态|同步状态/.test(content);
}

function activateSpreadsheetSession(message) {
  const now = Date.now();
  pendingSpreadsheetChats.set(chatKey(message), {
    startedAt: now,
    expiresAt: now + ACTIVATION_TTL_MS,
    senderId: message.senderId,
    tableKey: commandTableKey(message.content),
    files: [],
  });
}

function getSpreadsheetSession(message) {
  const key = chatKey(message);
  const pending = pendingSpreadsheetChats.get(key);
  if (!pending) return null;
  if (pending.expiresAt < Date.now()) {
    pendingSpreadsheetChats.delete(key);
    return null;
  }
  if (pending.senderId && pending.senderId !== message.senderId) {
    console.log(
      `Spreadsheet message ignored because sender=${message.senderId || ""} does not match activated sender=${
        pending.senderId
      }.`,
    );
    return null;
  }
  return pending;
}

function endSpreadsheetSession(message) {
  pendingSpreadsheetChats.delete(chatKey(message));
}

function parseJsonContent(content) {
  if (!content) return {};
  if (typeof content === "object") return content;
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function historySenderId(item) {
  return item?.sender?.id || item?.sender?.sender_id?.open_id || item?.sender?.sender_id?.user_id || "";
}

function historyFileMessageToRuntimeMessage(item, chatId, tableKey) {
  const body = parseJsonContent(item?.body?.content);
  const fileKey = body.file_key || body.fileKey || body.key;
  const fileName = body.file_name || body.fileName || body.name || "";
  if (!fileKey || (fileName && !/\.(xlsx|xls|csv)$/i.test(fileName))) return null;
  return {
    chatId,
    messageId: item.message_id,
    senderId: historySenderId(item),
    senderName: item?.sender?.sender_name || historySenderId(item),
    content: item?.body?.content || "",
    resources: [{ type: "file", fileKey, fileName }],
    tableKey,
  };
}

async function listSessionFileMessages(message, pending) {
  const startTime = Math.floor(pending.startedAt / 1000);
  const endTime = Math.floor(Date.now() / 1000);
  const files = [];
  let pageToken = "";
  try {
    do {
      const response = await client.im.v1.message.list({
        params: {
          container_id_type: "chat",
          container_id: message.chatId,
          start_time: String(startTime),
          end_time: String(endTime),
          page_size: 50,
          page_token: pageToken || undefined,
        },
      });
      const items = response.data?.items || [];
      for (const item of items) {
        if (historySenderId(item) !== pending.senderId) continue;
        if (item.msg_type !== "file") continue;
        const fileMessage = historyFileMessageToRuntimeMessage(item, message.chatId, pending.tableKey);
        if (fileMessage) files.push(fileMessage);
      }
      pageToken = response.data?.page_token || "";
    } while (pageToken);
  } catch (error) {
    const data = error.response?.data;
    if (data?.code === 230027 || String(data?.msg || error.message).includes("im:message.group_msg")) {
      throw new Error(HISTORY_PERMISSION_ERROR);
    }
    throw error;
  }
  return files;
}

async function handleSpreadsheetCompletion(message, pending) {
  endSpreadsheetSession(message);
  if (pending.files.length === 0) {
    pending.files.push(...(await listSessionFileMessages(message, pending)));
  }
  if (pending.files.length === 0) {
    await sendReply(message.chatId, NO_FILES_REPLY);
    return;
  }
  let count = 0;
  for (const fileMessage of pending.files) {
    count += await handleSpreadsheetMessage(fileMessage);
  }
  await sendReply(
    message.chatId,
    `\u5199\u5165\u5df2\u7ecf\u5b8c\u6210\uff0c\u5171\u5904\u7406 ${pending.files.length} \u4e2a\u6587\u4ef6\uff0c\u5199\u5165 ${count} \u6761\u8bb0\u5f55\u3002`,
  );
}

channel.on("message", async (message) => {
  try {
    console.log(
      `Message received: type=${message.messageType || message.type || ""} chat=${message.chatId || ""} sender=${
        message.senderName || message.senderId || ""
      } content=${String(message.content || "").slice(0, 120)}`,
    );
    console.log(`Message keys: ${Object.keys(message).sort().join(", ")}`);
    if (isHelpCommand(message)) {
      await sendReply(message.chatId, commandHelpText());
      return;
    }
    if (isGetIdCommand(message)) {
      await handleGetId(message);
      return;
    }
    if (isActivationMessage(message)) {
      activateSpreadsheetSession(message);
      console.log(`Spreadsheet session started for chat=${chatKey(message)} sender=${message.senderId || ""}`);
      await sendReply(message.chatId, ACTIVATION_REPLY);
      return;
    }
    if (isMentionedMessage(message) && isDrawingCompleteCommand(message)) {
      await handleDrawingComplete(message);
      return;
    }
    if (isMentionedMessage(message) && isUnclaimedQueryCommand(message)) {
      await handleUnclaimedQuery(message);
      return;
    }
    if (isMentionedMessage(message) && isStatusSyncCommand(message)) {
      await handleStatusSync(message);
      return;
    }
    if (isMentionedMessage(message) && isDrawClaimCommand(message.content)) {
      await handleDrawClaim(message);
      return;
    } else {
      const pending = getSpreadsheetSession(message);
      if (!pending) {
        console.log(`Message ignored because chat=${chatKey(message)} has no active spreadsheet session.`);
        return;
      }
      if (isCompletionMessage(message)) {
        await handleSpreadsheetCompletion(message, pending);
        return;
      }
      if (hasFileResource(message)) {
        pending.files.push({ ...message, tableKey: pending.tableKey });
        pending.expiresAt = Date.now() + ACTIVATION_TTL_MS;
        console.log(
          `Spreadsheet file queued for chat=${chatKey(message)} sender=${message.senderId || ""}; total=${
            pending.files.length
          }`,
        );
        return;
      }
      console.log(`Spreadsheet session message ignored until files are uploaded or completion is sent.`);
      return;
    }
    await sendReply(message.chatId, REPLY_OK);
  } catch (error) {
    console.error("Message handling failed:", error.message);
    const prefix = isDrawClaimCommand(message.content) ? "领图失败：" : "操作失败：";
    await sendReply(message.chatId, `${prefix}${error.message}`);
  }
});

channel.on("error", (error) => {
  console.error("Feishu websocket error:", error?.message || error);
  writeWebsocketStatus({
    connected: false,
    state: "error",
    message: error?.message || String(error),
  }).catch((statusError) => console.error("Failed to write websocket status:", statusError.message));
});

try {
  console.log("Connecting Feishu websocket...");
  await writeWebsocketStatus({ connected: false, state: "connecting", message: "正在连接飞书长连接" });
  await channel.connect();
  console.log("Feishu websocket connected. Waiting for bot messages.");
  await writeWebsocketStatus({ connected: true, state: "connected", message: "飞书长连接已连接" });
  setInterval(() => {
    writeWebsocketStatus({ connected: true, state: "connected", message: "飞书长连接已连接" }).catch((error) =>
      console.error("Failed to write websocket heartbeat:", error.message),
    );
  }, 15000);
} catch (error) {
  console.error("Feishu websocket failed:", error?.message || error);
  await writeWebsocketStatus({
    connected: false,
    state: "failed",
    message: error?.message || String(error),
  });
  process.exit(1);
}
