import { memo, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clipboard, Info, Trash2 } from "lucide-react";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";

const levelIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  debug: Info,
  unknown: Info,
};

function LiveLogPanelComponent({ logs, loading }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [hiddenIds, setHiddenIds] = useState([]);
  const visibleLogs = useMemo(
    () =>
      logs
        .filter((log) => !hiddenIds.includes(log.id))
        .filter((log) => level === "all" || log.level === level)
        .filter((log) => !query || log.message.toLowerCase().includes(query.toLowerCase())),
    [hiddenIds, level, logs, query],
  );

  async function copyLog(log) {
    await navigator.clipboard?.writeText?.(`[${log.time}] ${log.level}: ${log.message}`);
  }

  return (
    <GlassCard className="live-log-center">
      <div className="monitoring-panel-head">
        <div>
          <h3>实时日志</h3>
          <p>基于当前检测接口和后台状态派生，不删除后端历史数据。</p>
        </div>
        <StatusBadge tone={visibleLogs.length > 0 ? "neutral" : "warning"}>{visibleLogs.length} 条</StatusBadge>
      </div>

      <div className="log-tools">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索日志内容" />
        <select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="日志级别筛选">
          <option value="all">全部级别</option>
          <option value="info">info</option>
          <option value="success">success</option>
          <option value="warning">warning</option>
          <option value="error">error</option>
        </select>
        <GlassButton variant="secondary" onClick={() => setHiddenIds(logs.map((log) => log.id))} disabled={logs.length === 0}>
          <Trash2 size={16} />
          清空当前显示
        </GlassButton>
      </div>

      {loading && <div className="monitoring-skeleton log" />}

      {!loading && visibleLogs.length === 0 && <div className="monitoring-log-empty">暂无日志</div>}

      {!loading && visibleLogs.length > 0 && (
        <div className="monitoring-log-list">
          {visibleLogs.map((log) => {
            const Icon = levelIcon[log.level] || levelIcon.unknown;
            return (
              <article className={`monitoring-log-row ${log.level}`} key={log.id}>
                <span className="monitoring-log-level">
                  <Icon size={15} />
                  {log.level}
                </span>
                <time>{log.time}</time>
                <p>{log.message}</p>
                <button type="button" onClick={() => copyLog(log)} aria-label="复制日志">
                  <Clipboard size={15} />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

export const LiveLogPanel = memo(LiveLogPanelComponent);
