import { motion } from "framer-motion";
import { GlassCard, StatusBadge } from "../design-system";
import { CompletionRateChart } from "./CompletionRateChart";
import { MonitoringMetricCard } from "./MonitoringMetricCard";
import { TaskStatusChart } from "./TaskStatusChart";

export function MonitoringOverview({
  completionRate,
  distribution,
  formatDisplayTime,
  metrics,
  normalized,
  selectedTableLabel,
  statusSyncing,
}) {
  const loading = statusSyncing && !normalized.hasSummary;

  return (
    <>
      <section className="monitoring-metric-grid" aria-label="状态检测指标">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.04,
              duration: 0.28,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <MonitoringMetricCard
              metric={metric}
              loading={loading}
              formatDisplayTime={formatDisplayTime}
            />
          </motion.div>
        ))}
      </section>

      <section className="monitoring-chart-grid">
        <GlassCard className="monitoring-chart-card monitoring-distribution-card">
          <div className="monitoring-panel-head">
            <div>
              <h3>任务状态分布</h3>
              <p>{selectedTableLabel}在当前日期范围内的任务分布。</p>
            </div>
            <StatusBadge tone={distribution.available ? "success" : "warning"}>
              {distribution.available ? "可用" : "暂无数据"}
            </StatusBadge>
          </div>
          <TaskStatusChart distribution={distribution} loading={loading} />
        </GlassCard>

        <GlassCard className="monitoring-chart-card monitoring-completion-card">
          <div className="monitoring-panel-head">
            <div>
              <h3>完成率</h3>
              <p>公式：{selectedTableLabel}已完成数量 / 检测任务总数。</p>
            </div>
            <StatusBadge tone={completionRate.available ? "success" : "warning"}>
              {completionRate.available ? completionRate.label : "暂无数据"}
            </StatusBadge>
          </div>
          <CompletionRateChart completionRate={completionRate} loading={loading} />
        </GlassCard>
      </section>
    </>
  );
}
