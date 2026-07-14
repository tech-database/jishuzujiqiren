export function toSafeNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}

export function normalizeDrawingStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "drawing") {
    return { key: "drawing", label: "绘图中", tone: "warning" };
  }
  if (normalized === "idle") {
    return { key: "idle", label: "空闲", tone: "success" };
  }
  return { key: "unknown", label: "未知状态", tone: "neutral" };
}

export function normalizeActiveItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      table: String(item?.table || "unknown"),
      recordId: String(item?.recordId || index),
      materialCode: String(item?.materialCode || "未填料号").trim() || "未填料号",
    }))
    .filter((item) => item.materialCode);
}

export function normalizeDrawingOperators(ownerStats) {
  const items = Array.isArray(ownerStats?.items) ? ownerStats.items : [];
  return items.map((item, index) => {
    const status = normalizeDrawingStatus(item?.status);
    const activeItems = normalizeActiveItems(item?.activeItems);
    return {
      id: `${String(item?.owner || "unknown")}-${index}`,
      owner: String(item?.owner || "未知人员").trim() || "未知人员",
      status,
      drawingCount: toSafeNumber(item?.drawingCount),
      todayClaimed: toSafeNumber(item?.todayClaimed),
      todayCompleted: toSafeNumber(item?.todayCompleted),
      totalOwned: toSafeNumber(item?.totalOwned),
      activeItems,
      searchText: [
        item?.owner,
        status.label,
        ...activeItems.map((activeItem) => activeItem.materialCode),
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}

export function buildDrawingSummary(ownerStats, operators = normalizeDrawingOperators(ownerStats)) {
  const summary = ownerStats?.summary || {};
  return {
    owners: toSafeNumber(summary.owners, operators.length),
    drawing: toSafeNumber(summary.drawing, operators.filter((item) => item.status.key === "drawing").length),
    idle: toSafeNumber(summary.idle, operators.filter((item) => item.status.key === "idle").length),
    drawingCount: toSafeNumber(
      summary.drawingCount,
      operators.reduce((sum, item) => sum + item.drawingCount, 0),
    ),
    todayClaimed: toSafeNumber(summary.todayClaimed),
    todayCompleted: toSafeNumber(summary.todayCompleted),
    totalRecords: toSafeNumber(ownerStats?.totalRecords),
    checkedAt: ownerStats?.checkedAt || "",
  };
}

export function filterDrawingOperators(operators = [], query = "", statusFilter = "all") {
  const keyword = query.trim().toLowerCase();
  return operators.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status.key === statusFilter;
    const matchesQuery = !keyword || item.searchText.includes(keyword);
    return matchesStatus && matchesQuery;
  });
}

export function getOperatorActivePartNumber(operator) {
  return operator?.activeItems?.[0]?.materialCode || "";
}

export function getVisibleActiveItems(operator, limit = 5) {
  const activeItems = Array.isArray(operator?.activeItems) ? operator.activeItems : [];
  return {
    items: activeItems.slice(0, limit),
    hiddenCount: Math.max(0, activeItems.length - limit),
  };
}
