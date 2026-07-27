import DrawingOperationsCenter from "../../components/drawing/DrawingOperationsCenter.jsx";

export default function DrawingOperationsPage({ configReady, controller: c }) {
  return (
    <DrawingOperationsCenter
      ownerStats={c.ownerStats}
      loading={c.ownerStatsLoading}
      errorState={c.ownerStatsState}
      configReady={configReady}
      onRefresh={c.loadDrawingOwnerStats}
      formatTime={c.formatDisplayTime}
    />
  );
}
