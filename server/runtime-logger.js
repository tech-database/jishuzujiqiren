function maskIdentifier(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return `${text.slice(0, 2)}***`;
  return `${text.slice(0, 4)}***${text.slice(-4)}`;
}

function sanitizeFields(fields = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (/^(senderId|chatId|messageId|fileKey)$/i.test(key)) {
      sanitized[key] = maskIdentifier(value);
      continue;
    }
    if (/token|secret|password|authorization|content|body/i.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    sanitized[key] = value instanceof Error ? value.message : value;
  }
  return sanitized;
}

export function createRuntimeLogger({ sink = console, service = "tech-bot" } = {}) {
  function write(level, event, fields) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      event,
      ...sanitizeFields(fields),
    };
    const output = JSON.stringify(entry);
    const writer = level === "error" ? sink.error : level === "warn" ? sink.warn : sink.log;
    writer.call(sink, output);
  }

  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}

export { maskIdentifier, sanitizeFields };
