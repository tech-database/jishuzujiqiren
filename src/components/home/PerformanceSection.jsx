import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ClipboardList, RefreshCw, Sigma, Timer, UsersRound } from "lucide-react";
import { CountUpNumber } from "./CountUpNumber.jsx";

function PerformancePanel({ title, data, tone }) {
  const summary = data?.summary || {};
  const owners = (data?.owners || []).filter((item) => item.name !== "未分配");
  const regions = (data?.regions || []).filter((item) => item.name !== "未填写");
  const maxRegion = Math.max(1, ...regions.map((item) => Number(item.count || 0)));
  const previousRanksRef = useRef(new Map());
  useEffect(() => {
    previousRanksRef.current = new Map(
      (data?.owners || []).map((owner, index) => [owner.name, index]),
    );
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
          <div className="home-rank-head">
            <span>人员</span><span>绘图张数</span><span>绘图总分</span><span>平均用时</span>
          </div>
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

export function PerformanceSection({
  data,
  forceRefreshDashboard,
  manualRefreshing,
  performanceLoading,
  performanceRange,
  resetPerformanceRange,
  setPerformanceRange,
  todayInput,
}) {
  return (
    <>
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
              onChange={(event) =>
                setPerformanceRange((range) => ({
                  ...range,
                  startDate: event.target.value,
                }))
              }
            />
            <b aria-hidden="true">—</b>
            <input
              type="date"
              aria-label="绩效统计结束日期"
              value={performanceRange.endDate}
              min={performanceRange.startDate}
              max={todayInput}
              onChange={(event) =>
                setPerformanceRange((range) => ({
                  ...range,
                  endDate: event.target.value,
                }))
              }
            />
            <button type="button" onClick={resetPerformanceRange} title="恢复本月范围">
              本月
            </button>
            <button
              type="button"
              className="home-force-refresh"
              onClick={forceRefreshDashboard}
              disabled={manualRefreshing}
              title="绕过缓存，立即重新读取飞书表格"
            >
              <RefreshCw size={12} aria-hidden="true" />
              {manualRefreshing ? "刷新中" : "刷新"}
            </button>
            {performanceLoading && <em role="status">统计中</em>}
          </div>
        </div>
        <span />
      </div>
      <section
        className={`home-performance-grid ${performanceLoading ? "is-loading" : ""}`}
        aria-busy={performanceLoading}
      >
        <PerformancePanel title="胶板绩效" data={data?.performance?.board} tone="board" />
        <PerformancePanel title="油漆绩效" data={data?.performance?.paint} tone="paint" />
      </section>
    </>
  );
}
