import assert from "node:assert/strict";
import test from "node:test";
import {
  createRuntimeLogger,
  maskIdentifier,
  sanitizeFields,
} from "./runtime-logger.js";

test("masks message identifiers and removes sensitive payloads", () => {
  assert.equal(maskIdentifier("ou_1234567890"), "ou_1***7890");
  assert.deepEqual(
    sanitizeFields({
      chatId: "oc_1234567890",
      content: "客户订单正文",
      token: "tenant-token",
      count: 3,
    }),
    {
      chatId: "oc_1***7890",
      content: "[REDACTED]",
      token: "[REDACTED]",
      count: 3,
    },
  );
});

test("writes structured JSON events to the selected log level", () => {
  const entries = [];
  const logger = createRuntimeLogger({
    service: "test-service",
    sink: {
      log: (entry) => entries.push(entry),
      warn: (entry) => entries.push(entry),
      error: (entry) => entries.push(entry),
    },
  });

  logger.error("message_failed", {
    messageId: "message-123456",
    error: new Error("network unavailable"),
  });

  const entry = JSON.parse(entries[0]);
  assert.equal(entry.level, "error");
  assert.equal(entry.service, "test-service");
  assert.equal(entry.event, "message_failed");
  assert.equal(entry.messageId, "mess***3456");
  assert.equal(entry.error, "network unavailable");
});
