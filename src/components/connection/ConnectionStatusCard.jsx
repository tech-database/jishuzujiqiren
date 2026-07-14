import { memo } from "react";
import { Clock, HelpCircle } from "lucide-react";
import { GlassCard, StatusBadge } from "../design-system";

function resolveBadgeTone(tone) {
  if (tone === "danger") return "error";
  if (tone === "success" || tone === "warning") return tone;
  return "neutral";
}

function ConnectionStatusCardComponent({ icon: Icon = HelpCircle, title, status, detail, meta, tone = "neutral" }) {
  return (
    <GlassCard className={`connection-status-card ${tone}`}>
      <div className="connection-status-top">
        <span className="connection-status-icon">
          <Icon size={22} />
        </span>
        <StatusBadge tone={resolveBadgeTone(tone)}>{status}</StatusBadge>
      </div>
      <div className="connection-status-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div className="connection-status-meta">
        <Clock size={15} />
        {meta || "暂无数据"}
      </div>
    </GlassCard>
  );
}

export const ConnectionStatusCard = memo(ConnectionStatusCardComponent);
