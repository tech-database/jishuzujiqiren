import assert from "node:assert/strict";
import test from "node:test";

import { localizeRuntimeLog, translateRuntimeMessage } from "./runtime-log-language.js";

test("translates known runtime errors into Chinese", () => {
  assert.equal(translateRuntimeMessage("Service Unavailable", "error"), "服务暂时不可用");
  assert.equal(translateRuntimeMessage("spreadsheet parse failed", "error"), "表格解析失败");
});

test("uses a Chinese summary for unknown English runtime messages", () => {
  const localized = localizeRuntimeLog({
    event: "unknown_internal_event",
    level: "error",
    message: "Unexpected worker initialization failure",
  });

  assert.equal(localized.eventLabel, "机器人运行事件");
  assert.equal(localized.messageLabel, "机器人运行出现异常，请根据事件类型进行排查。");
  assert.doesNotMatch(`${localized.eventLabel}${localized.messageLabel}`, /[A-Za-z]{2,}/);
});

test("keeps existing Chinese business errors unchanged", () => {
  assert.equal(
    translateRuntimeMessage("表格列数过多（16375 列），最多允许 500 列。", "error"),
    "表格列数过多（16375 列），最多允许 500 列。",
  );
});

test("extracts the Chinese business error from an SDK multiline message", () => {
  assert.equal(
    translateRuntimeMessage([
      "[error]: [",
      "Error: 表格检测到 16375 列，系统最多允许 500 列。",
      "at assertSpreadsheetDimensions (spreadsheet-parser.js:221:11)",
      "]",
    ].join("\n"), "error"),
    "表格检测到 16375 列，系统最多允许 500 列。",
  );
});
