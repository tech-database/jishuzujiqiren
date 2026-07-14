export function aggregateImportResults(results = []) {
  const files = Array.isArray(results) ? results : [];
  const warnings = files.flatMap((item) => item.warnings || []);
  return {
    fileCount: files.length,
    count: files.reduce((sum, item) => sum + Number(item.count || 0), 0),
    parsedCount: files.reduce((sum, item) => sum + Number(item.parsedCount || 0), 0),
    resultCount: files.reduce((sum, item) => sum + Number(item.resultCount || 0), 0),
    warnings,
  };
}

export function buildImportSuccessText(results = []) {
  const summary = aggregateImportResults(results);
  const warningText = summary.warnings.length > 0 ? `；${summary.warnings.length} 条警告` : "";
  return `写入完成：${summary.fileCount} 个文件，共 ${summary.count} 条记录${warningText}`;
}

export function sanitizeImportError(error) {
  const message = String(error?.message || error || "处理失败");
  return message
    .replace(/(Authorization|Cookie)\s*:\s*[^\s,;]+/gi, "$1: [redacted]")
    .replace(/(token|secret)=([^&\s]+)/gi, "$1=[redacted]");
}
