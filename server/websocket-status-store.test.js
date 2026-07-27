import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createWebsocketStatusStore } from "./websocket-status-store.js";

test("websocket status store merges state and persists the latest snapshot", async () => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "tech-bot-websocket-"));
  const statusFilePath = path.join(runtimeDir, "status.json");
  const store = createWebsocketStatusStore({
    runtimeDir,
    statusFilePath,
    now: () => new Date("2026-07-27T08:00:00.000Z"),
    pid: 1234,
  });

  try {
    const firstWrite = store.persistStatus({
      connected: false,
      state: "reconnecting",
    });
    const secondWrite = store.persistStatus({
      connected: true,
      state: "connected",
      message: "连接已恢复",
    });
    await Promise.all([firstWrite, secondWrite]);

    assert.deepEqual(store.getStatus(), {
      connected: true,
      state: "connected",
      message: "连接已恢复",
    });
    const saved = JSON.parse(await readFile(statusFilePath, "utf8"));
    assert.deepEqual(saved, {
      pid: 1234,
      updatedAt: "2026-07-27T08:00:00.000Z",
      connected: true,
      state: "connected",
      message: "连接已恢复",
    });
  } finally {
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("websocket status snapshots cannot mutate internal state", () => {
  const store = createWebsocketStatusStore({
    runtimeDir: path.join(os.tmpdir(), "unused-websocket-status"),
  });
  const snapshot = store.getStatus();
  snapshot.connected = true;

  assert.equal(store.getStatus().connected, false);
});
