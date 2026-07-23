import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Database,
  Link2,
  RefreshCw,
  Sigma,
  Timer,
  UserRound,
  UsersRound,
} from "lucide-react";

function formatDate(value, includeTime = false) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  const options = includeTime
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
    : { year: "numeric", month: "2-digit", day: "2-digit" };
  return new Intl.DateTimeFormat("zh-CN", options).format(date).replaceAll("/", "/");
}

function formatClock(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("zh-CN", { hour12: false });
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultPerformanceRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
}

function CountUpNumber({ value = 0, suffix = "", decimals, className = "" }) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const precision = decimals ?? (Number.isInteger(numericValue) ? 0 : 1);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const displayValue = useTransform(motionValue, (latest) => {
    const formatted = new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(latest);
    return `${formatted}${suffix}`;
  });

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(numericValue);
      return undefined;
    }
    const controls = animate(motionValue, numericValue, {
      duration: 0.82,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [motionValue, numericValue, reduceMotion]);

  return <motion.strong className={`home-count-up ${className}`.trim()}>{displayValue}</motion.strong>;
}

function StatusChip({ icon: Icon, ok, children }) {
  return (
    <span className={`home-status-chip ${ok ? "ok" : "error"}`}>
      <Icon size={18} strokeWidth={1.8} />
      {children}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, tone = "cyan", split, index }) {
  return (
    <article className={`home-metric-card ${tone}`} style={{ "--metric-index": index }}>
      <span className="home-metric-icon"><Icon size={43} strokeWidth={1.8} /></span>
      {split ? (
        <div className="home-split-values">
          {split.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <CountUpNumber value={item.value} />
            </div>
          ))}
        </div>
      ) : (
        <div className="home-metric-copy">
          <span>{label}</span>
          <CountUpNumber value={value} />
        </div>
      )}
    </article>
  );
}

function SectionFrame({ title, meta, children, className = "" }) {
  return (
    <section className={`home-panel ${className}`}>
      <header className="home-panel-header">
        <h2>{title}</h2>
        {meta && <span>{meta}</span>}
      </header>
      {children}
    </section>
  );
}

function CompletionPanel({ summary }) {
  const total = Number(summary.total || 0);
  const done = Number(summary.done || 0);
  const rate = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  const reduceMotion = useReducedMotion();

  return (
    <SectionFrame title="实时完成率" className="home-completion-panel">
      <div className="home-completion-body">
        <div className="home-donut">
          <span className="home-donut-ticks" aria-hidden="true" />
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="home-donut-track" cx="60" cy="60" r="50" pathLength="1" />
            <motion.circle
              className="home-donut-value"
              cx="60"
              cy="60"
              r="50"
              pathLength="1"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: rate / 100 }}
              transition={{ duration: reduceMotion ? 0 : 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div>
            <CountUpNumber value={rate} decimals={1} suffix="%" />
            <span><CountUpNumber value={done} /> / <CountUpNumber value={total} /></span>
          </div>
        </div>
        <div className="home-completion-legend">
          <span><i className="done" />已完成<CountUpNumber value={done} /></span>
          <span><i className="drawing" />绘图中<CountUpNumber value={summary.drawing || 0} /></span>
          <span><i className="unclaimed" />未领取<CountUpNumber value={summary.unclaimed || 0} /></span>
        </div>
      </div>
    </SectionFrame>
  );
}

