const messages = {
  idle: "\u98de\u4e66\u957f\u8fde\u63a5\u672a\u8fde\u63a5",
  connecting: "\u6b63\u5728\u8fde\u63a5\u98de\u4e66\u957f\u8fde\u63a5",
  connected: "\u98de\u4e66\u957f\u8fde\u63a5\u5df2\u8fde\u63a5",
  reconnecting: "\u98de\u4e66\u957f\u8fde\u63a5\u6b63\u5728\u91cd\u8fde",
  failed: "\u98de\u4e66\u957f\u8fde\u63a5\u5931\u8d25",
  error: "\u98de\u4e66\u957f\u8fde\u63a5\u5f02\u5e38",
  unknown: "\u98de\u4e66\u957f\u8fde\u63a5\u72b6\u6001\u672a\u77e5",
};

export function websocketHeartbeatStatus(connectionStatus, previousStatus = {}) {
  const state = String(connectionStatus?.state || previousStatus.state || "unknown");
  return {
    connected: state === "connected",
    state,
    message: messages[state] || previousStatus.message || messages.unknown,
    reconnectAttempts: Number(connectionStatus?.reconnectAttempts || 0),
    lastConnectTime: connectionStatus?.lastConnectTime || null,
    nextConnectTime: connectionStatus?.nextConnectTime || null,
  };
}
