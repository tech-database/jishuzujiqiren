import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  combineMultilineLogLines,
  defaultRuntimeLogPaths,
  loadRuntimeLogs,
  parseLogLine,
  redactSensitiveText,
} from "./runtime-log-reader.js";

test("combines an SDK multiline error into one runtime log", () => {
  const lines = combineMultilineLogLines([
    "2026-08-14T16:52:52.000Z: [error]: [",
    "2026-08-14T16:52:52.000Z: Error: 表格检测到 16375 列，系统最多允许 500 列。",
    "2026-08-14T16:52:52.000Z:     at assertSpreadsheetDimensions (spreadsheet-parser.js:221:11)",
    "2026-08-14T16:52:52.000Z: ]",
  ].join("\n"));

  assert.equal(lines.length, 1);
  const entry = parseLogLine(lines[0], "stdout");
  assert.equal(entry.level, "error");
  assert.match(entry.message, /表格检测到 16375 列/);
  assert.match(entry.message, /assertSpreadsheetDimensions/);
});

test("parses structured PM2 runtime logs and preserves the business error", () => {
  const entry = parseLogLine(
    '2026-08-14T16:52:52.000Z: {"timestamp":"2026-08-14T08:52:52.000Z","level":"error","service":"tech-bot-feishu-ws","event":"spreadsheet_completion_failed","error":"表格列数过多（16375 列），最多允许 500 列。"}',
    "stderr",
  );

  assert.equal(entry.timestamp, "2026-08-14T08:52:52.000Z");
  assert.equal(entry.level, "error");
  assert.equal(entry.event, "spreadsheet_completion_failed");
  assert.equal(entry.message, "表格列数过多（16375 列），最多允许 500 列。");
  assert.equal(entry.source, "stderr");
  assert.match(entry.id, /^[a-f0-9]{16}$/);
});

test("redacts credentials from unstructured runtime logs", () => {
  assert.equal(
    redactSensitiveText("authorization=Bearer abc.def token=secret-value"),
    "authorization=Bearer [REDACTED] token=[REDACTED]",
  );
});

test("loads, combines and limits runtime logs without accepting a caller path", async () => {
  const requestedPaths = [];
  const result = await loadRuntimeLogs({
    limit: 1,
    paths: { stdout: "/fixed/out.log", stderr: "/fixed/error.log" },
    readTail: async (filePath) => {
      requestedPaths.push(filePath);
      if (filePath.endsWith("out.log")) {
        return '2026-08-14T10:00:00.000Z: {"timestamp":"2026-08-14T10:00:00.000Z","level":"info","event":"connected"}';
      }
      return "2026-08-14T11:00:00.000Z: spreadsheet parse failed";
    },
  });

  assert.deepEqual(requestedPaths, ["/fixed/out.log", "/fixed/error.log"]);
  assert.equal(result.limit, 1);
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0].level, "error");
  assert.equal(result.logs[0].message, "spreadsheet parse failed");
});

test("uses the fixed PM2 log filenames for the Feishu websocket service", () => {
  assert.deepEqual(defaultRuntimeLogPaths({ pm2Home: "/srv/pm2" }), {
    stdout: path.join("/srv/pm2", "logs", "tech-bot-feishu-ws-out.log"),
    stderr: path.join("/srv/pm2", "logs", "tech-bot-feishu-ws-error.log"),
  });
});
