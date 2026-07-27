import { chatKey } from "./long-connection-message.js";
import { pollPendingSpreadsheetSessions } from "./spreadsheet-session-polling.js";

export function createLongConnectionSpreadsheetHandler({
  createBitableRecords,
  downloadResource,
  messageHistory,
  noFilesReply,
  parseSpreadsheetBuffer,
  processing,
  sendReply,
  sessions,
  writeFromText,
  logger = console,
}) {
  async function handleSpreadsheetMessage(message) {
    const resources = message.resources?.filter((resource) => resource.type === "file") || [];
    let count = 0;
    if (resources.length === 0) {
      const result = await writeFromText(message.content, { tableKey: message.tableKey });
      return result.count;
    }

    for (const resource of resources) {
      if (resource.fileName && !/\.(xlsx|xls|csv)$/i.test(resource.fileName)) {
        logger.info?.("spreadsheet_file_skipped", { fileName: resource.fileName });
        continue;
      }
      const buffer = await downloadResource(message.messageId, resource.fileKey);
      const records = await parseSpreadsheetBuffer(buffer, { fileName: resource.fileName });
      const created = await createBitableRecords(records, { tableKey: message.tableKey });
      count += created.length;
      if (created.warnings?.length > 0) {
        await sendReply(
          message.chatId,
          `${resource.fileName || "上传文件"}：${created.warnings.join("，")}`,
        );
      }
    }
    logger.info?.("spreadsheet_records_created", { count });
    return count;
  }

  async function processCompletion(message, pending) {
    const completionMessageId = message.messageId || "";
    if (completionMessageId && processing.hasCompletion(completionMessageId)) {
      sessions.end(message);
      return;
    }
    sessions.end(message);
    if (pending.files.length === 0) {
      pending.files.push(...(await messageHistory.listFiles(message, pending)));
    }
    const files = pending.files.filter((fileMessage, index, list) => {
      const messageId = fileMessage.messageId || "";
      if (messageId && processing.hasFile(messageId)) return false;
      return !messageId || list.findIndex((item) => item.messageId === messageId) === index;
    });
    if (files.length === 0) {
      await sendReply(message.chatId, noFilesReply);
      if (completionMessageId) await processing.markCompletion(completionMessageId);
      return;
    }

    let count = 0;
    for (const fileMessage of files) {
      count += await handleSpreadsheetMessage(fileMessage);
      await processing.markFile(fileMessage.messageId);
    }
    if (completionMessageId) await processing.markCompletion(completionMessageId);
    await sendReply(
      message.chatId,
      `写入已经完成，共处理 ${files.length} 个文件，写入 ${count} 条记录。`,
    );
  }

  async function handleCompletion(message, pending) {
    const outcome = await processing.runCompletion(message, () =>
      processCompletion(message, pending),
    );
    if (outcome.skipped) {
      logger.info?.("spreadsheet_completion_skipped", {
        chat: chatKey(message),
        messageId: message.messageId,
      });
    }
  }

  async function pollSessions() {
    await pollPendingSpreadsheetSessions({
      sessions: sessions.sessions,
      listCompletions: messageHistory.listCompletions,
      handleCompletion,
      onRecovered: (key) => logger.info?.("spreadsheet_completion_recovered", { chat: key }),
      onError: (error, key) =>
        logger.error?.("Spreadsheet polling failed", { error, session: key }),
    });
  }

  return {
    handleCompletion,
    handleSpreadsheetMessage,
    pollSessions,
    processCompletion,
  };
}
