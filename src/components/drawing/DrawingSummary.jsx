import { Activity, CheckCircle2, Clock3, Database, UsersRound } from "lucide-react";

const metrics = [
  { key: "owners", label: "绘图人员", icon: UsersRound },
  { key: "drawing", label: "绘图中人员", icon: Activity },
  { key: "idle", label: "空闲人员", icon: Clock3 },
  { key: "drawingCount", label: "当前任务", icon: Database },
  { key: "todayClaimed", label: "今日接图", icon: Database },
  { key: "todayCompleted", label: "今日完成", icon: CheckCircle2 },
];

export default function DrawingSummary({ summary }) {
  return (
    <section className="drawing-summary-grid" aria-label="绘图运行总览">
      {metrics.map(({ key, label, icon: Icon }) => (
        <article className={`drawing-summary-card metric-${key}`} key={key}>
          <span><Icon size={17} />{label}</span>
          <strong>{typeof summary[key] === "number" ? summary[key] : "—"}</strong>
        </article>
      ))}
    </section>
  );
}
