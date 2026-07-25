import assert from "node:assert/strict";
import test from "node:test";
import { pollPendingSpreadsheetSessions } from "./spreadsheet-session-polling.js";

test("continues polling later spreadsheet sessions when one session fails", async () => {
  const sessions = new Map([
    ["failed-session", { chatId: "chat-a", expiresAt: 2000 }],
    ["healthy-session", { chatId: "chat-b", expiresAt: 2000 }],
  ]);
  const handled = [];
  const errors = [];

  await pollPendingSpreadsheetSessions({
    sessions,
    now: 1000,
    listCompletions: async (chatId) => {
      if (chatId === "chat-a") throw new Error("temporary Feishu timeout");
      return [{ messageId: "completion-b" }];
    },
    handleCompletion: async (completion) => {
      handled.push(completion.messageId);
    },
    onError: (error, key) => {
      errors.push([key, error.message]);
    },
  });

  assert.deepEqual(errors, [["failed-session", "temporary Feishu timeout"]]);
  assert.deepEqual(handled, ["completion-b"]);
});

test("removes expired sessions without querying Feishu", async () => {
  const sessions = new Map([
    ["expired-session", { chatId: "chat-expired", expiresAt: 999 }],
  ]);
  let queryCount = 0;

  await pollPendingSpreadsheetSessions({
    sessions,
    now: 1000,
    listCompletions: async () => {
      queryCount += 1;
      return [];
    },
    handleCompletion: async () => {},
  });

  assert.equal(queryCount, 0);
  assert.equal(sessions.size, 0);
});
