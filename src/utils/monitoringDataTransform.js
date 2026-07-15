function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampCount(value) {
  const number = toNumber(value);
  if (number === null) return null;
  return Math.max(0, Math.round(number));
}

export function normalizeStatusData(statusResult, backgroundSyncStatus) {
  const rawSummary = statusResult?.summary || backgroundSyncStatus?.lastSummary || null;
  const total = clampCount(rawSummary?.total);
  const unclaimed = clampCount(rawSummary?.unclaimed);
  const drawing = clampCount(rawSummary?.drawing);
  const done = clampCount(rawSummary?.done);
  const updated = clampCount(rawSummary?.updated);

  const hasSummary = [total, unclaimed, drawing, done].some((value) => value !== null);
  const knownTotal = total ?? 0;
  const knownStatusTotal = (unclaimed ?? 0) + (drawing ?? 0) + (done ?? 0);
  const abnormal = hasSummary && total !== null ? Math.max(0, knownTotal - knownStatusTotal) : null;

  return {
    hasSummary,
    table: statusResult?.table || backgroundSyncStatus?.range?.tableKey || "",
    summary: {
      total,
      unclaimed,
      drawing,
      done,
      updated,
      abnormal,
    },
    items: Array.isArray(statusResult?.items) ? statusResult.items : [],
    background: backgroundSyncStatus || null,
  };
}

export function calculateCompletionRate(summary) {
  const total = clampCount(summary?.total);
  const done = clampCount(summary?.done);
  if (total === null || done === null || total <= 0) {
    return { available: false, value: null, label: "暂无数据" };
  }
  const safeDone = Math.min(Math.max(done, 0), total);
  return {
    available: true,
    value: (safeDone / total) * 100,
    label: `${safeDone}/${total}`,
  };
}

export function buildStatusDistribution(summary) {
  const entries = [
    { key: "unclaimed", name: "未领取", value: clampCount(summary?.unclaimed), tone: "warning" },
    { key: "drawing", name: "绘图中", value: clampCount(summary?.drawing), tone: "info" },
    { key: "done", name: "已完成", value: clampCount(summary?.done), tone: "success" },
    { key: "abnormal", name: "异常", value: clampCount(summary?.abnormal), tone: "danger" },
  ].filter((item) => item.value !== null && item.value > 0);

  return {
    available: entries.length > 0,
    entries,
  };
}

export function buildMetricCards(normalized, backgroundSyncStatus) {
  const summary = normalized.summary;
  return [
    {
      key: "total",
      label: "检测任务总数",
      value: summary.total,
      helper: "当前日期范围",
      tone: "neutral",
    },
    {
      key: "drawing",
      label: "处理中",
      value: summary.drawing,
      helper: "绘图中任务",
      tone: "warning",
    },
    {
      key: "done",
      label: "已完成",
      value: summary.done,
      helper: "完成任务",
      tone: "success",
    },
    {
      key: "abnormal",
      label: "异常数量",
      value: summary.abnormal,
      helper: backgroundSyncStatus?.lastError ? "存在后台异常" : "由真实状态差值计算",
      tone: summary.abnormal > 0 ? "danger" : "neutral",
    },
    {
      key: "lastCheckedAt",
      label: "最近检测时间",
      value: backgroundSyncStatus?.lastCheckedAt || "",
      helper: backgroundSyncStatus?.running ? "后台检测运行中" : "后台检测状态",
      tone: backgroundSyncStatus?.lastError ? "danger" : backgroundSyncStatus?.lastCheckedAt ? "success" : "neutral",
      type: "time",
    },
  ];
}

export function normalizeLogEntries({ backgroundSyncStatus, statusResult, statusState, formatDisplayTime }) {
  const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const logs = [];

  if (backgroundSyncStatus?.running) {
    logs.push({
      id: "running",
      time: now,
      level: "info",
      message: "后台检测正在运行",
    });
  }
  if (statusResult?.summary) {
    logs.push({
      id: "summary",
      time: now,
      level: "success",
      message: `检测结果已更新：共 ${statusResult.summary.total} 项，绘图中 ${statusResult.summary.drawing} 项，已完成 ${statusResult.summary.done} 项`,
    });
  }
  if (backgroundSyncStatus?.lastCheckedAt) {
    logs.push({
      id: "checked",
      time: formatDisplayTime(backgroundSyncStatus.lastCheckedAt).split(" ").pop() || now,
      level: "info",
      message: "最近一次后台检测完成",
    });
  }
  if (backgroundSyncStatus?.lastChangedAt) {
    logs.push({
      id: "changed",
      time: formatDisplayTime(backgroundSyncStatus.lastChangedAt).split(" ").pop() || now,
      level: "warning",
      message: "检测到任务状态发生变化",
    });
  }
  if (backgroundSyncStatus?.lastError) {
    logs.push({
      id: "error",
      time: now,
      level: "error",
      message: `后台检测异常：${backgroundSyncStatus.lastError}`,
    });
  }
  if (statusState?.text) {
    logs.push({
      id: "status-state",
      time: now,
      level: statusState.ok ? "success" : "error",
      message: statusState.text,
    });
  }

  return logs.slice(0, 40);
}
