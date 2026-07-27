import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { GlassCard, StatusBadge } from "../design-system";

function insightCopy({ hasBackgroundError, hasHealthError, historicalTimestampAnomalies }) {
  if (hasHealthError) return "检测到飞书凭证、数据表或长连接异常，请及时处理。";
  if (hasBackgroundError) return "检测到后台接口返回错误，请及时处理。";
  if (historicalTimestampAnomalies > 0) {
    return "历史记录存在缺失时间，凌晨扫描已保留原值，未自动补写。";
  }
  return "后台检测链路当前没有异常记录。";
}

export function MonitoringInsight({
  backgroundSyncStatus,
  hasBackgroundError,
  hasHealthError,
  hasMonitoringIssue,
  healthErrorText,
  historicalTimestampAnomalies,
}) {
  return (
    <section className="monitoring-insight-grid">
      <GlassCard className={`monitoring-error-panel ${hasMonitoringIssue ? "has-error" : "healthy"}`}>
        <div className="monitoring-panel-head">
          <div>
            <h3>{hasMonitoringIssue ? "异常监控" : "当前运行正常"}</h3>
            <p>
              {insightCopy({
                hasBackgroundError,
                hasHealthError,
                historicalTimestampAnomalies,
              })}
            </p>
          </div>
          <StatusBadge tone={hasMonitoringIssue ? "warning" : "success"}>
            {hasMonitoringIssue ? "需要关注" : "运行正常"}
          </StatusBadge>
        </div>
        {hasHealthError ? (
          <div className="monitoring-error-message">
            <AlertTriangle size={18} />
            <span>{healthErrorText}</span>
          </div>
        ) : hasBackgroundError ? (
          <div className="monitoring-error-message">
            <AlertTriangle size={18} />
            <span>{backgroundSyncStatus.lastError}</span>
          </div>
        ) : historicalTimestampAnomalies > 0 ? (
          <div className="monitoring-error-message">
            <AlertTriangle size={18} />
            <span>
              发现 {historicalTimestampAnomalies} 项历史时间缺失；状态可纠正，领取/完成时间保持不变。
            </span>
          </div>
        ) : (
          <div className="monitoring-health-message">
            <CheckCircle2 size={20} />
            <div>
              <strong>暂无异常记录</strong>
              <span>仅在接口返回真实错误时显示红色告警。</span>
            </div>
          </div>
        )}
      </GlassCard>
    </section>
  );
}
