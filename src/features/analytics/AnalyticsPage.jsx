import DataAnalyticsCenter from "../../components/analytics/DataAnalyticsCenter.jsx";

export default function AnalyticsPage({ configReady, setTargetTable, targetTable }) {
  return (
    <DataAnalyticsCenter
      configReady={configReady}
      targetTable={targetTable}
      setTargetTable={setTargetTable}
    />
  );
}
