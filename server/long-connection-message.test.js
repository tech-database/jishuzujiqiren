import assert from "node:assert/strict";
import test from "node:test";
import {
  isActivationMessage,
  isCompletionMessage,
  isDrawingCompleteCommand,
  isHelpCommand,
  isOrderConfirmationCommand,
  isStatusSyncCommand,
  isUnclaimedQueryCommand,
} from "./long-connection-message.js";

const mentioned = (content) => ({ mentionedBot: true, content, resources: [] });

test("matches supported long-connection text commands", () => {
  assert.equal(isActivationMessage(mentioned("@机器人 胶板新增")), true);
  assert.equal(isCompletionMessage(mentioned("@机器人 完成")), true);
  assert.equal(isHelpCommand(mentioned("@机器人 帮助")), true);
  assert.equal(isDrawingCompleteCommand(mentioned("@机器人 绘图完成 A001")), true);
  assert.equal(isOrderConfirmationCommand(mentioned("@机器人 下单确认 A001")), true);
  assert.equal(isUnclaimedQueryCommand(mentioned("@机器人 查询全部未领取")), true);
  assert.equal(isStatusSyncCommand(mentioned("@机器人 状态检测")), true);
});

test("does not treat file messages or unmentioned text as commands", () => {
  assert.equal(isCompletionMessage({ content: "完成", resources: [] }), false);
  assert.equal(
    isCompletionMessage({
      mentionedBot: true,
      content: "完成",
      resources: [{ type: "file" }],
    }),
    false,
  );
});
