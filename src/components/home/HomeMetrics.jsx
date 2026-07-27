import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Database,
  UserRound,
  UsersRound,
} from "lucide-react";
import { CountUpNumber } from "./CountUpNumber.jsx";

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

export function HomeMetrics({ board, loading, paint, personnelSummary }) {
  return (
    <section className={`home-metrics ${loading ? "is-loading" : ""}`} aria-label="今日运行指标">
      <MetricCard index={0} icon={UsersRound} label="绘图人员" value={personnelSummary.owners} />
      <MetricCard index={1} icon={Activity} label="绘图中" value={personnelSummary.drawing} />
      <MetricCard index={2} icon={UserRound} label="空闲人员" value={personnelSummary.idle} />
      <MetricCard
        index={3}
        icon={ClipboardList}
        tone="dual"
        split={[
          { label: "胶板今日任务", value: board.total },
          { label: "油漆今日任务", value: paint.total },
        ]}
      />
      <MetricCard
        index={4}
        icon={Database}
        tone="dual"
        split={[
          { label: "胶板未领取", value: board.unclaimed },
          { label: "油漆未领取", value: paint.unclaimed },
        ]}
      />
      <MetricCard
        index={5}
        icon={Activity}
        tone="dual"
        split={[
          { label: "胶板绘图中", value: board.drawing },
          { label: "油漆绘图中", value: paint.drawing },
        ]}
      />
      <MetricCard
        index={6}
        icon={CheckCircle2}
        tone="green"
        split={[
          { label: "胶板已完成", value: board.done },
          { label: "油漆已完成", value: paint.done },
        ]}
      />
    </section>
  );
}
