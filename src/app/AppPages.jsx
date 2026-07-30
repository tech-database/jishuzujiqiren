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

export function AppPages({ activeTab, adminAuthenticated, controllers }) {
  const {
    config,
    drawing,
    importData,
    monitoring,
    shared: { setTargetTable, targetTable },
  } = controllers;

  return (
    <>
      {activeTab === "home" && (
        <React.Suspense fallback={<div className="home-dashboard-loading" aria-label="首页数据大屏加载中" />}>
          <HomeDashboard />
        </React.Suspense>
      )}

      {activeTab === "connection" && adminAuthenticated && (
        <React.Suspense fallback={<PanelSkeleton className="connection-loading-shell card" />}>
          <ConnectionManagementCenter
            controller={config}
            formatDisplayTime={monitoring.formatDisplayTime}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      )}

      {activeTab === "mapping" && (
        <React.Suspense fallback={<PanelSkeleton className="mapping-loading-state card" />}>
          <MappingStudio controller={config} />
        </React.Suspense>
      )}

      {activeTab === "people" && adminAuthenticated && (
        <React.Suspense fallback={<div className="glass-skeleton people-skeleton" />}>
          <PeopleMappingCenter controller={config} />
        </React.Suspense>
      )}

      {activeTab === "upload" && (
        <React.Suspense fallback={<div className="glass-skeleton import-skeleton" />}>
          <DataImportCenter
            configReady={config.configReady}
            controller={importData}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      )}

      {activeTab === "status" && (
        <React.Suspense fallback={<PanelSkeleton className="monitoring-loading-shell card" />}>
          <MonitoringCenter
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

      {activeTab === "analytics" && (
        <React.Suspense fallback={<div className="analytics-loading-shell" aria-label="数据看板加载中" />}>
          <DataAnalyticsCenter
            configReady={config.configReady}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      )}

      {activeTab === "quotes" && (
        <React.Suspense fallback={<div className="glass-skeleton quote-statistics-skeleton" />}>
          <QuoteStatisticsCenter
            quoteTableReady={Boolean(config.status?.tables?.quote?.ready)}
          />
        </React.Suspense>
      )}

      {activeTab === "quote-home" && (
        <React.Suspense fallback={<div className="quote-dashboard-skeleton quote-dashboard-skeleton-body" />}>
          <QuoteDashboard />
        </React.Suspense>
      )}

      {activeTab === "drawing" && (
        <React.Suspense fallback={<div className="glass-skeleton assignment-skeleton" />}>
          <DrawingAssignmentCenter
            configReady={config.configReady}
            controller={drawing}
            nameIdRows={config.nameIdRows}
          />
        </React.Suspense>
      )}

      {activeTab === "orders" && (
        <React.Suspense fallback={<div className="glass-skeleton assignment-skeleton" />}>
          <OrderConfirmationCenter
            configReady={config.configReady}
            setTargetTable={setTargetTable}
            targetTable={targetTable}
          />
        </React.Suspense>
      )}

      {activeTab === "commands" && (
        <React.Suspense fallback={<div className="glass-skeleton command-skeleton" />}>
          <CommandCenter onRefresh={config.loadConfig} />
        </React.Suspense>
      )}

      {!noRefreshTabs.has(activeTab) && (
        <button className="refresh-fab" onClick={config.loadConfig} aria-label="刷新配置" title="刷新配置">
          <RefreshCw size={18} />
        </button>
      )}
    </>
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
