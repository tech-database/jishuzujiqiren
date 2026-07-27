import assert from "node:assert/strict";
import test from "node:test";
import {
  createSpreadsheetSessionManager,
  defaultSpreadsheetSessionTtlMs,
} from "./spreadsheet-session-manager.js";

test("activates isolated spreadsheet sessions and expires them", () => {
  let currentTime = 1000;
  const manager = createSpreadsheetSessionManager({
    ttlMs: 500,
    now: () => currentTime,
  });
  const message = { chatId: "chat-1", senderId: "user-a" };

  const pending = manager.activate(message, "drawing");

  assert.equal(pending.startedAt, 1000);
  assert.equal(pending.expiresAt, 1500);
  assert.equal(pending.tableKey, "drawing");
  assert.equal(manager.get(message), pending);

  currentTime = 1501;
  assert.equal(manager.get(message), null);
  assert.equal(manager.sessions.size, 0);
});

test("queues each spreadsheet message once and renews the session", () => {
  let currentTime = 2000;
  const manager = createSpreadsheetSessionManager({
    ttlMs: 500,
    now: () => currentTime,
  });
  const activation = { chatId: "chat-1", senderId: "user-a" };
  const pending = manager.activate(activation, "paint");
  const file = {
    chatId: "chat-1",
    senderId: "user-a",
    messageId: "file-1",
    resources: [{ type: "file" }],
  };

  currentTime = 2100;
  assert.equal(manager.queueFile(file, pending).queued, true);
  currentTime = 2200;
  assert.equal(manager.queueFile(file, pending).queued, false);

  assert.equal(pending.files.length, 1);
  assert.equal(pending.files[0].tableKey, "paint");
  assert.equal(pending.expiresAt, 2700);
});

test("ends only the matching chat and sender session", () => {
  const manager = createSpreadsheetSessionManager();
  const first = { chatId: "chat-1", senderId: "user-a" };
  const second = { chatId: "chat-1", senderId: "user-b" };
  manager.activate(first, "drawing");
  manager.activate(second, "drawing");

  assert.equal(manager.end(first), true);
  assert.equal(manager.get(first), null);
  assert.notEqual(manager.get(second), null);
});

test("uses a ten-minute session lifetime by default", () => {
  assert.equal(defaultSpreadsheetSessionTtlMs, 10 * 60 * 1000);
});
