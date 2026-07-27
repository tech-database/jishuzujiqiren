import { Activity, Clock3 } from "lucide-react";
import { GlassCard, StatusBadge } from "../design-system";
import { StatusPulse } from "../motion";

export function MonitoringHero({
  backgroundSyncStatus,
  configReady,
  healthLabel,
  healthTone,
  intervalLabel,
  lastCheckedLabel,
  statusSyncing,
}) {
  return (
    <GlassCard className="monitoring-hero">
      <div className="section-title-block">
        <span className="section-icon"><Activity size={24} /></span>
        <div>
          <h2>机器人运行监控中心</h2>
          <p>基于真实状态检测接口展示任务分布、完成率、后台检测状态和实时日志。</p>
        </div>
      </div>
      <div className="monitoring-hero-status">
        <div className="monitoring-runtime-meta">
          <span><Clock3 size={14} />最近检测 {lastCheckedLabel}</span>
          <span>{intervalLabel}</span>
        </div>
        <StatusPulse
          tone={statusSyncing ? "running" : healthTone}
          label={statusSyncing ? "检测中" : healthLabel}
          detail={backgroundSyncStatus?.running ? "后台检测运行中" : "实时状态"}
        />
        <StatusBadge tone={configReady ? "success" : "warning"}>
          {configReady ? "配置已填写" : "等待配置"}
        </StatusBadge>
      </div>
    </GlassCard>
  );
}
