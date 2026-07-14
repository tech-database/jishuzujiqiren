import { memo } from "react";
import { BarChart3 } from "lucide-react";
import { GlassCard } from "../design-system";

function MonitoringEmptyPanelComponent({ title, message }) {
  return (
    <GlassCard className="monitoring-empty-panel">
      <span className="monitoring-empty-icon">
        <BarChart3 size={22} />
      </span>
      <strong>{title}</strong>
      <p>{message}</p>
    </GlassCard>
  );
}

export const MonitoringEmptyPanel = memo(MonitoringEmptyPanelComponent);
