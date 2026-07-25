export function chineseBotErrorMessage(error) {
  const message = String(error?.message || error || "").trim();
  if (!message) return "系统处理失败，请稍后重试或联系管理员。";
  if (/[\p{Script=Han}]/u.test(message)) return message;

  const missingMaterial = message.match(/^Material code not found:\s*(.+)$/i);
  if (missingMaterial) {
    return `未找到料号：${missingMaterial[1].replace(/,\s*/g, "，")}`;
  }
  const missingField = message.match(/^Field not found:\s*(.+)$/i);
  if (missingField) return `数据表缺少字段：${missingField[1]}`;
  if (/timeout|timed out/i.test(message)) return "请求超时，请稍后重试。";
  if (/permission|forbidden|unauthorized/i.test(message)) {
    return "飞书接口权限不足，请联系管理员检查应用权限。";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "飞书接口请求过于频繁，请稍后重试。";
  }
  return "系统处理失败，请稍后重试或联系管理员。";
}
