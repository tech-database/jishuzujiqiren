export function sanitizeAssignmentError(error) {
  const message = String(error?.message || error || "提交失败");
  return message
    .replace(/(Authorization|Cookie)\s*:\s*[^\s,;]+/gi, "$1: [redacted]")
    .replace(/(token|secret)=([^&\s]+)/gi, "$1=[redacted]");
}
