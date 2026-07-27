import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSpreadsheetProcessingState } from "./spreadsheet-processing-state.js";

async function withTemporaryState(run) {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "spreadsheet-state-"));
  try {
    await run({
      runtimeDir,
      stateFilePath: path.join(runtimeDir, "processed.json"),
    });
  } finally {
    await rm(runtimeDir, { recursive: true, force: true });
  }
}

test("persists and restores processed spreadsheet messages", async () => {
  await withTemporaryState(async (options) => {
    const state = createSpreadsheetProcessingState(options);
    await state.markCompletion("completion-1");
    await state.markFile("file-1");

    const restored = createSpreadsheetProcessingState(options);
    await restored.load();

    assert.equal(restored.hasCompletion("completion-1"), true);
    assert.equal(restored.hasFile("file-1"), true);
    const stored = JSON.parse(await readFile(options.stateFilePath, "utf8"));
    assert.deepEqual(stored.completions, ["completion-1"]);
    assert.deepEqual(stored.files, ["file-1"]);
  });
});

test("allows only one completion handler per spreadsheet session", async () => {
  await withTemporaryState(async (options) => {
    const state = createSpreadsheetProcessingState(options);
    const message = { chatId: "chat-1", senderId: "user-a", messageId: "completion-1" };
    let releaseFirst;
    const first = state.runCompletion(
      message,
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );

    await Promise.resolve();
    const duplicate = await state.runCompletion(message, async () => "duplicate");
    releaseFirst("processed");
    const completed = await first;

    assert.deepEqual(duplicate, { skipped: true, status: "processing" });
    assert.equal(completed.skipped, false);
    assert.equal(completed.result, "processed");
  });
});

test("persists successful commands and releases failed commands", async () => {
  await withTemporaryState(async (options) => {
    const state = createSpreadsheetProcessingState(options);

    await assert.rejects(
      state.runCommand("retryable", async () => {
        throw new Error("temporary failure");
      }),
      /temporary failure/,
    );
    assert.equal((await state.runCommand("retryable", async () => "retried")).skipped, false);
    assert.equal((await state.runCommand("retryable", async () => "duplicate")).skipped, true);
  });
});
