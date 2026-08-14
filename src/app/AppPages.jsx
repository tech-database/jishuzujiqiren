import React from "react";
import { RefreshCw } from "lucide-react";
import {
  CommandCenter,
  ConnectionManagementCenter,
  DataAnalyticsCenter,
  DataImportCenter,
  DrawingAssignmentCenter,
  DrawingOperationsCenter,
  HomeDashboard,
  MappingStudio,
  MonitoringCenter,
  OrderConfirmationCenter,
  PeopleMappingCenter,
  QuoteDashboard,
  QuoteStatisticsCenter,
} from "./routes.jsx";

const noRefreshTabs = new Set(["home", "commands", "status", "analytics", "quote-home", "quotes"]);
const keepAliveTabs = new Set([
  "connection",
  "mapping",
  "commands",
  "people",
  "analytics",
  "quote-home",
  "quotes",
  "upload",
  "drawing",
  "orders",
]);

export function AppPages({ activeTab, adminAuthenticated, controllers }) {
  const visitedTabsRef = React.useRef(new Set());
  if (keepAliveTabs.has(activeTab)) {
    visitedTabsRef.current.add(activeTab);
  }

  const {
    config,
    drawing,
    importData,
    monitoring,
    quoteStatistics,
    shared: { setTargetTable, targetTable },
  } = controllers;

  return (
    <>
      {activeTab === "home" && (
        <React.Suspense fallback={<div className="home-dashboard-loading" aria-label="首页数据大屏加载中" />}>
          <HomeDashboard />
        </React.Suspense>
      )}

      <KeepAlivePage
        activeTab={activeTab}
        adminAllowed={adminAuthenticated}
        tab="connection"
        visitedTabs={visitedTabsRef.current}
      >
        <React.Suspense fallback={<PanelSkeleton className="connection-loading-shell card" />}>
          <ConnectionManagementCenter
            controller={config}
            formatDisplayTime={monitoring.formatDisplayTime}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage activeTab={activeTab} tab="mapping" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<PanelSkeleton className="mapping-loading-state card" />}>
          <MappingStudio controller={config} />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage
        activeTab={activeTab}
        adminAllowed={adminAuthenticated}
        tab="people"
        visitedTabs={visitedTabsRef.current}
      >
        <React.Suspense fallback={<div className="glass-skeleton people-skeleton" />}>
          <PeopleMappingCenter controller={config} />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage activeTab={activeTab} tab="upload" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<div className="glass-skeleton import-skeleton" />}>
          <DataImportCenter
            configReady={config.configReady}
            controller={importData}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      </KeepAlivePage>

      {activeTab === "status" && (
        <React.Suspense fallback={<PanelSkeleton className="monitoring-loading-shell card" />}>
          <MonitoringCenter
            adminAuthenticated={adminAuthenticated}
            configReady={config.configReady}
            controller={monitoring}
            healthLoading={config.healthLoading}
            healthStatus={config.healthStatus}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      )}

      {activeTab === "owners" && (
        <React.Suspense fallback={<div className="glass-skeleton drawing-skeleton" />}>
          <DrawingOperationsCenter configReady={config.configReady} controller={monitoring} />
        </React.Suspense>
      )}

      <KeepAlivePage activeTab={activeTab} tab="analytics" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<div className="analytics-loading-shell" aria-label="数据看板加载中" />}>
          <DataAnalyticsCenter
            configReady={config.configReady}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage activeTab={activeTab} tab="quotes" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<div className="glass-skeleton quote-statistics-skeleton" />}>
          <QuoteStatisticsCenter
            controller={quoteStatistics}
            quoteTableReady={Boolean(config.status?.tables?.quote?.ready)}
          />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage activeTab={activeTab} tab="quote-home" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<div className="quote-dashboard-skeleton quote-dashboard-skeleton-body" />}>
          <QuoteDashboard />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage activeTab={activeTab} tab="drawing" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<div className="glass-skeleton assignment-skeleton" />}>
          <DrawingAssignmentCenter
            configReady={config.configReady}
            controller={drawing}
            nameIdRows={config.nameIdRows}
          />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage activeTab={activeTab} tab="orders" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<div className="glass-skeleton assignment-skeleton" />}>
          <OrderConfirmationCenter
            configReady={config.configReady}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      </KeepAlivePage>

      <KeepAlivePage activeTab={activeTab} tab="commands" visitedTabs={visitedTabsRef.current}>
        <React.Suspense fallback={<div className="glass-skeleton command-skeleton" />}>
          <CommandCenter onRefresh={config.loadConfig} />
        </React.Suspense>
      </KeepAlivePage>

      {!noRefreshTabs.has(activeTab) && (
        <button className="refresh-fab" onClick={config.loadConfig} aria-label="刷新配置" title="刷新配置">
          <RefreshCw size={18} />
        </button>
      )}
    </>
  );
}

function KeepAlivePage({
  activeTab,
  adminAllowed = true,
  children,
  tab,
  visitedTabs,
}) {
  if (!adminAllowed || !visitedTabs.has(tab)) return null;
  const active = activeTab === tab;

  return (
    <div
      aria-hidden={!active}
      className="app-page-keep-alive"
      hidden={!active}
      style={active ? { display: "contents" } : undefined}
    >
      {children}
    </div>
  );
}

function PanelSkeleton({ className }) {
  return (
    <section className={className}>
      <span />
      <span />
      <span />
    </section>
  );
}
