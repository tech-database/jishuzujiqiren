import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Clock3, MapPinned, RefreshCw, Sigma, UsersRound } from "lucide-react";
import { AnalyticsBarChart } from "./AnalyticsBarChart.jsx";
import { GlassButton, GlassCard } from "../design-system";

const tableOptions = [
  { key: "board", label: "胶板" },
  { key: "paint", label: "油漆" },
];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialDateRange() {
  const today = new Date();
  return {
    startDate: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: formatDateInput(today),
  };
}

function formatMetric(value, suffix = "") {
  if (value === null || value === undefined) return "暂无数据";
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(Number(value))}${suffix}`;
}

function AnalyticsTableSelector({ value, onChange }) {
  return (
    <div className="analytics-table-selector" role="group" aria-label="数据表">
      {tableOptions.map((option) => (
        <button
          type="button"
          className={value === option.key ? "active" : ""}
          key={option.key}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value, detail, tone = "blue", primary = false }) {
  return (
    <div className={`analytics-summary-metric ${tone} ${primary ? "primary" : ""}`}>
      <span className="analytics-summary-icon"><Icon size={19} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

export default function DataAnalyticsCenter({ configReady, targetTable, setTargetTable }) {
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async (signal) => {
    if (!configReady) return;
    if (dateRange.startDate && dateRange.endDate && dateRange.startDate > dateRange.endDate) {
      setError("开始日期不能晚于结束日期");
      setData(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const searchParams = new URLSearchParams({
        tableKey: targetTable,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const response = await fetch(`/api/drawing-analytics?${searchParams.toString()}`, { signal });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "数据统计失败");
      setData(result);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "数据统计失败");
        setData(null);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [configReady, dateRange.endDate, dateRange.startDate, targetTable]);

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics]);

  const durationItems = useMemo(
    () => (data?.owners || []).filter((item) => item.averageDuration !== null),
    [data?.owners],
  );
  const tableLabel = targetTable === "paint" ? "油漆" : "胶板";
  const summary = data?.summary || {};

  return (
    <section className="analytics-center">
      <GlassCard className="analytics-filter-bar">
        <label className="analytics-filter-field">
          <span>开始日期</span>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(event) => setDateRange((current) => ({ ...current, startDate: event.target.value }))}
          />
        </label>
        <label className="analytics-filter-field">
          <span>结束日期</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(event) => setDateRange((current) => ({ ...current, endDate: event.target.value }))}
          />
        </label>
        <div className="analytics-filter-field">
          <span>数据表</span>
          <AnalyticsTableSelector value={targetTable} onChange={setTargetTable} />
        </div>
        <GlassButton variant="primary" onClick={() => loadAnalytics()} disabled={loading || !configReady}>
          <RefreshCw size={17} className={loading ? "spin" : ""} />
          {loading ? "统计中" : "刷新数据"}
        </GlassButton>
      </GlassCard>

      {error && <div className="analytics-error" role="alert">{error}</div>}

      <GlassCard className={`analytics-summary ${loading ? "loading" : ""}`} aria-label={`${tableLabel}统计概览`}>
        <SummaryMetric
          icon={BarChart3}
          label={`${tableLabel}绘图总数`}
          value={loading && !data ? "—" : formatMetric(summary.total)}
          detail={`${dateRange.startDate} 至 ${dateRange.endDate}`}
          tone="blue"
          primary
        />
        <SummaryMetric
          icon={Sigma}
          label="绘图总分值"
          value={loading && !data ? "—" : formatMetric(summary.totalScore)}
          detail={`${summary.scoredRecords || 0} 条记录已填写分值`}
          tone="cyan"
        />
        <SummaryMetric
          icon={Clock3}
          label="整体平均用时"
          value={loading && !data ? "—" : formatMetric(summary.averageDuration, " 分")}
          detail={`${summary.durationRecords || 0} 条记录可计算`}
          tone="orange"
        />
        <SummaryMetric
          icon={UsersRound}
          label="参与绘图人员"
          value={loading && !data ? "—" : formatMetric(summary.owners)}
          detail={`${summary.regions || 0} 个业务区域`}
          tone="green"
        />
      </GlassCard>

      <div className={`analytics-chart-grid ${loading ? "loading" : ""}`}>
        <AnalyticsBarChart
          title="绘图人绘图数量"
          description={`${tableLabel}表内各绘图人的记录数量。`}
          items={data?.owners}
          valueKey="count"
          suffix=" 条"
          tone="blue"
          loading={loading}
        />
        <AnalyticsBarChart
          title="绘图人分值"
          description="按绘图人汇总已填写的分值。"
          items={data?.owners}
          valueKey="score"
          suffix=" 分"
          tone="cyan"
          loading={loading}
          emptyText="当前日期范围内没有已填写分值的记录"
        />
        <AnalyticsBarChart
          title={`${tableLabel}平均时长`}
          description="按绘图人计算可用记录的平均用时。"
          items={durationItems}
          valueKey="averageDuration"
          suffix=" 分"
          tone="orange"
          loading={loading}
          emptyText="当前日期范围内没有可计算用时的记录"
        />
        <AnalyticsBarChart
          title={`${tableLabel}区域绘图数量`}
          description="按区域汇总当前日期范围内的绘图记录。"
          items={data?.regions}
          valueKey="count"
          suffix=" 条"
          tone="green"
          loading={loading}
          emptyText="当前日期范围内没有区域数据"
        />
      </div>

      {!loading && data?.summary?.total === 0 && (
        <GlassCard className="analytics-zero-state">
          <MapPinned size={24} />
          <div>
            <strong>当前日期范围没有绘图数据</strong>
            <span>请扩大日期范围，或切换胶板/油漆表后重试。</span>
          </div>
        </GlassCard>
      )}
    </section>
  );
}
