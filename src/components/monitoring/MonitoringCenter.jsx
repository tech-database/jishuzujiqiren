import { useMemo } from "react";
import { motion } from "framer-motion";
import { buildMonitoringViewModel } from "../../features/monitoring/monitoring-view.model.js";
import { LiveLogPanel } from "./LiveLogPanel";
import { MonitoringControls } from "./MonitoringControls.jsx";
import { MonitoringHero } from "./MonitoringHero.jsx";
import { MonitoringInsight } from "./MonitoringInsight.jsx";
import { MonitoringOverview } from "./MonitoringOverview.jsx";

export default function MonitoringCenter({
  adminAuthenticated,
  configReady,
  targetTable,
  setTargetTable,
  statusDateRange,
  setStatusDateRange,
  statusSyncing,
  backgroundSyncStatus,
  healthStatus,
  healthLoading,
  statusResult,
  statusState,
  syncDrawingStatus,
  recalculateDrawingDurations,
  formatDisplayTime,
  loadRuntimeLogs,
  runtimeLogs,
  runtimeLogsError,
  runtimeLogsLoading,
  runtimeLogsUpdatedAt,
}) {
  const view = useMemo(
    () =>
      buildMonitoringViewModel({
        backgroundSyncStatus,
        configReady,
        formatDisplayTime,
        healthLoading,
        healthStatus,
        statusResult,
        targetTable,
      }),
    [
      backgroundSyncStatus,
      configReady,
      formatDisplayTime,
      healthLoading,
      healthStatus,
      statusResult,
      targetTable,
    ],
  );

  return (
    <motion.section
      className="monitoring-command-center"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
    >
      <MonitoringHero
        backgroundSyncStatus={backgroundSyncStatus}
        configReady={configReady}
        healthLabel={view.healthLabel}
        healthTone={view.healthTone}
        intervalLabel={view.intervalLabel}
        lastCheckedLabel={view.lastCheckedLabel}
        statusSyncing={statusSyncing}
      />

      <MonitoringControls
        configReady={configReady}
        recalculateDrawingDurations={recalculateDrawingDurations}
        setStatusDateRange={setStatusDateRange}
        setTargetTable={setTargetTable}
        statusDateRange={statusDateRange}
        statusState={statusState}
        statusSyncing={statusSyncing}
        syncDrawingStatus={syncDrawingStatus}
        targetTable={targetTable}
      />

      <MonitoringOverview
        completionRate={view.completionRate}
        distribution={view.distribution}
        formatDisplayTime={formatDisplayTime}
        metrics={view.metrics}
        normalized={view.normalized}
        selectedTableLabel={view.selectedTableLabel}
        statusSyncing={statusSyncing}
      />

      <MonitoringInsight
        backgroundSyncStatus={backgroundSyncStatus}
        hasBackgroundError={view.hasBackgroundError}
        hasHealthError={view.hasHealthError}
        hasMonitoringIssue={view.hasMonitoringIssue}
        healthErrorText={view.healthErrorText}
        historicalTimestampAnomalies={view.historicalTimestampAnomalies}
      />

      <LiveLogPanel
        authenticated={adminAuthenticated}
        error={runtimeLogsError}
        lastUpdated={runtimeLogsUpdatedAt}
        loading={runtimeLogsLoading}
        logs={runtimeLogs}
        onRefresh={() => loadRuntimeLogs()}
      />
    </motion.section>
  );
}
