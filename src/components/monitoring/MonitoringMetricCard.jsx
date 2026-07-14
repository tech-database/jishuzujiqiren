import { memo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { GlassCard, StatusBadge } from "../design-system";

const iconMap = {
  total: Activity,
  drawing: Loader2,
  done: CheckCircle2,
  abnormal: AlertTriangle,
  lastCheckedAt: Clock,
};

function formatMetricValue(metric, formatDisplayTime) {
  if (metric.type === "time") return metric.value ? formatDisplayTime(metric.value) : "等待检测";
  if (typeof metric.value === "number") return metric.value;
  return "暂无数据";
}

function MonitoringMetricCardComponent({ metric, loading, formatDisplayTime }) {
  const Icon = iconMap[metric.key] || Activity;
  const value = formatMetricValue(metric, formatDisplayTime);

  return (
    <GlassCard className={`monitoring-metric ${metric.tone}`}>
      <div className="monitoring-metric-head">
        <span className="monitoring-metric-icon">
          <Icon size={20} />
        </span>
        <StatusBadge tone={metric.tone === "danger" ? "error" : metric.tone}>{loading ? "加载中" : metric.helper}</StatusBadge>
      </div>
      {loading ? (
        <div className="monitoring-skeleton metric" />
      ) : (
        <strong className={metric.type === "time" ? "time-value" : ""}>{value}</strong>
      )}
      <span>{metric.label}</span>
    </GlassCard>
  );
}

export const MonitoringMetricCard = memo(MonitoringMetricCardComponent);
