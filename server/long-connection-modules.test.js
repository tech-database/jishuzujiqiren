import assert from "node:assert/strict";
import test from "node:test";

import { streamToBuffer } from "./feishu-resource-downloader.js";
import { createLongConnectionCommandHandlers } from "./long-connection-command-handlers.js";

test("resource downloader combines streamed Feishu chunks", async () => {
  async function* chunks() {
    yield Buffer.from("hello ");
    yield Buffer.from("world");
  }
  assert.equal((await streamToBuffer(chunks())).toString(), "hello world");
});

test("long-connection command handlers use injected business services", async () => {
  const replies = [];
  const handlers = createLongConnectionCommandHandlers({
    claimDrawingOwners: async (options) => {
      assert.deepEqual(options.materialCodes, ["A-001"]);
      assert.equal(options.senderId, "user-1");
      return [{ materialCode: "A-001" }];
    },
    completeDrawings: async () => [],
    confirmDrawingOrders: async () => ({ result: [], missing: [] }),
    extractMaterialCodes: () => ["A-001"],
    queryUnclaimedDrawings: async () => ({ count: 0, items: [] }),
    sendReply: async (chatId, text) => replies.push({ chatId, text }),
    syncDrawingStatuses: async () => ({
      summary: { unclaimed: 0, drawing: 0, done: 0 },
    }),
  });

  await handlers.drawClaim({
    chatId: "chat-1",
    content: "A-001 领图",
    senderId: "user-1",
    senderName: "测试用户",
  });

  assert.deepEqual(replies, [{ chatId: "chat-1", text: "领图成功：A-001" }]);
});
