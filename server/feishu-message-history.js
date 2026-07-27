import { defaultSpreadsheetSessionTtlMs } from "./spreadsheet-session-manager.js";

function parseJsonContent(content) {
  if (!content) return {};
  if (typeof content === "object") return content;
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function senderId(item) {
  return item?.sender?.id || item?.sender?.sender_id?.open_id || item?.sender?.sender_id?.user_id || "";
}

function createTimeMs(item) {
  const value = Number(item?.create_time || item?.createTime || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1_000_000_000_000 ? value : value * 1000;
}

function toFileMessage(item, chatId, tableKey) {
  const body = parseJsonContent(item?.body?.content);
  const fileKey = body.file_key || body.fileKey || body.key;
  const fileName = body.file_name || body.fileName || body.name || "";
  if (!fileKey || (fileName && !/\.(xlsx|xls|csv)$/i.test(fileName))) return null;
  return {
    chatId,
    messageId: item.message_id,
    senderId: senderId(item),
    senderName: item?.sender?.sender_name || senderId(item),
    content: item?.body?.content || "",
    resources: [{ type: "file", fileKey, fileName }],
    tableKey,
  };
}

function toTextMessage(item, chatId) {
  return {
    chatId,
    messageId: item.message_id,
    senderId: senderId(item),
    senderName: item?.sender?.sender_name || senderId(item),
    content: parseJsonContent(item?.body?.content)?.text || item?.body?.content || "",
    resources: [],
    mentionedBot: true,
  };
}

export function createFeishuMessageHistory({
  client,
  isActivationMessage,
  isCompletionMessage,
  parseActivationTableKey,
  permissionErrorMessage,
  sessionTtlMs = defaultSpreadsheetSessionTtlMs,
  now = () => Date.now(),
  onSessionRecovered = () => {},
}) {
  async function listMessages(chatId, startTimeMs, endTimeMs) {
    const messages = [];
    let pageToken = "";
    try {
      do {
        const response = await client.im.v1.message.list({
          params: {
            container_id_type: "chat",
            container_id: chatId,
            start_time: String(Math.floor(startTimeMs / 1000)),
            end_time: String(Math.floor(endTimeMs / 1000)),
            page_size: 50,
            page_token: pageToken || undefined,
          },
        });
        messages.push(...(response.data?.items || []));
        pageToken = response.data?.page_token || "";
      } while (pageToken);
    } catch (error) {
      const data = error.response?.data;
      if (data?.code === 230027 || String(data?.msg || error.message).includes("im:message.group_msg")) {
        throw new Error(permissionErrorMessage, { cause: error });
      }
      throw error;
    }
    return messages;
  }

  async function recoverSession(message) {
    const currentTime = now();
    const items = await listMessages(message.chatId, currentTime - sessionTtlMs, currentTime);
    let latestActivation = null;
    for (const item of items) {
      if (senderId(item) !== message.senderId || item.msg_type !== "text") continue;
      const runtimeMessage = toTextMessage(item, message.chatId);
      if (!isActivationMessage(runtimeMessage)) continue;
      const createdAt = createTimeMs(item);
      if (!latestActivation || createdAt >= latestActivation.createdAt) {
        latestActivation = { message: runtimeMessage, createdAt };
      }
    }
    if (!latestActivation) {
      throw new Error("未找到本次新增对应的新增口令，请重新发送新增口令后再上传文件。");
    }

    const tableKey = parseActivationTableKey(latestActivation.message.content);
    const pending = {
      chatId: message.chatId,
      startedAt: latestActivation.createdAt || currentTime - sessionTtlMs,
      expiresAt: currentTime + sessionTtlMs,
      senderId: message.senderId,
      tableKey,
      files: [],
      recovered: true,
    };
    onSessionRecovered(message, pending);
    return pending;
  }

  async function listFiles(message, pending) {
    const items = await listMessages(message.chatId, pending.startedAt, now());
    return items
      .filter((item) => senderId(item) === pending.senderId && item.msg_type === "file")
      .map((item) => toFileMessage(item, message.chatId, pending.tableKey))
      .filter(Boolean);
  }

  async function listCompletions(chatId, pending) {
    const items = await listMessages(chatId, pending.startedAt, now());
    return items
      .filter((item) => senderId(item) === pending.senderId && item.msg_type === "text")
      .map((item) => toTextMessage(item, chatId))
      .filter(isCompletionMessage);
  }

  return { recoverSession, listFiles, listCompletions };
}
