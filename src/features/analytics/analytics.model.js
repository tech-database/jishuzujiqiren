export function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function initialAnalyticsDateRange(now = new Date()) {
  const today = new Date(now);
  return {
    startDate: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: formatDateInput(today),
  };
}

export function analyticsRangeError(range) {
  if (range.startDate && range.endDate && range.startDate > range.endDate) {
    return "开始日期不能晚于结束日期";
  }
  return "";
}

export function formatAnalyticsMetric(value, suffix = "") {
  if (value === null || value === undefined) return "暂无数据";
  return `${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
  }).format(Number(value))}${suffix}`;
}
