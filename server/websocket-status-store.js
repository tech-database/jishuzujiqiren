import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function createWebsocketStatusStore({
  runtimeDir,
  statusFilePath = path.join(runtimeDir, "long-connection-status.json"),
  now = () => new Date(),
  pid = process.pid,
} = {}) {
  let writeQueue = Promise.resolve();
  let runtimeStatus = {
    connected: false,
    state: "idle",
    message: "飞书长连接未连接",
  };

  async function writeStatus(status) {
    await mkdir(runtimeDir, { recursive: true });
    await writeFile(
      statusFilePath,
      JSON.stringify(
        {
          pid,
          updatedAt: now().toISOString(),
          ...status,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  function persistStatus(status) {
    runtimeStatus = { ...runtimeStatus, ...status };
    const snapshot = { ...runtimeStatus };
    writeQueue = writeQueue
      .catch(() => {})
      .then(() => writeStatus(snapshot));
    return writeQueue;
  }

  function getStatus() {
    return { ...runtimeStatus };
  }

  return {
    getStatus,
    persistStatus,
  };
}
