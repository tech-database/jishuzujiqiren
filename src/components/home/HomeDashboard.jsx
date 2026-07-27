import { Activity, RefreshCw } from "lucide-react";
import { useHomeDashboardController } from "../../features/home/useHomeDashboardController.js";
import { CompletionPanel } from "./CompletionPanel.jsx";
import { formatDate } from "./dashboard-formatters.js";
import { HomeDashboardHeader } from "./HomeDashboardHeader.jsx";
import { HomeMetrics } from "./HomeMetrics.jsx";
import { LogPanel } from "./LogPanel.jsx";
import { PerformanceSection } from "./PerformanceSection.jsx";
import { PersonnelPanel } from "./PersonnelPanel.jsx";

export default function HomeDashboard() {
  const {
    data,
    error,
    forceRefreshDashboard,
    loadDashboard,
    loading,
    manualRefreshing,
    now,
    pageVisible,
    performanceLoading,
    performanceRange,
    resetPerformanceRange,
    setPerformanceRange,
    todayInput,
    todaySummary,
  } = useHomeDashboardController();
  const personnel = data?.personnel || {};
  const personnelSummary = personnel.summary || {};
  const board = data?.today?.board?.summary || {};
  const paint = data?.today?.paint?.summary || {};

  return (
    <div className={`home-page ${pageVisible ? "" : "is-paused"}`.trim()}>
      <div className="home-dashboard">
        <div className="home-tech-atmosphere" aria-hidden="true">
          <span className="home-light-band band-one" />
          <span className="home-light-band band-two" />
          <span className="home-light-band band-three" />
        </div>
        <div className="home-tech-edge" aria-hidden="true" />

        <HomeDashboardHeader data={data} now={now} />

        {error && (
          <div className="home-error">
            <Activity size={18} />
            连接异常，已保留上次成功数据
            <button type="button" onClick={() => loadDashboard({ force: true })}>
              重新加载
            </button>
          </div>
        )}

        <HomeMetrics
          board={board}
          loading={loading}
          paint={paint}
          personnelSummary={personnelSummary}
        />

        <section className="home-middle-grid">
          <LogPanel logs={data?.realtimeLogs || []} />
          <CompletionPanel summary={todaySummary} />
          <PersonnelPanel personnel={personnel} />
        </section>

        <PerformanceSection
          data={data}
          forceRefreshDashboard={forceRefreshDashboard}
          manualRefreshing={manualRefreshing}
          performanceLoading={performanceLoading}
          performanceRange={performanceRange}
          resetPerformanceRange={resetPerformanceRange}
          setPerformanceRange={setPerformanceRange}
          todayInput={todayInput}
        />

        <span className="home-updated">
          <RefreshCw size={14} />
          数据更新：{formatDate(data?.checkedAt, true)}
        </span>
      </div>
    </div>
  );
}
