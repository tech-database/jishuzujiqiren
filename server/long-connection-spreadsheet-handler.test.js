import assert from "node:assert/strict";
import test from "node:test";

import { createLongConnectionSpreadsheetHandler } from "./long-connection-spreadsheet-handler.js";

function createHandler({ parseSpreadsheetBuffer, replies, sessionsMap }) {
  const sessions = {
    sessions: sessionsMap,
    end: () => {},
  };
  return createLongConnectionSpreadsheetHandler({
    createBitableRecords: async () => [],
    downloadResource: async () => Buffer.from("spreadsheet"),
    messageHistory: {
      listFiles: async () => [],
      listCompletions: async (chatId) => [{
        chatId,
        messageId: "completion-1",
      }],
    },
    noFilesReply: "没有找到表格文件。",
    parseSpreadsheetBuffer,
    processing: {
      hasCompletion: () => false,
      hasFile: () => false,
      markCompletion: async () => {},
      markFile: async () => {},
      runCompletion: async (_message, callback) => ({
        skipped: false,
        status: "success",
        result: await callback(),
      }),
    },
    sendReply: async (chatId, text) => replies.push({ chatId, text }),
    sessions,
    writeFromText: async () => ({ count: 0 }),
    logger: { info: () => {}, error: () => {} },
  });
}

test("replies with the parser error when a live spreadsheet completion fails", async () => {
  const replies = [];
  const handler = createHandler({
    parseSpreadsheetBuffer: async () => {
      throw new Error("表格列数过多（16375 列），最多允许 500 列。");
    },
    replies,
    sessionsMap: new Map(),
  });

  const outcome = await handler.handleCompletion(
    { chatId: "chat-live", messageId: "completion-live" },
    {
      files: [{
        chatId: "chat-live",
        messageId: "file-live",
        resources: [{ type: "file", fileKey: "key-1", fileName: "报价表.xlsx" }],
      }],
    },
  );

  assert.equal(outcome.status, "failed");
  assert.deepEqual(replies, [{
    chatId: "chat-live",
    text: "表格处理失败：表格列数过多（16375 列），最多允许 500 列。",
  }]);
});

test("replies with the parser error when polling recovers a spreadsheet completion", async () => {
  const replies = [];
  const sessionsMap = new Map([[
    "spreadsheet-session",
    {
      chatId: "chat-polled",
      expiresAt: Date.now() + 60_000,
      files: [{
        chatId: "chat-polled",
        messageId: "file-polled",
        resources: [{ type: "file", fileKey: "key-2", fileName: "报价表.xlsx" }],
      }],
    },
  ]]);
  const handler = createHandler({
    parseSpreadsheetBuffer: async () => {
      throw new Error("表格列数过多（16375 列），最多允许 500 列。");
    },
    replies,
    sessionsMap,
  });

  await handler.pollSessions();

  assert.deepEqual(replies, [{
    chatId: "chat-polled",
    text: "表格处理失败：表格列数过多（16375 列），最多允许 500 列。",
  }]);
});