function PersonnelPanel({ personnel }) {
  const items = personnel?.items || [];
  const previousRef = useRef(new Map());
  const currentSnapshot = new Map(items.map((person) => [person.owner, {
    status: person.status,
    task: person.activeItems?.[0]?.materialCode || "",
    completed: Number(person.todayCompleted || 0),
  }]));

  useEffect(() => {
    previousRef.current = currentSnapshot;
  }, [personnel]);

  return (
    <SectionFrame title="绘图人员实时状态" className="home-personnel-panel">
      <div className={`home-personnel-grid count-${Math.min(items.length, 12)}`}>
        {items.length === 0 ? <div className="home-empty">暂无绘图人员实时数据</div> : items.map((person) => {
          const drawing = person.status === "drawing";
          const previous = previousRef.current.get(person.owner);
          const currentTask = person.activeItems?.[0]?.materialCode || "";
          const hasNewTask = Boolean(previous && currentTask && (previous.task !== currentTask || previous.status !== "drawing"));
          const hasCompletion = Boolean(previous && (Number(person.todayCompleted || 0) > previous.completed || (previous.status === "drawing" && !drawing)));
          const feedbackClass = hasCompletion ? "has-completion" : hasNewTask ? "has-new-task" : "";
          return (
            <motion.article
              layout="position"
              transition={{ layout: { duration: 0.42, ease: [0.25, 1, 0.5, 1] } }}
              className={`home-person-card ${drawing ? "drawing" : "idle"} ${feedbackClass}`.trim()}
              key={person.owner}
            >
              <div className="home-person-heading">
                <span className="home-avatar"><UserRound size={22} /></span>
                <strong>{person.owner}</strong>
                <em><i />{drawing ? "绘图中" : "空闲"}</em>
              </div>
              <div className="home-person-task" title={(person.activeItems || []).map((item) => item.materialCode).join("、")}>
                <span>当前任务</span>
                <strong>{currentTask || "—"}</strong>
              </div>
              <div className="home-person-stats">
                <span>今日接图<CountUpNumber value={person.todayClaimed ?? 0} /></span>
                <span>今日完成<CountUpNumber value={person.todayCompleted ?? 0} /></span>
              </div>
            </motion.article>
          );
        })}
      </div>
    </SectionFrame>
  );
}

function logKey(log) {
  return log.id || `${log.time || ""}:${log.type || ""}:${log.content || ""}`;
}

