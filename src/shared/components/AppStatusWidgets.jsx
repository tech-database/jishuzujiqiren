import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  Timer,
} from "lucide-react";
import { AnimatedNumber } from "../../components/motion";
import { aggregateImportResults } from "../../utils/importResultUtils.js";

export function Pill({ tone = "neutral", icon: Icon, children }) {
  return (
    <span className={`pill ${tone}`}>
      {Icon && <Icon size={14} />}
      {children}
    </span>
  );
}

export function ProgressBar({ active, label, value = null }) {
  if (!active) return null;
  const isDeterminate = typeof value === "number";
  return (
    <div className="progress-block" role="status" aria-live="polite">
      <div className="progress-meta">
        <span>{label}</span>
        {isDeterminate && <strong>{Math.round(value)}%</strong>}
      </div>
      <div
        className={`progress-track ${isDeterminate ? "determinate" : "indeterminate"}`}
        aria-label={label}
        aria-valuemin={isDeterminate ? 0 : undefined}
        aria-valuemax={isDeterminate ? 100 : undefined}
        aria-valuenow={isDeterminate ? Math.round(value) : undefined}
        role="progressbar"
      >
        <span style={isDeterminate ? { width: `${Math.max(0, Math.min(100, value))}%` } : undefined} />
      </div>
    </div>
  );
}

export function RobotStatusWidget({
  activeTab,
  configReady,
  healthStatus,
  statusResult,
  ownerStats,
  uploadState,
  uploadFiles,
}) {
  const taskLabels = {
    connection: "连接配置",
    mapping: "字段映射",
    commands: "飞书口令",
    people: "人员映射",
    status: "状态检测",
    analytics: "数据看板",
    owners: "绘图人动态",
    upload: "数据导入",
    drawing: "领图登记",
    orders: "下单确认",
  };
  const hasRangeCompletion = typeof statusResult?.summary?.done === "number";
  const completed = statusResult?.summary?.done ?? ownerStats?.summary?.todayCompleted ?? null;
  const completedLabel = hasRangeCompletion ? "区间完成" : "今日完成";
  const completedDetail = hasRangeCompletion ? "当前检测日期范围" : "来自今日任务统计";
  const total = statusResult?.summary?.total ?? null;
  const completionRate =
    typeof completed === "number" && typeof total === "number" && total > 0
      ? (completed / total) * 100
      : null;
  const failedHealthCheck = Object.values(healthStatus?.checks || {}).find((item) => item?.ok === false);
  const statusLabel = healthStatus
    ? healthStatus.ok ? "检测通过" : "连接异常"
    : configReady ? "等待检测" : "未知状态";
  const statusDetail = healthStatus?.ok
    ? taskLabels[activeTab] || "控制中心"
    : failedHealthCheck?.message || taskLabels[activeTab] || "控制中心";

  if (activeTab === "upload") {
    const importSummary = aggregateImportResults(uploadState?.results || []);
    const queuedFiles = Array.isArray(uploadFiles) ? uploadFiles.length : 0;
    const failedTasks = uploadState?.ok === false ? 1 : 0;
    const processedRows = importSummary.parsedCount || importSummary.resultCount;
    return (
      <aside className="robot-status-widget status-overview import-status-overview" aria-label="数据导入状态">
        <StatusItem icon={FileSpreadsheet} label="待导入文件" value={queuedFiles} detail="当前选择" />
        <StatusItem icon={CheckCircle2} label="成功写入" value={importSummary.resultCount} detail="本次会话" />
        <StatusItem icon={Activity} label="失败任务" value={failedTasks} detail="本次会话" />
        <StatusItem icon={Database} label="处理数据量" value={processedRows} detail="解析记录" />
      </aside>
    );
  }

  return (
    <aside className="robot-status-widget status-overview" aria-label="机器人状态">
      <StatusItem icon={Activity} label="检测状态" text={statusLabel} detail={statusDetail} detection />
      <StatusItem icon={Timer} label="运行时间" text="当前接口未提供" detail="等待接口数据" />
      <StatusItem
        icon={ClipboardCheck}
        label={completedLabel}
        value={completed}
        fallback="暂无数据"
        detail={completedDetail}
      />
      <StatusItem
        icon={CheckCircle2}
        label="完成率"
        value={completionRate}
        decimals={1}
        suffix="%"
        fallback="暂无数据"
        detail="按已检测任务计算"
      />
    </aside>
  );
}

function StatusItem({
  icon: Icon,
  label,
  value,
  text,
  detail,
  detection = false,
  decimals,
  suffix,
  fallback,
}) {
  return (
    <div className={`status-overview-item ${detection ? "detection" : ""}`}>
      <span className="status-overview-icon"><Icon size={19} /></span>
      <span className="status-overview-copy">
        <small>{label}</small>
        {typeof value === "number"
          ? <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          : <strong>{text || fallback}</strong>}
        <span title={detail}>{detail}</span>
      </span>
    </div>
  );
}
