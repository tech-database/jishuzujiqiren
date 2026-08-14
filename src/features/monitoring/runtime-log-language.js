const eventLabels = {
  spreadsheet_completion_failed: "表格处理失败",
  spreadsheet_records_created: "表格写入完成",
  spreadsheet_completion_recovered: "补收完成指令",
  spreadsheet_completion_skipped: "跳过重复完成指令",
  spreadsheet_file_queued: "表格文件已进入队列",
  spreadsheet_session_started: "表格处理会话已开始",
  message_handling_failed: "消息处理失败",
  message_received: "收到飞书消息",
  long_connection_connected: "飞书长连接已连接",
  long_connection_failed: "飞书长连接失败",
  websocket_status_restore_failed: "长连接状态恢复失败",
  runtime_message: "机器人运行消息",
};

const exactMessageTranslations = new Map([
  ["service unavailable", "服务暂时不可用"],
  ["fetch failed", "网络请求失败"],
  ["connection refused", "连接被拒绝"],
  ["permission denied", "权限不足"],
  ["request timeout", "请求超时"],
  ["spreadsheet parse failed", "表格解析失败"],
]);

const technicalMessageTranslations = [
  [/\bECONNREFUSED\b/gi, "连接被拒绝"],
  [/\bENOTFOUND\b/gi, "未找到目标地址"],
  [/\bETIMEDOUT\b/gi, "连接超时"],
  [/\bService Unavailable\b/gi, "服务暂时不可用"],
  [/\bUnauthorized\b/gi, "身份验证失败"],
  [/\bForbidden\b/gi, "权限不足"],
  [/\bpermission denied\b/gi, "权限不足"],
  [/\bfetch failed\b/gi, "网络请求失败"],
  [/\brequest timeout\b/gi, "请求超时"],
  [/\btimed out\b/gi, "操作超时"],
  [/\bspreadsheet parse failed\b/gi, "表格解析失败"],
];

function fallbackMessage(level) {
  if (level === "error") return "机器人运行出现异常，请根据事件类型进行排查。";
  if (level === "warning") return "机器人运行出现警告，请及时检查相关状态。";
  if (level === "debug") return "机器人调试信息已记录。";
  return "机器人运行事件已记录。";
}

function translateRuntimeMessage(message, level) {
  const original = String(message || "").trim();
  if (!original) return fallbackMessage(level);

  const embeddedChineseError = original
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^(?:Error|错误)\s*[:：]\s*(.+)$/i)?.[1] || "")
    .find((line) => /\p{Script=Han}/u.test(line));
  if (embeddedChineseError) return embeddedChineseError;

  const exact = exactMessageTranslations.get(original.toLowerCase());
  if (exact) return exact;

  let translated = original;
  for (const [pattern, replacement] of technicalMessageTranslations) {
    translated = translated.replace(pattern, replacement);
  }

  if (/\p{Script=Han}/u.test(translated) && !/[A-Za-z]{2,}/.test(translated)) {
    return translated;
  }
  if (/\p{Script=Han}/u.test(original) && !/[A-Za-z]{2,}/.test(original)) {
    return original;
  }

  const errorCode = original.match(/\b\d{4,}\b/)?.[0];
  return `${fallbackMessage(level)}${errorCode ? ` 错误代码：${errorCode}。` : ""}`;
}

export function localizeRuntimeLog(log = {}) {
  return {
    eventLabel: eventLabels[log.event] || "机器人运行事件",
    messageLabel: translateRuntimeMessage(log.message, log.level),
  };
}

export { eventLabels, translateRuntimeMessage };
