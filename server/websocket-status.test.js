import assert from "node:assert/strict";
import test from "node:test";
import { websocketHeartbeatStatus } from "./websocket-status.js";

test("websocket heartbeat does not turn reconnecting into connected", () => {
  const status = websocketHeartbeatStatus({
    state: "reconnecting",
    reconnectAttempts: 2,
  });

  assert.equal(status.connected, false);
  assert.equal(status.state, "reconnecting");
  assert.equal(status.reconnectAttempts, 2);
});

test("websocket heartbeat reports connected only after the SDK is connected", () => {
  assert.equal(
    websocketHeartbeatStatus({ state: "failed" }).connected,
    false,
  );
  assert.equal(
    websocketHeartbeatStatus({ state: "connected" }).connected,
    true,
  );
});
