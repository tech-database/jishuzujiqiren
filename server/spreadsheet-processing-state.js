import { mkdir, readFile, writeFile } from "node:fs/promises";
import { MessageIdempotency, trimSetToRecent } from "./message-idempotency.js";
import { spreadsheetSessionKey } from "./spreadsheet-session.js";

export function createSpreadsheetProcessingState({
  runtimeDir,
  stateFilePath,
  completionHistoryLimit = 100,
  fileHistoryLimit = 300,
  now = () => Date.now(),
  onCommandPersistError = () => {},
} = {}) {
  const completionMessageIds = new Set();
  const fileMessageIds = new Set();
  const completionLocks = new Set();
  let writeQueue = Promise.resolve();
  let commandIdempotency;

  async function save() {
    writeQueue = writeQueue
      .catch(() => {})
      .then(async () => {
        trimSetToRecent(completionMessageIds, completionHistoryLimit);
        trimSetToRecent(fileMessageIds, fileHistoryLimit);
        await mkdir(runtimeDir, { recursive: true });
        await writeFile(
          stateFilePath,
          JSON.stringify(
            {
              updatedAt: new Date(now()).toISOString(),
              completions: [...completionMessageIds],
              files: [...fileMessageIds],
              commands: commandIdempotency.snapshot(),
            },
            null,
            2,
          ),
          "utf8",
        );
      });
    await writeQueue;
  }

  commandIdempotency = new MessageIdempotency({
    now,
    onChange: save,
    onPersistError: onCommandPersistError,
  });

  async function load() {
    try {
      const data = JSON.parse(await readFile(stateFilePath, "utf8"));
      completionMessageIds.clear();
      fileMessageIds.clear();
      for (const id of data.completions || []) completionMessageIds.add(id);
      for (const id of data.files || []) fileMessageIds.add(id);
      trimSetToRecent(completionMessageIds, completionHistoryLimit);
      trimSetToRecent(fileMessageIds, fileHistoryLimit);
      commandIdempotency.restore(data.commands || []);
    } catch {
      // Best-effort runtime state: a missing or damaged file must not prevent startup.
    }
  }

  async function markCompletion(messageId) {
    const id = String(messageId || "").trim();
    if (!id) return false;
    completionMessageIds.add(id);
    await save();
    return true;
  }

  async function markFile(messageId) {
    const id = String(messageId || "").trim();
    if (!id) return false;
    fileMessageIds.add(id);
    await save();
    return true;
  }

  async function runCompletion(message, handler) {
    const messageId = String(message.messageId || "").trim();
    const messageKey = messageId ? `message:${messageId}` : "";
    const sessionKey = `session:${spreadsheetSessionKey(message)}`;
    if (completionLocks.has(sessionKey) || (messageKey && completionLocks.has(messageKey))) {
      return { skipped: true, status: "processing" };
    }

    completionLocks.add(sessionKey);
    if (messageKey) completionLocks.add(messageKey);
    try {
      return { skipped: false, status: "success", result: await handler() };
    } finally {
      completionLocks.delete(sessionKey);
      if (messageKey) completionLocks.delete(messageKey);
    }
  }

  return {
    load,
    save,
    hasCompletion: (messageId) => completionMessageIds.has(String(messageId || "").trim()),
    hasFile: (messageId) => fileMessageIds.has(String(messageId || "").trim()),
    markCompletion,
    markFile,
    runCommand: (messageId, handler) => commandIdempotency.run(messageId, handler),
    runCompletion,
  };
}
