import { RefreshCw, Search, X } from "lucide-react";
import { GlassButton, StatusBadge } from "../design-system";

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "drawing", label: "绘图中" },
  { value: "idle", label: "空闲" },
  { value: "unknown", label: "未知状态" },
];

export default function DrawingToolbar({
  query,
  statusFilter,
  total,
  visible,
  loading,
  configReady,
  onQueryChange,
  onStatusFilterChange,
  onRefresh,
}) {
  return (
    <section className="drawing-toolbar" aria-label="绘图动态搜索和刷新">
      <label className="drawing-search-field">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索绘图人或当前料号"
          aria-label="搜索绘图人或当前料号"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} aria-label="清空搜索">
            <X size={16} />
          </button>
        )}
      </label>

      <div className="drawing-toolbar-actions">
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          aria-label="按绘图状态筛选"
        >
          {statusOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <StatusBadge tone={visible > 0 ? "success" : "warning"}>
          {visible} / {total} 位
        </StatusBadge>
        <GlassButton type="button" variant="secondary" onClick={onRefresh} disabled={loading || !configReady}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          {loading ? "刷新中" : "刷新"}
        </GlassButton>
      </div>
    </section>
  );
}
