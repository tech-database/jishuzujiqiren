import { memo } from "react";

const statusColors = {
  unclaimed: "#F59E0B",
  drawing: "#00C2FF",
  done: "#22C55E",
  abnormal: "#EF4444",
};

function TaskStatusChartComponent({ distribution, loading }) {
  if (loading) {
    return (
      <div className="compact-chart-state" aria-label="任务状态分布加载中">
        <span />
        <strong>正在加载状态数据</strong>
      </div>
    );
  }

  if (!distribution.available) {
    return (
      <div className="compact-chart-state" aria-label="暂无任务状态分布数据">
        <strong>暂无任务状态分布数据</strong>
      </div>
    );
  }

  const total = distribution.entries.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="status-stack-chart" aria-label="任务状态分布">
      <div className="status-stack-total">
        <span>当前检测任务</span>
        <strong>{total}</strong>
      </div>
      <div className="status-stack-bar" aria-hidden="true">
        {distribution.entries.map((item) => (
          <span
            key={item.key}
            style={{
              "--segment-color": statusColors[item.key] || "#1677FF",
              "--segment-width": `${Math.max((item.value / total) * 100, 3)}%`,
            }}
          />
        ))}
      </div>
      <div className="status-stack-list">
        {distribution.entries.map((item) => {
          const percent = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div className="status-stack-item" key={item.key}>
              <span style={{ "--dot-color": statusColors[item.key] || "#1677FF" }} />
              <div>
                <strong>{item.name}</strong>
                <small>{percent.toFixed(1)}%</small>
              </div>
              <b>{item.value}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TaskStatusChart = memo(TaskStatusChartComponent);
