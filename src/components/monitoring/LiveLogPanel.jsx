import { memo, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Info,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { localizeRuntimeLog } from "../../features/monitoring/runtime-log-language.js";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";

const levelIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  debug: Info,
};

const levelLabel = {
  info: "信息",
  success: "成功",
  warning: "警告",
  error: "错误",
  debug: "调试",
};

function formatLogTime(value) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function LiveLogPanelComponent({
  authenticated,
  error,
  lastUpdated,
  loading,
  logs = [],
  onRefresh,
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs
      .map((log) => ({ ...log, ...localizeRuntimeLog(log) }))
      .filter((log) => level === "all" || log.level === level)
      .filter((log) => {
        if (!normalizedQuery) return true;
        return [log.eventLabel, log.messageLabel, log.event, log.message]
          .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      });
  }, [level, logs, query]);

  async function copyLog(log) {
    await navigator.clipboard?.writeText?.(
      `[${formatLogTime(log.timestamp)}] ${levelLabel[log.level] || "信息"} ${log.eventLabel}：${log.messageLabel}`,
    );
  }

  return (
    <GlassCard className="live-log-center">
      <div className="monitoring-panel-head runtime-log-head">
        <div>
          <h3>机器人运行日志</h3>
          <p>
            读取飞书机器人的最新运行日志；敏感凭证会在接口返回前脱敏。
          </p>
        </div>
        <div className="runtime-log-status">
          {lastUpdated && <span>更新于 {formatLogTime(lastUpdated)}</span>}
          <StatusBadge tone={error ? "error" : visibleLogs.length > 0 ? "neutral" : "warning"}>
            {visibleLogs.length} 条
          </StatusBadge>
        </div>
      </div>

      {!authenticated && (
        <div className="monitoring-log-gate">
          <LockKeyhole size={20} aria-hidden="true" />
          <div>
            <strong>管理员登录后可查看</strong>
            <p>运行日志可能包含内部错误信息，因此仅向管理员开放。</p>
          </div>
        </div>
      )}

      {authenticated && (
        <>
          <div className="log-tools">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索错误、事件或服务名"
              aria-label="搜索机器人运行日志"
              autoComplete="off"
            />
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              aria-label="日志级别筛选"
            >
              <option value="all">全部级别</option>
              <option value="error">错误</option>
              <option value="warning">警告</option>
              <option value="info">信息</option>
              <option value="debug">调试</option>
            </select>
            <GlassButton variant="secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={loading ? "runtime-log-refreshing" : ""} size={16} />
              {loading ? "刷新中" : "立即刷新"}
            </GlassButton>
          </div>

          {error && (
            <div className="runtime-log-error" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {loading && logs.length === 0 && <div className="monitoring-skeleton log" />}

          {!loading && !error && visibleLogs.length === 0 && (
            <div className="monitoring-log-empty">
              {logs.length === 0 ? "服务器暂时没有机器人运行日志" : "没有符合筛选条件的日志"}
            </div>
          )}

          {visibleLogs.length > 0 && (
            <div className="monitoring-log-list" aria-live="polite">
              {visibleLogs.map((log) => {
                const Icon = levelIcon[log.level] || Info;
                return (
                  <article className={`monitoring-log-row ${log.level}`} key={log.id}>
                    <time dateTime={log.timestamp}>{formatLogTime(log.timestamp)}</time>
                    <span className="monitoring-log-level">
                      <Icon size={14} aria-hidden="true" />
                      {levelLabel[log.level] || "信息"}
                    </span>
                    <div className="monitoring-log-content">
                      <strong>{log.eventLabel}</strong>
                      <p title={log.messageLabel}>{log.messageLabel}</p>
                    </div>
                    <button type="button" onClick={() => copyLog(log)} aria-label="复制这条日志">
                      <Clipboard size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

export const LiveLogPanel = memo(LiveLogPanelComponent);
