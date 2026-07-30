import { CheckCircle2, Database, Link2 } from "lucide-react";
import { formatDate } from "./dashboard-formatters.js";

function StatusChip({ icon: Icon, ok, children }) {
  return (
    <span className={`home-status-chip ${ok ? "ok" : "error"}`}>
      <Icon size={18} strokeWidth={1.8} />
      {children}
    </span>
  );
}

export function HomeDashboardHeader({ data, now }) {
  const healthOk = Boolean(data?.health?.ok);
  const websocketOk = Boolean(data?.health?.checks?.websocket?.ok);
  const configReady = Boolean(data?.configReady);

  return (
    <header className="home-dashboard-header">
      <div className="home-title-line left" />
      <h1>技术组 · 绘图数据</h1>
      <div className="home-title-line right" />
      <div className="home-clock">
        <strong>{formatDate(now, true)}</strong>
        <span><i />实时更新</span>
      </div>
      <div className="home-system-status">
        <StatusChip icon={CheckCircle2} ok={healthOk}>
          检测{healthOk ? "通过" : "异常"}
        </StatusChip>
        <StatusChip icon={Link2} ok={websocketOk}>
          飞书连接{websocketOk ? "正常" : "异常"}
        </StatusChip>
        <StatusChip icon={Database} ok={configReady}>
          配置{configReady ? "已加载" : "未加载"}
        </StatusChip>
      </div>
    </header>
  );
}
