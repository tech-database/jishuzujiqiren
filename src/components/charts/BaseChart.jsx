import { memo, useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { GaugeChart, PieChart } from "echarts/charts";
import { LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([GaugeChart, PieChart, LegendComponent, TooltipComponent, CanvasRenderer]);

function readThemeTokens() {
  if (typeof window === "undefined") {
    return {
      primary: "#1677FF",
      cyan: "#00C2FF",
      success: "#22C55E",
      warning: "#F59E0B",
      danger: "#EF4444",
      ink: "#172033",
      muted: "#64748B",
    };
  }
  const styles = window.getComputedStyle(document.documentElement);
  const token = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    primary: token("--color-primary", "#1677FF"),
    cyan: token("--color-cyan", "#00C2FF"),
    success: token("--color-success", "#22C55E"),
    warning: token("--color-warning", "#F59E0B"),
    danger: token("--color-danger", "#EF4444"),
    ink: token("--color-ink", "#172033"),
    muted: token("--color-muted", "#64748B"),
  };
}

function BaseChartComponent({ option, loading = false, empty = false, error = "", emptyText = "暂无数据", ariaLabel }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const theme = useMemo(readThemeTokens, []);

  useEffect(() => {
    if (!chartRef.current || empty || error) return undefined;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, null, { renderer: "canvas" });
    }
    return undefined;
  }, [empty, error]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || empty || error) return;
    instance.setOption(
      {
        textStyle: {
          color: theme.ink,
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        tooltip: {
          trigger: "item",
          confine: true,
          backgroundColor: "rgba(255,255,255,0.86)",
          borderColor: "rgba(255,255,255,0.62)",
          borderWidth: 1,
          textStyle: { color: theme.ink },
          extraCssText: "backdrop-filter: blur(16px); border-radius: 12px; box-shadow: 0 18px 40px rgba(15,35,70,.14);",
        },
        ...option,
      },
      true,
    );
    if (loading) instance.showLoading("default", { text: "加载中", color: theme.primary, textColor: theme.muted });
    else instance.hideLoading();
  }, [empty, error, loading, option, theme]);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    if (typeof ResizeObserver === "undefined") {
      const resize = () => instanceRef.current?.resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const resizeObserver = new ResizeObserver(() => {
      instanceRef.current?.resize();
    });
    resizeObserver.observe(chartRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="chart-state error" role="status">
        <strong>图表加载失败</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="chart-state empty" role="status">
        <strong>{emptyText}</strong>
      </div>
    );
  }

  return <div className="base-chart" ref={chartRef} role="img" aria-label={ariaLabel} />;
}

export const BaseChart = memo(BaseChartComponent);
