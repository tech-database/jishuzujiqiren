import assert from "node:assert/strict";
import test from "node:test";
import { createFeishuMessageHistory } from "./feishu-message-history.js";

function clientFromPages(pages) {
  let call = 0;
  return {
    im: { v1: { message: { list: async () => pages[call++] } } },
  };
}

function createHistory(client, overrides = {}) {
  return createFeishuMessageHistory({
    client,
    isActivationMessage: () => true,
    isCompletionMessage: (message) => message.content.includes("完成"),
    parseActivationTableKey: (content) => (content.includes("油墨") ? "paint" : "drawing"),
    now: () => 500_000,
    ...overrides,
  });
}

test("recovers the newest activation from paginated Feishu history", async () => {
  const history = createHistory(
    clientFromPages([
      {
        data: {
          page_token: "next",
          items: [
            {
              message_id: "activation-old",
              create_time: "100",
              msg_type: "text",
              sender: { id: "user-a" },
              body: { content: JSON.stringify({ text: "新增 胶板" }) },
            },
          ],
        },
      },
      {
        data: {
          items: [
            {
              message_id: "activation-new",
              create_time: "200",
              msg_type: "text",
              sender: { id: "user-a" },
              body: { content: JSON.stringify({ text: "新增 油墨" }) },
            },
          ],
        },
      },
    ]),
  );

  const pending = await history.recoverSession({ chatId: "chat-1", senderId: "user-a" });

  assert.equal(pending.tableKey, "paint");
  assert.equal(pending.startedAt, 200_000);
  assert.equal(pending.recovered, true);
});

test("returns only supported spreadsheet files from the activated sender", async () => {
  const history = createHistory(
    clientFromPages([
      {
        data: {
          items: [
            {
              message_id: "file-1",
              msg_type: "file",
              sender: { id: "user-a" },
              body: { content: JSON.stringify({ file_key: "key-1", file_name: "data.xlsx" }) },
            },
            {
              message_id: "file-2",
              msg_type: "file",
              sender: { id: "user-b" },
              body: { content: JSON.stringify({ file_key: "key-2", file_name: "other.xlsx" }) },
            },
            {
              message_id: "file-3",
              msg_type: "file",
              sender: { id: "user-a" },
              body: { content: JSON.stringify({ file_key: "key-3", file_name: "notes.txt" }) },
            },
          ],
        },
      },
    ]),
  );

  const files = await history.listFiles(
    { chatId: "chat-1" },
    { senderId: "user-a", startedAt: 100_000, tableKey: "drawing" },
  );

  assert.deepEqual(files.map((message) => message.messageId), ["file-1"]);
  assert.equal(files[0].tableKey, "drawing");
});

test("translates missing group-history permission into a business error", async () => {
  const permissionError = Object.assign(new Error("forbidden"), {
    response: { data: { code: 230027 } },
  });
  const history = createHistory(
    {
      im: { v1: { message: { list: async () => Promise.reject(permissionError) } } },
    },
    { permissionErrorMessage: "需要群消息权限" },
  );

  await assert.rejects(
    history.listFiles(
      { chatId: "chat-1" },
      { senderId: "user-a", startedAt: 100_000, tableKey: "drawing" },
    ),
    /需要群消息权限/,
  );
});
