import { Calculator, RefreshCw } from "lucide-react";
import { GlassButton, GlassCard } from "../design-system";

const tableOptions = [
  { key: "board", label: "胶板" },
  { key: "paint", label: "油漆" },
];

function MonitoringTableSelector({ value, onChange }) {
  return (
    <div className="monitoring-table-selector" role="group" aria-label="查询表">
      {tableOptions.map((option) => (
        <button
          type="button"
          key={option.key}
          className={value === option.key ? "active" : ""}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DateField({ label, hint, value, onChange }) {
  return (
    <label className="monitoring-date-field">
      <span><strong>{label}</strong><small>{hint}</small></span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function MonitoringControls({
  configReady,
  recalculateDrawingDurations,
  setStatusDateRange,
  setTargetTable,
  statusDateRange,
  statusState,
  statusSyncing,
  syncDrawingStatus,
  targetTable,
}) {
  return (
    <GlassCard className="monitoring-control-surface">
      <div className="monitoring-filter-grid">
        <DateField
          label="开始日期"
          hint="默认最近7天"
          value={statusDateRange.startDate}
          onChange={(startDate) =>
            setStatusDateRange((current) => ({ ...current, startDate }))
          }
        />
        <DateField
          label="结束日期"
          hint="默认今天"
          value={statusDateRange.endDate}
          onChange={(endDate) =>
            setStatusDateRange((current) => ({ ...current, endDate }))
          }
        />
        <div className="monitoring-table-field">
          <span>查询表</span>
          <MonitoringTableSelector value={targetTable} onChange={setTargetTable} />
        </div>
      </div>
      <div className="monitoring-control-actions">
        {statusState && (
          <div className={`monitoring-inline-result ${statusState.ok ? "ok" : "error"}`}>
            {statusState.text}
          </div>
        )}
        <GlassButton
          variant="secondary"
          onClick={recalculateDrawingDurations}
          disabled={statusSyncing || !configReady}
        >
          <Calculator size={17} />
          {statusSyncing ? "处理中" : "重算用时"}
        </GlassButton>
        <GlassButton
          variant="primary"
          onClick={() => syncDrawingStatus()}
          disabled={statusSyncing || !configReady}
        >
          <RefreshCw size={17} />
          {statusSyncing ? "检测中" : "立即检测"}
        </GlassButton>
      </div>
    </GlassCard>
  );
}