function LogPanel({ logs }) {
  const reduceMotion = useReducedMotion();
  const visibleLogs = logs.slice(0, 8);
  const currentKeys = visibleLogs.map(logKey);
  const previousKeysRef = useRef(new Set());
  const hasPreviousLogs = previousKeysRef.current.size > 0;

  useEffect(() => {
    previousKeysRef.current = new Set(currentKeys);
  }, [currentKeys.join("|")]);

  return (
    <SectionFrame title="实时运行日志" meta="机器人任务流与系统状态实时记录" className="home-log-panel">
      <div className="home-log-table" role="table" aria-label="最新8条实时运行日志">
        <div className="home-log-row head" role="row">
          <span>时间</span><span>类型</span><span>来源</span><span>日志内容</span><span>状态</span>
        </div>
        {visibleLogs.length === 0 ? <div className="home-empty">暂无实时日志</div> : (
          <AnimatePresence initial={false} mode="popLayout">
            {visibleLogs.map((log) => {
              const key = logKey(log);
              const isNew = hasPreviousLogs && !previousKeysRef.current.has(key);
              const isError = log.status === "异常";
              return (
                <motion.div
                  layout="position"
                  className={`home-log-row ${isNew ? "is-new" : ""} ${isNew && isError ? "is-new-error" : ""}`.trim()}
                  role="row"
                  key={key}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -9 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.38, ease: [0.25, 1, 0.5, 1] }}
                >
                  <span>{formatClock(log.time)}</span>
                  <span><b className={`log-type type-${log.type}`}>{log.type}</b></span>
                  <span>{log.source}</span>
                  <span title={log.content}>{log.content}</span>
                  <span><b className={`log-state ${isError ? "error" : "ok"}`}><i />{log.status}</b></span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </SectionFrame>
  );
}

function PerformancePanel({ title, data, tone }) {
  const summary = data?.summary || {};
  const owners = (data?.owners || []).filter((item) => item.name !== "未分配");
  const regions = (data?.regions || []).filter((item) => item.name !== "未填写");
  const maxRegion = Math.max(1, ...regions.map((item) => Number(item.count || 0)));
  const previousRanksRef = useRef(new Map());
  const currentRanks = new Map(owners.map((owner, index) => [owner.name, index]));

  useEffect(() => {
    previousRanksRef.current = currentRanks;
  }, [data]);

  return (
    <section className={`home-performance-panel ${tone}`}>
      <header><h3>{title}</h3></header>
      <div className="home-performance-metrics">
        <span><ClipboardList size={28} /><small>绘图总数</small><CountUpNumber value={summary.total} suffix="张" /></span>
        <span><Sigma size={28} /><small>绘图总分</small><CountUpNumber value={summary.totalScore} /></span>
        <span><Timer size={28} /><small>平均用时</small><CountUpNumber value={summary.averageDuration} suffix="分" /></span>
        <span><UsersRound size={28} /><small>参与绘图人员</small><CountUpNumber value={summary.owners} suffix="人" /></span>
      </div>
      <div className="home-performance-content">
        <div className="home-ranking">
          <h4>人员绩效 <small>按绘图张数</small></h4>
          <div className="home-rank-head"><span>人员</span><span>绘图张数</span><span>绘图总分</span><span>平均用时</span></div>
          {owners.slice(0, 5).map((owner, index) => {
            const previousRank = previousRanksRef.current.get(owner.name);
            const rankChanged = previousRank !== undefined && previousRank !== index;
            return (
              <motion.div
                layout="position"
                className={`home-rank-row ${rankChanged ? "rank-changed" : ""}`.trim()}
                transition={{ layout: { duration: 0.45, ease: [0.25, 1, 0.5, 1] } }}
                key={owner.name}
              >
                <span><i>{index + 1}</i>{owner.name}</span>
                <CountUpNumber value={owner.count} suffix="张" />
                <CountUpNumber value={owner.score} suffix="分" />
                <CountUpNumber value={owner.averageDuration} suffix="分" />
              </motion.div>
            );
          })}
          {owners.length === 0 && <div className="home-empty compact">暂无人员绩效数据</div>}
        </div>
        <div className="home-regions">
          <h4>区域绘图数量 <small>按绘图张数</small></h4>
          {regions.slice(0, 7).map((region, index) => {
            const scale = Math.max(0.05, Number(region.count || 0) / maxRegion);
            return (
              <div className="home-region-row" key={region.name}>
                <span>{region.name}</span>
                <i><b style={{ "--region-scale": scale, "--region-index": index }} /></i>
                <CountUpNumber value={region.count} suffix="张" />
              </div>
            );
          })}
          {regions.length === 0 && <div className="home-empty compact">暂无区域张数数据</div>}
        </div>
      </div>
    </section>
  );
}

export default function HomeDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");
  const [performanceRange, setPerformanceRange] = useState(defaultPerformanceRange);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const requestRef = useRef(null);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const performanceRangeRef = useRef(performanceRange);
  const mountedRef = useRef(true);

  const loadDashboard = useCallback(({ force = false } = {}) => {
    if (requestRef.current && !force) return requestRef.current;
    if (force) controllerRef.current?.abort();

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    controllerRef.current = controller;
    const selectedRange = performanceRangeRef.current;
    const request = (async () => {
      try {
        const query = new URLSearchParams({
          refresh: String(Date.now()),
          startDate: selectedRange.startDate,
          endDate: selectedRange.endDate,
        });
        const response = await fetch(`/api/home-dashboard?${query}`, {
          signal: controller.signal,
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || "首页数据加载失败");
        if (mountedRef.current && requestId === requestIdRef.current) {
          setData(result);
          setError("");
        }
      } catch (requestError) {
        if (
          requestError.name !== "AbortError" &&
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setError(requestError.message || "首页数据加载失败");
        }
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
          setPerformanceLoading(false);
          requestRef.current = null;
          if (controllerRef.current === controller) controllerRef.current = null;
        }
      }
    })();
    requestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    performanceRangeRef.current = performanceRange;
    setPerformanceLoading(true);
    loadDashboard({ force: true });
  }, [loadDashboard, performanceRange.endDate, performanceRange.startDate]);

  useEffect(() => {
    mountedRef.current = true;
    let refreshTimer;
    let clockTimer;

    const stopTimers = () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(clockTimer);
      refreshTimer = undefined;
      clockTimer = undefined;
    };

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        await loadDashboard();
        if (mountedRef.current && document.visibilityState !== "hidden") scheduleRefresh();
      }, 10000);
    };

    const startTimers = () => {
      stopTimers();
      setNow(new Date());
      loadDashboard().finally(() => {
        if (mountedRef.current && document.visibilityState !== "hidden") scheduleRefresh();
      });
      clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    };

    const handleVisibility = () => {
      const visible = document.visibilityState !== "hidden";
      setPageVisible(visible);
      if (visible) startTimers();
      else stopTimers();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    handleVisibility();

    return () => {
      mountedRef.current = false;
      stopTimers();
      controllerRef.current?.abort();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadDashboard]);

  const todaySummary = useMemo(() => {
    const board = data?.today?.board?.summary || {};
    const paint = data?.today?.paint?.summary || {};
    return {
      total: Number(board.total || 0) + Number(paint.total || 0),
      unclaimed: Number(board.unclaimed || 0) + Number(paint.unclaimed || 0),
      drawing: Number(board.drawing || 0) + Number(paint.drawing || 0),
      done: Number(board.done || 0) + Number(paint.done || 0),
    };
  }, [data]);
  const personnel = data?.personnel || {};
  const personnelSummary = personnel.summary || {};
  const board = data?.today?.board?.summary || {};
  const paint = data?.today?.paint?.summary || {};
  const todayInput = formatDateInput(now);
  const resetPerformanceRange = () => setPerformanceRange(defaultPerformanceRange());

  return (
    <div className={`home-page ${pageVisible ? "" : "is-paused"}`.trim()}>
      <div className="home-dashboard">
        <div className="home-tech-atmosphere" aria-hidden="true">
          <span className="home-light-band band-one" />
          <span className="home-light-band band-two" />
          <span className="home-light-band band-three" />
        </div>
        <div className="home-tech-edge" aria-hidden="true" />

        <header className="home-dashboard-header">
          <div className="home-title-line left" /><h1>技术组 · 智能运行数据中心</h1><div className="home-title-line right" />
          <div className="home-clock"><strong>{formatDate(now, true)}</strong><span><i />实时更新</span></div>
          <div className="home-system-status">
            <StatusChip icon={CheckCircle2} ok={Boolean(data?.health?.ok)}>检测{data?.health?.ok ? "通过" : "异常"}</StatusChip>
            <StatusChip icon={Link2} ok={Boolean(data?.health?.checks?.websocket?.ok)}>飞书连接{data?.health?.checks?.websocket?.ok ? "正常" : "异常"}</StatusChip>
            <StatusChip icon={Database} ok={Boolean(data?.configReady)}>配置{data?.configReady ? "已加载" : "未加载"}</StatusChip>
          </div>
        </header>

        {error && <div className="home-error"><Activity size={18} />连接异常，已保留上次成功数据<button type="button" onClick={loadDashboard}>重新加载</button></div>}
        <section className={`home-metrics ${loading ? "is-loading" : ""}`} aria-label="今日运行指标">
          <MetricCard index={0} icon={UsersRound} label="绘图人员" value={personnelSummary.owners} />
          <MetricCard index={1} icon={Activity} label="绘图中" value={personnelSummary.drawing} />
          <MetricCard index={2} icon={UserRound} label="空闲人员" value={personnelSummary.idle} />
          <MetricCard index={3} icon={ClipboardList} tone="dual" split={[{ label: "胶板今日任务", value: board.total }, { label: "油漆今日任务", value: paint.total }]} />
          <MetricCard index={4} icon={Database} tone="dual" split={[{ label: "胶板未领取", value: board.unclaimed }, { label: "油漆未领取", value: paint.unclaimed }]} />
          <MetricCard index={5} icon={Activity} tone="dual" split={[{ label: "胶板绘图中", value: board.drawing }, { label: "油漆绘图中", value: paint.drawing }]} />
          <MetricCard index={6} icon={CheckCircle2} tone="green" split={[{ label: "胶板已完成", value: board.done }, { label: "油漆已完成", value: paint.done }]} />
        </section>

        <section className="home-middle-grid">
          <LogPanel logs={data?.realtimeLogs || []} />
          <CompletionPanel summary={todaySummary} />
          <PersonnelPanel personnel={personnel} />
        </section>

        <div className="home-performance-title">
          <span />
          <div className="home-performance-heading">
            <strong>区间绩效分析</strong>
            <div className="home-performance-range" role="group" aria-label="绩效统计日期范围">
              <input
                type="date"
                aria-label="绩效统计开始日期"
                value={performanceRange.startDate}
                max={performanceRange.endDate}
                onChange={(event) => setPerformanceRange((range) => ({ ...range, startDate: event.target.value }))}
              />
              <b aria-hidden="true">—</b>
              <input
                type="date"
                aria-label="绩效统计结束日期"
                value={performanceRange.endDate}
                min={performanceRange.startDate}
                max={todayInput}
                onChange={(event) => setPerformanceRange((range) => ({ ...range, endDate: event.target.value }))}
              />
              <button type="button" onClick={resetPerformanceRange} title="恢复本月范围">本月</button>
              {performanceLoading && <em role="status">统计中</em>}
            </div>
          </div>
          <span />
        </div>
        <section className={`home-performance-grid ${performanceLoading ? "is-loading" : ""}`} aria-busy={performanceLoading}>
          <PerformancePanel title="胶板绩效" data={data?.performance?.board} tone="board" />
          <PerformancePanel title="油漆绩效" data={data?.performance?.paint} tone="paint" />
        </section>
        <span className="home-updated"><RefreshCw size={14} />数据更新：{formatDate(data?.checkedAt, true)}</span>
      </div>
    </div>
  );
}
