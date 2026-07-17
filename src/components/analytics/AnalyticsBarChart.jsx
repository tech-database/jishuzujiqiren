import { GlassCard, StatusBadge } from "../design-system";

const toneColors = {
  blue: "#2563eb",
  cyan: "#0ea5e9",
  green: "#16a34a",
  orange: "#ea580c",
};

function formatMetric(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

export function AnalyticsBarChart({ title, description, items, valueKey, suffix = "", tone = "blue", emptyText, loading = false }) {
  const availableItems = (items || [])
    .filter((item) => Number.isFinite(Number(item[valueKey])))
    .sort((left, right) => Number(right[valueKey]) - Number(left[valueKey]));
  const maxValue = Math.max(...availableItems.map((item) => Number(item[valueKey])), 0);

  return (
    <GlassCard className="analytics-chart-panel">
      <header className="analytics-panel-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <StatusBadge tone={availableItems.length > 0 ? "success" : "warning"}>
          {loading ? "统计中" : availableItems.length > 0 ? `${availableItems.length} 项` : "暂无数据"}
        </StatusBadge>
      </header>

      {loading && availableItems.length === 0 ? (
        <div className="analytics-chart-skeleton" aria-label={`${title}加载中`}>
          <span /><span /><span /><span />
        </div>
      ) : availableItems.length === 0 ? (
        <div className="analytics-empty-state">{emptyText || "当前日期范围内暂无可统计数据"}</div>
      ) : (
        <div className="analytics-column-scroll">
          <div
            className="analytics-column-chart"
            role="list"
            aria-label={title}
            style={{ "--chart-min-width": `${Math.max(availableItems.length * 86, 360)}px` }}
          >
            {availableItems.map((item) => {
              const value = Number(item[valueKey]);
              const height = maxValue > 0 ? Math.max((value / maxValue) * 82, value > 0 ? 4 : 0) : 0;
              return (
                <div className="analytics-column-item" role="listitem" key={item.name}>
                  <div className="analytics-column-plot" style={{ "--bar-height": `${height}%` }}>
                    <span className="analytics-column-value">{formatMetric(value)}{suffix}</span>
                    <span
                      className="analytics-column-bar"
                      aria-hidden="true"
                      style={{ "--bar-color": toneColors[tone] || toneColors.blue }}
                    />
                  </div>
                  <strong title={item.name}>{item.name}</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
