import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Calculator, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";
import { StatusPulse } from "../motion";
import { CompletionRateChart } from "./CompletionRateChart";
import { LiveLogPanel } from "./LiveLogPanel";
import { MonitoringMetricCard } from "./MonitoringMetricCard";
import { TaskStatusChart } from "./TaskStatusChart";
import {
  buildMetricCards,
  buildStatusDistribution,
  calculateCompletionRate,
  normalizeLogEntries,
  normalizeStatusData,
} from "../../utils/monitoringDataTransform";

const tableOptions = [
  { key: "board", label: "胶板" },
  { key: "paint", label: "油漆" },
];

function MonitoringTableSelector({ value, onChange }) {
  return (
    <div className="monitoring-table-selector" role="group" aria-label="查询表">
      {tableOptions.map((option) => (
        <button
          type="button"
          key={option.key}
          className={value === option.key ? "active" : ""}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DateField({ label, hint, value, onChange }) {
  return (
    <label className="monitoring-date-field">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function MonitoringCenter({
  configReady,
  targetTable,
  setTargetTable,
  statusDateRange,
  setStatusDateRange,
  statusSyncing,
  backgroundSyncStatus,
  statusResult,
  statusState,
  syncDrawingStatus,
  recalculateDrawingDurations,
  formatDisplayTime,
}) {
  const normalized = useMemo(
    () => normalizeStatusData(statusResult, backgroundSyncStatus),
    [backgroundSyncStatus, statusResult],
  );
  const distribution = useMemo(() => buildStatusDistribution(normalized.summary), [normalized.summary]);
  const completionRate = useMemo(() => calculateCompletionRate(normalized.summary), [normalized.summary]);
  const metrics = useMemo(
    () => buildMetricCards(normalized, backgroundSyncStatus).filter((metric) => metric.key !== "lastCheckedAt"),
    [backgroundSyncStatus, normalized],
  );
  const logs = useMemo(
    () => normalizeLogEntries({ backgroundSyncStatus, statusResult, statusState, formatDisplayTime }),
    [backgroundSyncStatus, formatDisplayTime, statusResult, statusState],
  );
  const healthTone = backgroundSyncStatus?.lastError ? "error" : backgroundSyncStatus?.lastCheckedAt ? "online" : "standby";
  const healthLabel = backgroundSyncStatus?.lastError
    ? "异常待处理"
    : backgroundSyncStatus?.lastCheckedAt
      ? "已检测"
      : configReady
        ? "等待检测"
        : "未知状态";
  const hasBackgroundError = Boolean(backgroundSyncStatus?.lastError);
  const lastCheckedLabel = backgroundSyncStatus?.lastCheckedAt
    ? formatDisplayTime(backgroundSyncStatus.lastCheckedAt)
    : "等待首次检测";
  const intervalLabel = backgroundSyncStatus?.intervalMs
    ? `${Math.round(backgroundSyncStatus.intervalMs / 1000)} 秒自动检查`
    : "自动检查间隔未提供";

  return (
    <motion.section
      className="monitoring-command-center"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard className="monitoring-hero">
        <div className="section-title-block">
          <span className="section-icon">
            <Activity size={24} />
          </span>
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
          <StatusBadge tone={configReady ? "success" : "warning"}>{configReady ? "配置已填写" : "等待配置"}</StatusBadge>
        </div>
      </GlassCard>

      <GlassCard className="monitoring-control-surface">
        <div className="monitoring-filter-grid">
          <DateField
            label="开始日期"
            hint="默认前天"
            value={statusDateRange.startDate}
            onChange={(startDate) => setStatusDateRange((current) => ({ ...current, startDate }))}
          />
          <DateField
            label="结束日期"
            hint="默认今天"
            value={statusDateRange.endDate}
            onChange={(endDate) => setStatusDateRange((current) => ({ ...current, endDate }))}
          />
          <div className="monitoring-table-field">
            <span>查询表</span>
            <MonitoringTableSelector value={targetTable} onChange={setTargetTable} />
          </div>
        </div>
        <div className="monitoring-control-actions">
          {statusState && <div className={`monitoring-inline-result ${statusState.ok ? "ok" : "error"}`}>{statusState.text}</div>}
          <GlassButton variant="secondary" onClick={recalculateDrawingDurations} disabled={statusSyncing || !configReady}>
            <Calculator size={17} />
            {statusSyncing ? "处理中" : "重算用时"}
          </GlassButton>
          <GlassButton variant="primary" onClick={() => syncDrawingStatus()} disabled={statusSyncing || !configReady}>
            <RefreshCw size={17} />
            {statusSyncing ? "检测中" : "立即检测"}
          </GlassButton>
        </div>
      </GlassCard>

      <section className="monitoring-metric-grid" aria-label="状态检测指标">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <MonitoringMetricCard metric={metric} loading={statusSyncing && !normalized.hasSummary} formatDisplayTime={formatDisplayTime} />
          </motion.div>
        ))}
      </section>

      <section className="monitoring-chart-grid">
        <GlassCard className="monitoring-chart-card monitoring-distribution-card">
          <div className="monitoring-panel-head">
            <div>
              <h3>任务状态分布</h3>
              <p>来自 `summary.unclaimed / drawing / done` 与真实总数差值。</p>
            </div>
            <StatusBadge tone={distribution.available ? "success" : "warning"}>{distribution.available ? "可用" : "暂无数据"}</StatusBadge>
          </div>
          <TaskStatusChart distribution={distribution} loading={statusSyncing && !normalized.hasSummary} />
        </GlassCard>

        <GlassCard className="monitoring-chart-card monitoring-completion-card">
          <div className="monitoring-panel-head">
            <div>
              <h3>完成率</h3>
              <p>公式：已完成数量 / 检测任务总数。</p>
            </div>
            <StatusBadge tone={completionRate.available ? "success" : "warning"}>{completionRate.available ? completionRate.label : "暂无数据"}</StatusBadge>
          </div>
          <CompletionRateChart completionRate={completionRate} loading={statusSyncing && !normalized.hasSummary} />
        </GlassCard>
      </section>

      <section className="monitoring-insight-grid">
        <GlassCard className={`monitoring-error-panel ${hasBackgroundError ? "has-error" : "healthy"}`}>
          <div className="monitoring-panel-head">
            <div>
              <h3>{hasBackgroundError ? "异常监控" : "当前运行正常"}</h3>
              <p>{hasBackgroundError ? "检测到后台接口返回错误，请及时处理。" : "后台检测链路当前没有异常记录。"}</p>
            </div>
            <StatusBadge tone={hasBackgroundError ? "error" : "success"}>
              {hasBackgroundError ? "需要处理" : "运行正常"}
            </StatusBadge>
          </div>
          {hasBackgroundError ? (
            <div className="monitoring-error-message">
              <AlertTriangle size={18} />
              <span>{backgroundSyncStatus.lastError}</span>
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

      <LiveLogPanel logs={logs} loading={statusSyncing && logs.length === 0} />
    </motion.section>
  );
}
