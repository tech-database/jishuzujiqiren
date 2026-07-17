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

  const [done, total] = String(completionRate.label).split("/");

  return (
    <div className="completion-kpi-chart" aria-label="任务完成率">
      <div
        className="completion-ring"
        style={{ "--completion-angle": `${safeValue * 3.6}deg` }}
        aria-hidden="true"
      >
        <div>
          <strong>{safeValue}%</strong>
          <span>完成率</span>
        </div>
      </div>
      <div className="completion-kpi-summary">
        <span>当前检测结果</span>
        <strong>{done} <small>/ {total}</small></strong>
        <p>已完成任务 / 检测任务总数</p>
        <small>当前接口未提供历史趋势对比</small>
      </div>
    </div>
  );
}

export const CompletionRateChart = memo(CompletionRateChartComponent);
