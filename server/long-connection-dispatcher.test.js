import assert from "node:assert/strict";
import test from "node:test";
import { createLongConnectionDispatcher } from "./long-connection-dispatcher.js";

function setup() {
  const calls = [];
  const pending = { files: [] };
  const handlers = {
    getId: async () => calls.push("get-id"),
    runOnce: async (_message, name, callback) => {
      calls.push(name);
      return callback();
    },
    drawingComplete: async () => calls.push("drawing-complete-handler"),
    orderConfirmation: async () => calls.push("order-handler"),
    unclaimedQuery: async () => calls.push("unclaimed"),
    statusSync: async () => calls.push("status"),
    drawClaim: async () => calls.push("claim"),
    spreadsheetCompletion: async () => calls.push("complete-sheet"),
  };
  const dispatch = createLongConnectionDispatcher({
    activationReply: "activated",
    getWebsocketStatus: () => ({ connected: true }),
    handlers,
    logger: { info: () => {}, error: () => {} },
    messageHistory: { recoverSession: async () => pending },
    persistWebsocketStatus: async () => {},
    sendReply: async (_chatId, text) => calls.push(text),
    spreadsheetSessions: {
      activate: () => calls.push("activate"),
      get: () => null,
      queueFile: () => calls.push("queue-file"),
    },
  });
  return { calls, dispatch };
}

test("dispatcher routes help before spreadsheet handling", async () => {
  const { calls, dispatch } = setup();
  await dispatch({ chatId: "c1", content: "@bot help", mentionedBot: true, messageId: "m1" });
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0], "string");
  assert.ok(calls[0].length > 20);
});

test("dispatcher routes a mentioned drawing claim through idempotency", async () => {
  const { calls, dispatch } = setup();
  await dispatch({
    chatId: "c1",
    content: "@机器人 领图 A-001",
    mentionedBot: true,
    messageId: "m2",
  });
  assert.deepEqual(calls, ["draw-claim", "claim"]);
});
