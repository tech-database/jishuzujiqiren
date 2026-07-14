import { memo, useMemo } from "react";
import { BaseChart } from "../charts/BaseChart";

function CompletionRateChartComponent({ completionRate, loading }) {
  const option = useMemo(
    () => ({
      series: [
        {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          splitNumber: 4,
          radius: "96%",
          progress: {
            show: true,
            roundCap: true,
            width: 14,
            itemStyle: { color: "#1677FF" },
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 14,
              color: [[1, "rgba(22,119,255,.12)"]],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: {
            offsetCenter: [0, "28%"],
            color: "#64748B",
            fontSize: 12,
            fontWeight: 700,
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, "-6%"],
            formatter: "{value}%",
            color: "#172033",
            fontSize: 30,
            fontWeight: 700,
          },
          data: [{ value: Number(completionRate.value.toFixed(1)), name: completionRate.label }],
          animationDuration: 420,
        },
      ],
    }),
    [completionRate],
  );

  return (
    <BaseChart
      option={option}
      loading={loading}
      empty={!loading && !completionRate.available}
      emptyText="暂无完成率数据"
      ariaLabel="任务完成率仪表图"
    />
  );
}

export const CompletionRateChart = memo(CompletionRateChartComponent);
