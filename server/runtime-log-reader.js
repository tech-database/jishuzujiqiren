import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const defaultReadBytes = 512 * 1024;
const maximumLogLimit = 500;
const sensitiveFieldPattern = /(app[_-]?secret|password|access[_-]?token|tenant[_-]?token|token)(\s*[=:]\s*|["']\s*:\s*["']?)([^\s,"'}]+)/gi;

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/(authorization\s*[=:]\s*)Bearer\s+[A-Za-z0-9._~-]+/gi, "$1Bearer [REDACTED]")
    .replace(/(authorization\s*[=:]\s*)(?!Bearer\b)([^\s,"'}]+)/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(sensitiveFieldPattern, (_match, field, separator) => `${field}${separator}[REDACTED]`);
}

async function readFileTail(filePath, maxBytes = defaultReadBytes) {
  let handle;
  try {
    handle = await open(filePath, "r");
    const stats = await handle.stat();
    const bytesToRead = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, stats.size - bytesToRead);
    const text = buffer.toString("utf8");
    return stats.size > bytesToRead ? text.slice(text.indexOf("\n") + 1) : text;
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  } finally {
    await handle?.close();
  }
}

function parseTimestampPrefix(line) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}[T ][^\s]+?)\s*:\s+/);
  if (!match) return { line, timestamp: "" };
  const parsed = new Date(match[1]);
  return {
    line: line.slice(match[0].length),
    timestamp: Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString(),
  };
}

function inferLevel(value, source) {
  const text = String(value || "");
  if (source === "stderr" || /\b(error|failed|failure|exception|fatal)\b/i.test(text)) return "error";
  if (/\b(warn|warning|retry|timeout)\b/i.test(text)) return "warning";
  if (/\b(debug|trace)\b/i.test(text)) return "debug";
  return "info";
}

function stableLogId(entry) {
  return createHash("sha256")
    .update(`${entry.source}\n${entry.timestamp}\n${entry.event}\n${entry.message}`)
    .digest("hex")
    .slice(0, 16);
}

function parseLogLine(rawLine, source) {
  const trimmed = String(rawLine || "").trim();
  if (!trimmed) return null;
  const prefixed = parseTimestampPrefix(trimmed);
  const jsonStart = prefixed.line.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const payload = JSON.parse(prefixed.line.slice(jsonStart));
      const details = Object.fromEntries(
        Object.entries(payload).filter(
          ([key]) => !["timestamp", "level", "service", "event"].includes(key),
        ),
      );
      const message = redactSensitiveText(
        typeof details.error === "string"
          ? details.error
          : typeof details.message === "string"
            ? details.message
            : payload.event || prefixed.line,
      ).slice(0, 4000);
      const entry = {
        timestamp: payload.timestamp || prefixed.timestamp,
        level: ["error", "warn", "warning", "info", "debug"].includes(payload.level)
          ? payload.level === "warn" ? "warning" : payload.level
          : inferLevel(message, source),
        service: String(payload.service || "tech-bot-feishu-ws"),
        event: String(payload.event || "runtime_message"),
        message,
        source,
      };
      return { ...entry, id: stableLogId(entry) };
    } catch {
      // Fall through and return the original line as a safe plain-text entry.
    }
  }

  const message = redactSensitiveText(prefixed.line).slice(0, 4000);
  const entry = {
    timestamp: prefixed.timestamp,
    level: inferLevel(message, source),
    service: "tech-bot-feishu-ws",
    event: "runtime_message",
    message,
    source,
  };
  return { ...entry, id: stableLogId(entry) };
}

export function defaultRuntimeLogPaths({ homeDir = os.homedir(), pm2Home = process.env.PM2_HOME } = {}) {
  const logDir = pm2Home || path.join(homeDir, ".pm2");
  return {
    stdout: path.join(logDir, "logs", "tech-bot-feishu-ws-out.log"),
    stderr: path.join(logDir, "logs", "tech-bot-feishu-ws-error.log"),
  };
}

export async function loadRuntimeLogs({
  limit = 200,
  paths = defaultRuntimeLogPaths(),
  readTail = readFileTail,
} = {}) {
  const normalizedLimit = Math.min(maximumLogLimit, Math.max(1, Number(limit) || 200));
  const sources = [
    ["stdout", paths.stdout],
    ["stderr", paths.stderr],
  ];
  const logs = [];
  for (const [source, filePath] of sources) {
    const text = await readTail(filePath);
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseLogLine(line, source);
      if (parsed) logs.push(parsed);
    }
  }
  logs.sort((left, right) => {
    const leftTime = Date.parse(left.timestamp) || 0;
    const rightTime = Date.parse(right.timestamp) || 0;
    return rightTime - leftTime;
  });
  return {
    logs: logs.slice(0, normalizedLimit),
    limit: normalizedLimit,
    generatedAt: new Date().toISOString(),
  };
}

export { parseLogLine, redactSensitiveText };
