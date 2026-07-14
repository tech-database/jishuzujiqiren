import { memo, useMemo } from "react";
import { BaseChart } from "../charts/BaseChart";

const statusColors = {
  unclaimed: "#F59E0B",
  drawing: "#00C2FF",
  done: "#22C55E",
  abnormal: "#EF4444",
};

function TaskStatusChartComponent({ distribution, loading }) {
  const option = useMemo(
    () => ({
      color: distribution.entries.map((item) => statusColors[item.key] || "#1677FF"),
      legend: {
        bottom: 0,
        icon: "circle",
        textStyle: { color: "#64748B", fontSize: 12 },
      },
      series: [
        {
          name: "任务状态",
          type: "pie",
          radius: ["54%", "76%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          label: {
            formatter: "{b}: {c}",
            color: "#172033",
            fontWeight: 700,
          },
          labelLine: {
            lineStyle: { color: "rgba(100,116,139,.4)" },
          },
          data: distribution.entries.map((item) => ({ name: item.name, value: item.value })),
          animationDuration: 420,
        },
      ],
    }),
    [distribution.entries],
  );

  return (
    <BaseChart
      option={option}
      loading={loading}
      empty={!loading && !distribution.available}
      emptyText="暂无任务状态分布数据"
      ariaLabel="任务状态分布图"
    />
  );
}

export const TaskStatusChart = memo(TaskStatusChartComponent);
