import { memo } from "react";

function CompletionRateChartComponent({ completionRate, loading }) {
  const safeValue = completionRate.available && Number.isFinite(completionRate.value)
    ? Number(completionRate.value.toFixed(1))
    : 0;

  if (loading) {
    return (
      <div className="compact-chart-state" aria-label="完成率加载中">
        <span />
        <strong>正在加载完成率</strong>
      </div>
    );
  }

  if (!completionRate.available) {
    return (
      <div className="compact-chart-state" aria-label="暂无完成率数据">
        <strong>暂无完成率数据</strong>
      </div>
    );
  }

  return (
    <div className="completion-kpi-chart" aria-label="任务完成率">
      <div className="completion-kpi-value">
        <span>当前完成率</span>
        <strong>{safeValue}%</strong>
        <small>{completionRate.label}</small>
      </div>
      <div className="completion-kpi-track" aria-hidden="true">
        <span style={{ "--completion-width": `${safeValue}%` }} />
      </div>
      <div className="completion-kpi-scale">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export const CompletionRateChart = memo(CompletionRateChartComponent);
