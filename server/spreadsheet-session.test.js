import assert from "node:assert/strict";
import test from "node:test";
import { spreadsheetSessionKey } from "./spreadsheet-session.js";

test("isolates spreadsheet sessions by both chat and sender", () => {
  const senderA = spreadsheetSessionKey({ chatId: "chat-1", senderId: "user-a" });
  const senderB = spreadsheetSessionKey({ chatId: "chat-1", senderId: "user-b" });

  assert.notEqual(senderA, senderB);
  assert.equal(
    senderA,
    spreadsheetSessionKey({ chatId: "chat-1", senderId: "user-a" }),
  );
});

test("keeps direct-message sessions isolated by sender", () => {
  assert.notEqual(
    spreadsheetSessionKey({ senderId: "user-a" }),
    spreadsheetSessionKey({ senderId: "user-b" }),
  );
});
