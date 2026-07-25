import assert from "node:assert/strict";
import test from "node:test";
import { chineseBotErrorMessage } from "./bot-reply-language.js";

test("keeps Chinese business errors unchanged", () => {
  assert.equal(
    chineseBotErrorMessage(new Error("该料号尚未领图，请先领图")),
    "该料号尚未领图，请先领图",
  );
});

test("translates known English errors and hides unknown English errors", () => {
  assert.equal(
    chineseBotErrorMessage(new Error("Material code not found: A-001, B-002")),
    "未找到料号：A-001，B-002",
  );
  assert.equal(
    chineseBotErrorMessage(new Error("socket unexpectedly closed")),
    "系统处理失败，请稍后重试或联系管理员。",
  );
});
