import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownWideNarrow,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  ClipboardList,
  FileSpreadsheet,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { PageTransition } from "../../components/motion/index.js";
import { CountUpNumber } from "../../components/home/CountUpNumber.jsx";
import {
  getInitialQuoteDashboard,
  getQuoteDashboard,
} from "./quote-dashboard.api.js";

const dashboardScopes = [
  { key: "all", label: "全部", description: "胶板、油漆与软体合并" },
  { key: "board", label: "胶板", description: "胶板报价与胶板绘图表" },
  { key: "paint", label: "油漆", description: "油漆报价与油漆绘图表" },
  { key: "soft", label: "软体", description: "软体报价数据" },
];

const metricToneClasses = {
  blue: "quote-kpi-blue",
  green: "quote-kpi-green",
  indigo: "quote-kpi-indigo",
  violet: "quote-kpi-violet",
  cyan: "quote-kpi-cyan",
};

function formatWan(value) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0) / 10000).replace(/^/, "¥").concat("万");
}

function formatRate(value) {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function formatLocalDate(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function monthDateRange(month) {
  const [year, monthNumber] = String(month).split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatMonthLabel(month, currentMonth) {
  const [year, monthNumber] = String(month).split("-").map(Number);
  const currentYear = Number(String(currentMonth).slice(0, 4));
  return year === currentYear ? `${monthNumber}月` : `${year}年${monthNumber}月`;
}

function scopedDashboard(data, scope) {
  if (!data) return null;
  if (scope === "all") return data;
  if (data.categories?.[scope]) return data.categories[scope];
  if (scope !== "soft") return null;

  const officers = (data.officers || []).filter((officer) => officer.category === "软体");
  const summary = officers.reduce(
    (result, officer) => ({
      fileCount: result.fileCount + officer.fileCount,
      unitPrice: result.unitPrice + officer.unitPrice,
      total: result.total + officer.total,
    }),
    { fileCount: 0, unitPrice: 0, total: 0 },
  );

  return {
    summary,
    monthSummary: {
      fileCount: summary.fileCount,
      quoteTotal: summary.total,
      orderCount: 0,
      orderTotal: 0,
      conversionRate: summary.total > 0 ? 0 : null,
    },
    officers,
    regions: [],
    businesses: [],
  };
}

function rankClass(index) {
  if (index === 0) return "quote-rank-first";
  if (index === 1) return "quote-rank-second";
  if (index === 2) return "quote-rank-third";
  return "";
}

function MetricCard({ icon: Icon, label, value, note, tone }) {
  return (
    <article className={`quote-kpi ${metricToneClasses[tone] || metricToneClasses.blue}`}>
      <span className="quote-kpi-icon"><Icon size={22} /></span>
      <div className="quote-kpi-content">
        <span>{label}</span>
        <strong title={value}>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </article>
  );
}

function RateMetricCard({ rate, monthLabel }) {
  const reduceMotion = useReducedMotion();
  const numericRate = Number.isFinite(Number(rate)) ? Number(rate) : 0;
  const visualRate = Math.min(100, Math.max(0, numericRate));
  const rateSizeClass = numericRate >= 1000
    ? "quote-rate-long"
    : numericRate >= 100
      ? "quote-rate-wide"
      : "";

  return (
    <article
      className="quote-kpi quote-kpi-rate quote-kpi-cyan"
      aria-label={`${monthLabel}下单率 ${rate === null || rate === undefined ? "暂无数据" : `${numericRate.toFixed(1)}%`}`}
    >
      <div className="quote-kpi-rate-gauge">
        <span className="quote-kpi-rate-ticks" aria-hidden="true" />
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="quote-kpi-rate-track" cx="50" cy="50" r="41" pathLength="1" />
          <motion.circle
            className="quote-kpi-rate-value"
            cx="50"
            cy="50"
            r="41"
            pathLength="1"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: visualRate / 100 }}
            transition={{ duration: reduceMotion ? 0 : 1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="quote-kpi-rate-number">
          {rate === null || rate === undefined
            ? <strong>—</strong>
            : (
                <CountUpNumber
                  className={rateSizeClass}
                  value={numericRate}
                  decimals={1}
                  suffix="%"
                />
              )}
        </div>
      </div>
      <div className="quote-kpi-rate-copy">
        <span className="quote-kpi-rate-title">
          {monthLabel}下单率
          <TrendingUp size={18} aria-hidden="true" />
        </span>
        <small>{monthLabel}报价转化率</small>
      </div>
    </article>
  );
}

function SectionHeading({ icon: Icon, title, description, aside }) {
  return (
    <header className="quote-report-heading">
      <div>
        <span className="quote-report-heading-icon"><Icon size={17} /></span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {aside}
    </header>
  );
}

function OfficerOverview({
  officers,
  startDate,
  endDate,
  onRangeChange,
  loading,
}) {
  const totals = officers.reduce(
    (result, officer) => ({
      fileCount: result.fileCount + officer.fileCount,
      unitPrice: result.unitPrice + officer.unitPrice,
      total: result.total + officer.total,
    }),
    { fileCount: 0, unitPrice: 0, total: 0 },
  );

  return (
    <section
      className={`quote-report-panel quote-officer-panel ${loading ? "is-loading" : ""}`.trim()}
      aria-busy={loading}
    >
      <SectionHeading
        icon={UsersRound}
        title="报价员概览"
      />
      <div className="quote-officer-range-filter" aria-label="报价员统计日期区间">
        <input
          className="quote-report-filter"
          type="date"
          aria-label="报价员统计开始日期"
          value={startDate}
          max={endDate}
          disabled={loading}
          onChange={(event) => {
            const nextStartDate = event.target.value;
            if (!nextStartDate) return;
            onRangeChange({
              startDate: nextStartDate,
              endDate: nextStartDate > endDate ? nextStartDate : endDate,
            });
          }}
        />
        <span>至</span>
        <input
          className="quote-report-filter"
          type="date"
          aria-label="报价员统计结束日期"
          value={endDate}
          min={startDate}
          disabled={loading}
          onChange={(event) => {
            const nextEndDate = event.target.value;
            if (!nextEndDate) return;
            onRangeChange({
              startDate: nextEndDate < startDate ? nextEndDate : startDate,
              endDate: nextEndDate,
            });
          }}
        />
      </div>
      <div className="quote-officer-cards">
        {officers.map((officer) => (
          <article className="quote-officer-card" key={officer.name}>
            <div className="quote-officer-card-heading">
              <span className="quote-officer-avatar"><UsersRound size={20} /></span>
              <strong>{officer.name}</strong>
            </div>
            <div className="quote-officer-card-detail">
              <span>报价类别</span>
              <strong>{officer.category}</strong>
              <b>{officer.fileCount} 份</b>
            </div>
            <div className="quote-officer-card-metrics">
              <span>
                <small>单价合计</small>
                <strong>{formatWan(officer.unitPrice)}</strong>
              </span>
              <span>
                <small>总价合计</small>
                <strong>{formatWan(officer.total)}</strong>
              </span>
            </div>
          </article>
        ))}
      </div>
      <div className="quote-officer-totals">
        <span><small>区间报价</small><strong>{totals.fileCount} 份</strong></span>
        <span><small>单价合计</small><strong>{formatWan(totals.unitPrice)}</strong></span>
        <span><small>总价合计</small><strong>{formatWan(totals.total)}</strong></span>
      </div>
    </section>
  );
}

function RegionComparison({ items, selectedMonth, onMonthChange, loading }) {
  const [sortKey, setSortKey] = useState("quoteTotal");
  const sortedItems = useMemo(() => (
    items
      .map((item, index) => ({
        item,
        index,
        conversionRate: item.quoteTotal > 0
          ? (item.orderTotal / item.quoteTotal) * 100
          : null,
      }))
      .sort((left, right) => {
        const leftValue = sortKey === "conversionRate"
          ? left.conversionRate
          : Number(left.item[sortKey] || 0);
        const rightValue = sortKey === "conversionRate"
          ? right.conversionRate
          : Number(right.item[sortKey] || 0);
        if (leftValue === null && rightValue === null) return left.index - right.index;
        if (leftValue === null) return 1;
        if (rightValue === null) return -1;
        return rightValue - leftValue || left.index - right.index;
      })
      .map(({ item }) => item)
  ), [items, sortKey]);

  const sortButton = (key, label) => (
    <button
      className={`quote-sort-button ${sortKey === key ? "is-active" : ""}`.trim()}
      type="button"
      aria-label={`${label}从高到低排序`}
      title={`按${label}从高到低排序`}
      onClick={() => setSortKey(key)}
    >
      <span>{label}</span>
      <ArrowDownWideNarrow size={13} aria-hidden="true" />
    </button>
  );

  return (
    <section
      className={`quote-report-panel quote-region-panel ${loading ? "is-loading" : ""}`.trim()}
      aria-busy={loading}
    >
      <SectionHeading
        icon={ChartNoAxesColumnIncreasing}
        title="区域报价与下单对比"
        aside={(
          <input
            className="quote-report-filter"
            type="month"
            aria-label="区域统计月份"
            value={selectedMonth}
            disabled={loading}
            onChange={(event) => {
              if (event.target.value) onMonthChange(event.target.value);
            }}
          />
        )}
      />
      {items.length > 0 ? (
        <>
          <div className="quote-region-table-wrap">
            <table className="quote-region-table">
              <thead>
                <tr>
                  <th>区域</th>
                  <th aria-sort={sortKey === "quoteTotal" ? "descending" : "none"}>
                    {sortButton("quoteTotal", "报价金额")}
                  </th>
                  <th aria-sort={sortKey === "orderTotal" ? "descending" : "none"}>
                    {sortButton("orderTotal", "下单金额")}
                  </th>
                  <th aria-sort={sortKey === "conversionRate" ? "descending" : "none"}>
                    {sortButton("conversionRate", "下单率")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const rate = item.quoteTotal > 0
                    ? (item.orderTotal / item.quoteTotal) * 100
                    : null;
                  const progress = rate === null ? 0 : Math.min(100, Math.max(0, rate));

                  return (
                    <tr key={item.name}>
                      <th scope="row" title={item.name}>{item.name}</th>
                      <td className="quote-region-quote">{formatWan(item.quoteTotal)}</td>
                      <td className="quote-region-order">{formatWan(item.orderTotal)}</td>
                      <td>
                        <div className="quote-region-rate">
                          <strong>{formatRate(rate)}</strong>
                          <span aria-hidden="true">
                            <i style={{ width: `${progress}%` }} />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="quote-dashboard-empty">所选时间范围暂无可对比的区域数据</div>
      )}
    </section>
  );
}

function BusinessRanking({ items, selectedMonth, onMonthChange, loading }) {
  const [sortKey, setSortKey] = useState("quoteTotal");
  const sortedItems = useMemo(() => (
    items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const leftValue = Number(left.item[sortKey] ?? -Infinity);
        const rightValue = Number(right.item[sortKey] ?? -Infinity);
        return rightValue - leftValue || left.index - right.index;
      })
      .map(({ item }) => item)
  ), [items, sortKey]);

  const sortButton = (key, label) => (
    <button
      className={`quote-sort-button ${sortKey === key ? "is-active" : ""}`.trim()}
      type="button"
      aria-label={`${label}从高到低排序`}
      title={`按${label}从高到低排序`}
      onClick={() => setSortKey(key)}
    >
      <span>{label}</span>
      <ArrowDownWideNarrow size={13} aria-hidden="true" />
    </button>
  );

  return (
    <section
      className={`quote-report-panel quote-business-panel ${loading ? "is-loading" : ""}`.trim()}
      aria-busy={loading}
    >
      <SectionHeading
        icon={UsersRound}
        title="业务报价与下单对比"
        aside={(
          <input
            className="quote-report-filter"
            type="month"
            aria-label="业务排名月份"
            value={selectedMonth}
            disabled={loading}
            onChange={(event) => {
              if (event.target.value) onMonthChange(event.target.value);
            }}
          />
        )}
      />
      {items.length > 0 ? (
        <div className="quote-report-table-wrap">
          <table className="quote-report-table quote-business-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>业务员</th>
                <th aria-sort={sortKey === "quoteCount" ? "descending" : "none"}>
                  {sortButton("quoteCount", "报价份数")}
                </th>
                <th aria-sort={sortKey === "quoteTotal" ? "descending" : "none"}>
                  {sortButton("quoteTotal", "报价总额（万）")}
                </th>
                <th aria-sort={sortKey === "orderTotal" ? "descending" : "none"}>
                  {sortButton("orderTotal", "下单金额（万）")}
                </th>
                <th aria-sort={sortKey === "conversionRate" ? "descending" : "none"}>
                  {sortButton("conversionRate", "下单率")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => (
                <tr key={item.name}>
                  <td><span className={`quote-rank ${rankClass(index)}`}>{index + 1}</span></td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.quoteCount} 份</td>
                  <td>{formatWan(item.quoteTotal)}</td>
                  <td>{formatWan(item.orderTotal)}</td>
                  <td className="quote-rate">
                    <span>{formatRate(item.conversionRate)}</span>
                    {item.conversionRate > 100 && <small>异常</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="quote-dashboard-empty">所选时间范围暂无可对比的业务数据</div>
      )}
    </section>
  );
}

export default function QuoteDashboardPage() {
  const today = useMemo(() => formatLocalDate(), []);
  const currentMonth = useMemo(() => today.slice(0, 7), [today]);
  const [todayData, setTodayData] = useState(null);
  const [monthData, setMonthData] = useState(null);
  const [summaryMonthData, setSummaryMonthData] = useState(null);
  const [officerData, setOfficerData] = useState(null);
  const [regionData, setRegionData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [officerRange, setOfficerRange] = useState({
    startDate: today,
    endDate: today,
  });
  const [regionMonth, setRegionMonth] = useState(currentMonth);
  const [businessMonth, setBusinessMonth] = useState(currentMonth);
  const [summaryMonth, setSummaryMonth] = useState(currentMonth);
  const [loadingSections, setLoadingSections] = useState({
    today: true,
    month: true,
    summary: false,
    officer: false,
    region: false,
    business: false,
  });
  const [error, setError] = useState("");
  const [scope, setScope] = useState("all");

  const loadSection = useCallback(async (key, range, setter, signal) => {
    setLoadingSections((current) => ({ ...current, [key]: true }));
    setError("");
    try {
      setter(await getQuoteDashboard({ signal, ...range }));
    } catch (requestError) {
      if (requestError?.name !== "AbortError") {
        setError(requestError.message || "报价看板数据加载失败");
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingSections((current) => ({ ...current, [key]: false }));
      }
    }
  }, []);

  const loadInitialDashboard = useCallback(async (signal) => {
    setLoadingSections((current) => ({
      ...current,
      today: true,
      month: true,
    }));
    setError("");
    try {
      const monthRange = monthDateRange(currentMonth);
      const result = await getInitialQuoteDashboard({
        signal,
        today,
        monthStartDate: monthRange.startDate,
        monthEndDate: monthRange.endDate,
      });
      setTodayData(result.today);
      setMonthData(result.month);
    } catch (requestError) {
      if (requestError?.name !== "AbortError") {
        setError(requestError.message || "报价看板数据加载失败");
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingSections((current) => ({
          ...current,
          today: false,
          month: false,
        }));
      }
    }
  }, [currentMonth, today]);

  useEffect(() => {
    const controller = new AbortController();
    loadInitialDashboard(controller.signal);
    return () => controller.abort();
  }, [loadInitialDashboard]);

  useEffect(() => {
    if (summaryMonth === currentMonth) {
      setSummaryMonthData(null);
      setLoadingSections((current) => ({ ...current, summary: false }));
      return undefined;
    }
    setSummaryMonthData(null);
    const controller = new AbortController();
    loadSection(
      "summary",
      monthDateRange(summaryMonth),
      setSummaryMonthData,
      controller.signal,
    );
    return () => controller.abort();
  }, [currentMonth, loadSection, summaryMonth]);

  useEffect(() => {
    if (officerRange.startDate === today && officerRange.endDate === today) {
      setOfficerData(null);
      setLoadingSections((current) => ({ ...current, officer: false }));
      return undefined;
    }
    const controller = new AbortController();
    loadSection(
      "officer",
      officerRange,
      setOfficerData,
      controller.signal,
    );
    return () => controller.abort();
  }, [loadSection, officerRange, today]);

  useEffect(() => {
    if (regionMonth === currentMonth) {
      setRegionData(null);
      setLoadingSections((current) => ({ ...current, region: false }));
      return undefined;
    }
    const controller = new AbortController();
    loadSection(
      "region",
      monthDateRange(regionMonth),
      setRegionData,
      controller.signal,
    );
    return () => controller.abort();
  }, [currentMonth, loadSection, regionMonth]);

  useEffect(() => {
    if (businessMonth === currentMonth) {
      setBusinessData(null);
      setLoadingSections((current) => ({ ...current, business: false }));
      return undefined;
    }
    const controller = new AbortController();
    loadSection(
      "business",
      monthDateRange(businessMonth),
      setBusinessData,
      controller.signal,
    );
    return () => controller.abort();
  }, [businessMonth, currentMonth, loadSection]);

  const refreshAll = useCallback(() => {
    setError("");
    loadInitialDashboard();
    if (summaryMonth !== currentMonth) {
      loadSection("summary", monthDateRange(summaryMonth), setSummaryMonthData);
    }
    if (officerRange.startDate !== today || officerRange.endDate !== today) {
      loadSection("officer", officerRange, setOfficerData);
    }
    if (regionMonth !== currentMonth) {
      loadSection("region", monthDateRange(regionMonth), setRegionData);
    }
    if (businessMonth !== currentMonth) {
      loadSection("business", monthDateRange(businessMonth), setBusinessData);
    }
  }, [
    businessMonth,
    currentMonth,
    loadInitialDashboard,
    loadSection,
    officerRange,
    regionMonth,
    summaryMonth,
    today,
  ]);

  const loading = Object.values(loadingSections).some(Boolean);
  const selectedMonthData = summaryMonth === currentMonth ? monthData : summaryMonthData;
  const todayActiveData = scopedDashboard(todayData, scope);
  const monthActiveData = scopedDashboard(selectedMonthData, scope);
  const officerActiveData = scopedDashboard(officerData || todayData, scope);
  const regionActiveData = scopedDashboard(regionData || monthData, scope);
  const businessActiveData = scopedDashboard(businessData || monthData, scope);
  const todaySummary = todayActiveData?.summary || {
    fileCount: 0,
    unitPrice: 0,
    total: 0,
  };
  const monthSummary = monthActiveData?.monthSummary || {
    fileCount: 0,
    quoteTotal: 0,
    orderCount: 0,
    orderTotal: 0,
    conversionRate: null,
  };
  const checkedTime = useMemo(() => {
    if (!selectedMonthData?.checkedAt) return "等待刷新";
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(selectedMonthData.checkedAt));
  }, [selectedMonthData?.checkedAt]);
  const selectedMonthLabel = formatMonthLabel(summaryMonth, currentMonth);
  const selectedMonthRange = monthDateRange(summaryMonth);
  const selectedMonthEndLabel = summaryMonth === currentMonth
    ? "今日"
    : selectedMonthRange.endDate;
  const kpiLoading = loadingSections.today
    || (summaryMonth === currentMonth ? loadingSections.month : loadingSections.summary);

  return (
    <PageTransition
      className={`quote-dashboard-page ${loading ? "is-loading" : ""}`.trim()}
      aria-busy={loading}
    >
      <header className="quote-dashboard-header">
        <div className="quote-dashboard-title">
          <div>
            <h1>技术组 · 报价数据</h1>
            <p>实时掌握报价进度、区域转化与业务下单表现</p>
          </div>
        </div>
        <div className="quote-dashboard-header-actions">
          <div className="quote-dashboard-header-scope" aria-label="报价类别">
            {dashboardScopes.map((item) => (
              <button
                className={scope === item.key ? "active" : ""}
                type="button"
                key={item.key}
                title={item.description}
                aria-pressed={scope === item.key}
                onClick={() => setScope(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="quote-dashboard-month-filter">
            <span>指标月份</span>
            <input
              type="month"
              aria-label="核心指标月份"
              value={summaryMonth}
              onChange={(event) => setSummaryMonth(event.target.value || currentMonth)}
            />
          </label>
          <small><i />{checkedTime} 更新</small>
          <button type="button" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={loading ? "quote-dashboard-spin" : ""} size={15} />
            刷新数据
          </button>
        </div>
      </header>

      {error && (
        <div className="quote-dashboard-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={refreshAll}>重新加载</button>
        </div>
      )}

      <section
        className={`quote-dashboard-kpis ${
          kpiLoading ? "is-loading" : ""
        }`.trim()}
        aria-label="报价核心指标"
        aria-busy={kpiLoading}
      >
        <MetricCard
          icon={ClipboardList}
          label="今日报价"
          value={`${todaySummary.fileCount} 份`}
          note="今日已写入报价统计表"
          tone="blue"
        />
        <MetricCard
          icon={FileSpreadsheet}
          label={`${selectedMonthLabel}报价`}
          value={`${monthSummary.fileCount} 份`}
          note={`${selectedMonthRange.startDate} 至 ${selectedMonthEndLabel}`}
          tone="green"
        />
        <RateMetricCard
          rate={monthSummary.conversionRate}
          monthLabel={selectedMonthLabel}
        />
        <MetricCard
          icon={CircleDollarSign}
          label={`${selectedMonthLabel}报价总额`}
          value={formatWan(monthSummary.quoteTotal)}
          tone="indigo"
        />
        <MetricCard
          icon={ShoppingCart}
          label={`${selectedMonthLabel}下单总额`}
          value={formatWan(monthSummary.orderTotal)}
          note={`${monthSummary.orderCount} 条有效下单明细`}
          tone="violet"
        />
      </section>

      <div className="quote-dashboard-reports">
        <OfficerOverview
          officers={officerActiveData?.officers || []}
          startDate={officerRange.startDate}
          endDate={officerRange.endDate}
          onRangeChange={setOfficerRange}
          loading={loadingSections.officer}
        />
        <RegionComparison
          items={regionActiveData?.regions || []}
          selectedMonth={regionMonth}
          onMonthChange={setRegionMonth}
          loading={loadingSections.region}
        />
        <BusinessRanking
          items={businessActiveData?.businesses || []}
          selectedMonth={businessMonth}
          onMonthChange={setBusinessMonth}
          loading={loadingSections.business}
        />
      </div>

      {(selectedMonthData?.warnings || []).length > 0 && (
        <div className="quote-dashboard-warnings">
          {selectedMonthData.warnings.map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      )}
    </PageTransition>
  );
}
