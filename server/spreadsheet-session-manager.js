import { spreadsheetSessionKey } from "./spreadsheet-session.js";

export const defaultSpreadsheetSessionTtlMs = 10 * 60 * 1000;

export function createSpreadsheetSessionManager({
  ttlMs = defaultSpreadsheetSessionTtlMs,
  now = () => Date.now(),
  onSenderMismatch = () => {},
} = {}) {
  const sessions = new Map();

  function activate(message, tableKey) {
    const startedAt = now();
    const pending = {
      chatId: message.chatId,
      startedAt,
      expiresAt: startedAt + ttlMs,
      senderId: message.senderId,
      tableKey,
      files: [],
    };
    sessions.set(spreadsheetSessionKey(message), pending);
    return pending;
  }

  function get(message) {
    const key = spreadsheetSessionKey(message);
    const pending = sessions.get(key);
    if (!pending) return null;
    if (pending.expiresAt < now()) {
      sessions.delete(key);
      return null;
    }
    if (pending.senderId && pending.senderId !== message.senderId) {
      onSenderMismatch(message, pending);
      return null;
    }
    return pending;
  }

  function end(message) {
    return sessions.delete(spreadsheetSessionKey(message));
  }

  function renew(pending) {
    pending.expiresAt = now() + ttlMs;
    return pending;
  }

  function queueFile(message, pending = get(message)) {
    if (!pending) return { pending: null, queued: false };
    const duplicate =
      message.messageId &&
      pending.files.some((fileMessage) => fileMessage.messageId === message.messageId);
    if (!duplicate) {
      pending.files.push({ ...message, tableKey: pending.tableKey });
    }
    renew(pending);
    return { pending, queued: !duplicate };
  }

  return {
    sessions,
    activate,
    get,
    end,
    renew,
    queueFile,
  };
}
