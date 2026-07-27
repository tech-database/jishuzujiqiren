import MonitoringCenter from "../../components/monitoring/MonitoringCenter.jsx";

export default function MonitoringPage({
  configReady,
  controller: c,
  healthLoading,
  healthStatus,
  setTargetTable,
  targetTable,
}) {
  return (
    <MonitoringCenter
      configReady={configReady}
      targetTable={targetTable}
      setTargetTable={setTargetTable}
      statusDateRange={c.statusDateRange}
      setStatusDateRange={c.setStatusDateRange}
      statusSyncing={c.statusSyncing}
      backgroundSyncStatus={c.backgroundSyncStatus}
      healthStatus={healthStatus}
      healthLoading={healthLoading}
      statusResult={c.statusResult}
      statusState={c.statusState}
      syncDrawingStatus={c.syncDrawingStatus}
      recalculateDrawingDurations={c.recalculateDrawingDurations}
      formatDisplayTime={c.formatDisplayTime}
    />
  );
}
