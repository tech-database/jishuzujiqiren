import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileUp,
  Images,
  KeyRound,
  Link2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Timer,
  UserRoundCheck,
  UsersRound,
  Workflow,
  X,
} from "lucide-react";
import { LightFallBackground } from "./components/design-system";
import {
  AnimatedNumber,
  HoverCard,
  LiveLog,
  PageTransition,
  ProgressAnimation,
  StatusPulse,
} from "./components/motion";
import { ErrorBoundary } from "./components/system/ErrorBoundary.jsx";
import { getImportFileKey, validateImportFiles } from "./utils/importFileUtils";
import { buildImportSuccessText, sanitizeImportError } from "./utils/importResultUtils";
import { parseMaterialCodes as parseMaterialCodeSummary, removeMaterialCodeAtIndex } from "./utils/materialCodeUtils";
import { sanitizeAssignmentError } from "./utils/assignmentResultUtils";
import "./styles.css";

const MappingStudio = React.lazy(() => import("./components/field-mapping/MappingStudio.jsx"));
const MonitoringCenter = React.lazy(() => import("./components/monitoring/MonitoringCenter.jsx"));
const ConnectionManagementCenter = React.lazy(() => import("./components/connection/ConnectionManagementCenter.jsx"));
const CommandCenter = React.lazy(() => import("./components/commands/CommandCenter.jsx"));
const PeopleMappingCenter = React.lazy(() => import("./components/people/PeopleMappingCenter.jsx"));
const DrawingOperationsCenter = React.lazy(() => import("./components/drawing/DrawingOperationsCenter.jsx"));
const DataImportCenter = React.lazy(() => import("./components/import-write/DataImportCenter.jsx"));
const DrawingAssignmentCenter = React.lazy(() => import("./components/assignment/DrawingAssignmentCenter.jsx"));

const emptyConfig = {
  appId: "",
  appSecret: "",
  appSecretSet: false,
  bitableAppToken: "",
  bitableTableId: "",
  paintBitableAppToken: "",
  paintBitableTableId: "",
  replyEnabled: false,
  nameIdMap: {},
};

const tableOptions = [
  { key: "board", label: "胶板" },
  { key: "paint", label: "油漆" },
];

function invertFieldMap(fieldMap) {
  const result = {};
  for (const [exportTitle, bitableField] of Object.entries(fieldMap || {})) {
    if (exportTitle === bitableField) continue;
    result[bitableField] = exportTitle;
  }
  return result;
}

function buildFieldMap(fieldMappings) {
  const result = {};
  for (const [bitableField, exportTitle] of Object.entries(fieldMappings)) {
    const trimmed = exportTitle.trim();
    if (trimmed && trimmed !== bitableField) {
      result[trimmed] = bitableField;
    }
  }
  return result;
}

function normalizeNameIdMap(source) {
  let value = source;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => [String(item?.id || item?.userId || "").trim(), String(item?.name || "").trim()])
        .filter(([id, name]) => id && name),
    );
  }

  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([id, name]) => [String(id || "").trim(), String(name || "").trim()])
      .filter(([id, name]) => id && name),
  );
}

function mapToNameIdRows(nameIdMap) {
  const rows = Object.entries(normalizeNameIdMap(nameIdMap)).map(([id, name]) => ({ id, name }));
  return rows.length > 0 ? rows : [{ id: "", name: "" }];
}

function buildNameIdMap(rows) {
  const result = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = String(row?.id || "").trim();
    const name = String(row?.name || "").trim();
    if (id && name) result[id] = name;
  }
  return result;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function Pill({ tone = "neutral", icon: Icon, children }) {
  return (
    <span className={`pill ${tone}`}>
      {Icon && <Icon size={14} />}
      {children}
    </span>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <label className="field-row">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

function ProgressBar({ active, label, value = null }) {
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

function TableSelector({ value, onChange }) {
  return (
    <div className="table-selector" aria-label="目标多维表">
      {tableOptions.map((option) => (
        <button
          className={value === option.key ? "active" : ""}
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ConnectionMetricCard({ icon: Icon, title, status, detail, meta, tone = "neutral" }) {
  return (
    <article className={`connection-metric-card ${tone}`}>
      <div className="metric-card-head">
        <span className="metric-icon">
          <Icon size={24} />
        </span>
        <Pill tone={tone === "success" ? "success" : tone === "error" ? "warning" : "neutral"} icon={Activity}>
          {status}
        </Pill>
      </div>
      <div className="metric-card-body">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div className="metric-card-meta">
        <Timer size={16} />
        {meta}
      </div>
    </article>
  );
}

function ConfigGroup({ icon: Icon, title, description, children }) {
  return (
    <section className="config-group-card">
      <div className="config-group-head">
        <span className="config-group-icon">
          <Icon size={22} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="config-field-stack">{children}</div>
    </section>
  );
}

function ControlField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  secret = false,
  revealed = false,
  onToggleReveal,
  onCopy,
}) {
  const filled = Boolean(String(value || "").trim());
  const inputType = secret && !revealed ? "password" : type;
  return (
    <label className="control-field">
      <span className="control-field-label">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <span className={`control-input-shell ${filled ? "verified" : "empty"}`}>
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="control-verify" title={filled ? "已填写" : "待填写"} />
        {secret && (
          <button type="button" className="control-tool-button" onClick={onToggleReveal} aria-label="显示或隐藏">
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        <button
          type="button"
          className="control-tool-button"
          onClick={onCopy}
          disabled={!filled}
          aria-label="复制"
        >
          <Copy size={18} />
        </button>
      </span>
    </label>
  );
}

function ConnectionCenter({
  connected,
  configReady,
  healthStatus,
  healthLoading,
  bitableFields,
  targetTable,
  setTargetTable,
  config,
  updateConfig,
  secretVisible,
  setSecretVisible,
  copyConfigValue,
  copiedField,
  checkState,
  saveState,
  saving,
  savingConfig,
  checking,
  saveConfig,
  checkConnection,
  formatDisplayTime,
}) {
  return (
    <section className="connection-center page-enter">
      <div className="page-section-header">
        <div className="section-title-block">
          <span className="section-icon">
            <Link2 size={24} />
          </span>
          <div>
            <h2>机器人连接中心</h2>
            <p>管理机器人与飞书、多维表格和 Excel 数据流的连接状态。</p>
          </div>
        </div>
        <div className="header-status">
          <Pill tone={connected || configReady ? "success" : "warning"} icon={CheckCircle2}>
            {connected ? "连接成功" : configReady ? "配置已保存" : "等待连接"}
          </Pill>
          <Pill tone={healthStatus?.ok ? "success" : "warning"} icon={Activity}>
            {healthLoading && !healthStatus ? "检测中" : healthStatus?.label || "等待检测"}
          </Pill>
        </div>
      </div>

      <section className="connection-dashboard" aria-label="连接健康概览">
        <ConnectionMetricCard
          icon={MessageSquareText}
          title="飞书连接"
          status={healthStatus?.ok ? "检测通过" : "等待检测"}
          tone={healthStatus?.ok ? "success" : "neutral"}
          detail={healthStatus?.label || "等待飞书服务健康检测"}
          meta={`最近检测 ${formatDisplayTime(healthStatus?.checkedAt)}`}
        />
        <ConnectionMetricCard
          icon={FileSpreadsheet}
          title="表格数据源"
          status={configReady ? "已配置" : "等待配置"}
          tone={configReady ? "success" : "neutral"}
          detail={bitableFields.length > 0 ? `已读取 ${bitableFields.length} 个字段` : "等待连接后读取字段"}
          meta={`目标表 ${targetTable === "board" ? "胶板" : "油漆"}`}
        />
        <ConnectionMetricCard
          icon={Workflow}
          title="数据同步"
          status={checking || savingConfig ? "处理中" : "等待触发"}
          tone={checking || savingConfig ? "neutral" : configReady ? "success" : "neutral"}
          detail={checking ? "正在测试连接并读取字段" : savingConfig ? "正在保存配置" : "机器人自动化链路待命"}
          meta={checkState?.ok ? "检测刚刚完成" : "等待检测"}
        />
      </section>

      {healthStatus && (
        <section className="card connection-health-panel" aria-label="飞书连接健康检查">
          <div className="section-head">
            <div>
              <h2>实时健康信号</h2>
              <p>飞书开放平台、数据权限与网络连通性的实时检查结果。</p>
            </div>
            <Pill tone={healthStatus.ok ? "success" : "warning"} icon={Server}>
              {healthStatus.ok ? "服务正常" : "需要处理"}
            </Pill>
          </div>
          <div className="health-grid">
            {Object.entries(healthStatus.checks || {}).map(([key, item]) => (
              <div className={`health-item ${item.ok ? "ok" : "error"}`} key={key}>
                <span>{item.ok ? "正常" : "异常"}</span>
                <strong>{item.message}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="connection-config-layout">
        <ConfigGroup
          icon={Bot}
          title="基础配置"
          description="机器人应用身份与密钥管理。密钥留空时不会覆盖已保存值。"
        >
          <ControlField
            label="App ID"
            hint="飞书应用凭证"
            placeholder="请输入 App ID"
            value={config.appId}
            onChange={(value) => updateConfig("appId", value)}
            onCopy={() => copyConfigValue("appId", config.appId)}
          />
          <ControlField
            label="App Secret"
            hint={config.appSecretSet ? "已保存密钥，可留空保持不变" : "首次配置需要填写"}
            placeholder={config.appSecretSet ? "已保存 ******" : "请输入 App Secret"}
            value={config.appSecret}
            secret
            revealed={secretVisible}
            onToggleReveal={() => setSecretVisible((current) => !current)}
            onChange={(value) => updateConfig("appSecret", value)}
            onCopy={() => copyConfigValue("appSecret", config.appSecret)}
          />
        </ConfigGroup>

        <ConfigGroup
          icon={Database}
          title="飞书数据表"
          description="胶板业务主表，用于新增写入、字段映射与状态同步。"
        >
          <ControlField
            label="多维表 App Token"
            hint="目标多维表 token"
            placeholder="请输入多维表 App Token"
            value={config.bitableAppToken}
            onChange={(value) => updateConfig("bitableAppToken", value)}
            onCopy={() => copyConfigValue("bitableAppToken", config.bitableAppToken)}
          />
          <ControlField
            label="Table ID"
            hint="目标数据表 ID"
            placeholder="请输入 Table ID"
            value={config.bitableTableId}
            onChange={(value) => updateConfig("bitableTableId", value)}
            onCopy={() => copyConfigValue("bitableTableId", config.bitableTableId)}
          />
        </ConfigGroup>

        <ConfigGroup
          icon={Images}
          title="油漆数据表"
          description="油漆业务表连接，用于同一套机器人流程的分表写入。"
        >
          <ControlField
            label="油漆 App Token"
            hint="油漆多维表 token"
            placeholder="请输入油漆多维表 App Token"
            value={config.paintBitableAppToken}
            onChange={(value) => updateConfig("paintBitableAppToken", value)}
            onCopy={() => copyConfigValue("paintBitableAppToken", config.paintBitableAppToken)}
          />
          <ControlField
            label="油漆 Table ID"
            hint="油漆数据表 ID"
            placeholder="请输入油漆 Table ID"
            value={config.paintBitableTableId}
            onChange={(value) => updateConfig("paintBitableTableId", value)}
            onCopy={() => copyConfigValue("paintBitableTableId", config.paintBitableTableId)}
          />
        </ConfigGroup>
      </section>

      <section className="card connection-ops-panel">
        <div className="ops-panel-main">
          <div className="section-title-block">
            <span className="section-icon">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h2>连接操作</h2>
              <p>选择目标表后保存配置或执行连接测试，测试成功后会读取字段用于映射。</p>
            </div>
          </div>
          <div className="target-table-row">
            <span>当前测试表</span>
            <TableSelector value={targetTable} onChange={setTargetTable} />
          </div>
          {copiedField && <div className="inline-result ok">已复制 {copiedField}</div>}
          {(checkState || saveState) && (
            <div className={`inline-result ${(checkState || saveState).ok ? "ok" : "error"}`}>
              {(checkState || saveState).text}
            </div>
          )}
          <ProgressBar active={savingConfig} label="正在保存配置" />
          <ProgressBar active={checking} label="正在测试连接并读取字段" />
        </div>
        <div className="connection-action-stack">
          <button className="button secondary" onClick={() => saveConfig()} disabled={saving}>
            <Save size={18} />
            {saving ? "保存中" : "保存配置"}
          </button>
          <button className="button primary" onClick={checkConnection} disabled={checking}>
            <KeyRound size={18} />
            {checking ? "检查中" : "测试连接"}
          </button>
        </div>
      </section>

      <section className="workflow-strip" aria-label="机器人使用方式">
        <span>
          <FileSpreadsheet size={18} />
          @机器人 胶板新增 / 油漆新增
        </span>
        <span>
          <Link2 size={18} />
          上传 Excel
        </span>
        <span>
          <CheckCircle2 size={18} />
          @机器人 完成
        </span>
        <span>
          <Images size={18} />
          @机器人 料号 领图
        </span>
      </section>
    </section>
  );
}

function RobotStatusWidget({ activeTab, configReady, healthStatus, statusResult, ownerStats }) {
  const taskLabels = {
    connection: "连接配置",
    mapping: "字段映射",
    commands: "飞书口令",
    people: "人员映射",
    status: "状态检测",
    owners: "绘图人动态",
    upload: "数据导入",
    drawing: "领图登记",
  };
  const completed = statusResult?.summary?.done ?? ownerStats?.summary?.todayCompleted ?? null;
  const total = statusResult?.summary?.total ?? null;
  const completionRate =
    typeof completed === "number" && typeof total === "number" && total > 0
      ? (completed / total) * 100
      : null;
  const statusLabel = healthStatus?.ok ? "检测通过" : configReady ? "等待检测" : "未知状态";

  return (
    <aside className="robot-status-widget" aria-label="机器人状态">
      <StatusPulse
        tone={healthStatus?.ok ? "online" : configReady ? "running" : "standby"}
        label={statusLabel}
        detail={taskLabels[activeTab] || "控制中心"}
      />
      <div className="robot-status-metrics">
        <span>
          <small>运行时间</small>
          <strong>当前接口未提供</strong>
        </span>
        <span>
          <small>今日完成</small>
          {typeof completed === "number" ? <AnimatedNumber value={completed} /> : <strong>暂无数据</strong>}
        </span>
        <span>
          <small>完成率</small>
          {typeof completionRate === "number" ? (
            <AnimatedNumber value={completionRate} decimals={1} suffix="%" />
          ) : (
            <strong>暂无数据</strong>
          )}
        </span>
      </div>
    </aside>
  );
}

function MonitoringMetricCard({ title, value, tone = "neutral", suffix = "" }) {
  const hasValue = typeof value === "number" && Number.isFinite(value);
  return (
    <HoverCard className={`monitor-metric-card ${tone}`}>
      <span>{title}</span>
      {hasValue ? <AnimatedNumber value={value} suffix={suffix} /> : <strong>暂无数据</strong>}
      <div className="metric-empty-note">当前接口未提供趋势数据</div>
    </HoverCard>
  );
}

function buildMonitoringLogs({ backgroundSyncStatus, statusResult, statusState, formatDisplayTime }) {
  const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const logs = [];

  if (backgroundSyncStatus?.running) {
    logs.push({
      id: "running",
      time: now,
      message: "后台检测正在运行",
      tone: "running",
    });
  }
  if (statusResult?.summary) {
    logs.push({
      id: "summary",
      time: now,
      message: `检测结果已更新：共 ${statusResult.summary.total} 项，绘图中 ${statusResult.summary.drawing} 项，已完成 ${statusResult.summary.done} 项`,
      tone: "success",
    });
  }
  if (backgroundSyncStatus?.lastCheckedAt) {
    logs.push({
      id: "checked",
      time: formatDisplayTime(backgroundSyncStatus.lastCheckedAt).split(" ").pop() || now,
      message: "最近一次后台检测完成",
      tone: "info",
    });
  }
  if (backgroundSyncStatus?.lastChangedAt) {
    logs.push({
      id: "changed",
      time: formatDisplayTime(backgroundSyncStatus.lastChangedAt).split(" ").pop() || now,
      message: "检测到任务状态发生变化",
      tone: "running",
    });
  }
  if (backgroundSyncStatus?.lastError) {
    logs.push({
      id: "error",
      time: now,
      message: `后台检测异常：${backgroundSyncStatus.lastError}`,
      tone: "error",
    });
  }
  if (statusState?.text) {
    logs.push({
      id: "status-state",
      time: now,
      message: statusState.text,
      tone: statusState.ok ? "success" : "error",
    });
  }
  return logs.slice(0, 6);
}
function StatusMonitoringCenter({
  configReady,
  targetTable,
  setTargetTable,
  statusDateRange,
  setStatusDateRange,
  statusSyncing,
  backgroundSyncStatus,
  statusResult,
  statusState,
  syncDrawingStatus,
  formatDisplayTime,
}) {
  const summary = statusResult?.summary || { total: null, unclaimed: null, drawing: null, done: null };
  const hasStatusSummary = typeof summary.total === "number";
  const abnormal = hasStatusSummary
    ? Math.max(0, summary.total - summary.unclaimed - summary.drawing - summary.done)
    : null;
  const completionRate = hasStatusSummary && summary.total > 0 ? (summary.done / summary.total) * 100 : null;
  const healthLabel = backgroundSyncStatus?.lastError
    ? "异常待处理"
    : backgroundSyncStatus?.lastCheckedAt
      ? "已检测"
      : "等待检测";
  const logs = buildMonitoringLogs({ backgroundSyncStatus, statusResult, statusState, formatDisplayTime });

  return (
    <PageTransition className="monitoring-center">
      <div className="page-section-header">
        <div className="section-title-block">
          <span className="section-icon">
            <Activity size={24} />
          </span>
          <div>
            <h2>机器人状态检测中心</h2>
            <p>实时检测绘图状态、同步飞书数据，并监控自动化链路健康度。</p>
          </div>
        </div>
        <StatusPulse
          tone={statusSyncing ? "running" : backgroundSyncStatus?.lastCheckedAt ? "online" : "standby"}
          label={statusSyncing ? "检测中" : configReady ? "等待检测" : "未知状态"}
          detail={backgroundSyncStatus?.running ? "后台检测运行中" : "暂无实时状态"}
        />
      </div>

      <section className="monitoring-metrics">
        <MonitoringMetricCard title="检测总数" value={summary.total} tone="neutral" />
        <MonitoringMetricCard title="绘图中" value={summary.drawing} tone="warning" />
        <MonitoringMetricCard title="已完成" value={summary.done} tone="success" />
        <MonitoringMetricCard title="异常" value={abnormal} tone={abnormal > 0 ? "danger" : "success"} />
      </section>

      <section className="monitoring-grid">
        <HoverCard className="monitor-panel progress-panel" as="section">
          <div className="section-head">
            <div>
              <h2>任务完成情况</h2>
              <p>根据当前检测结果计算完成率，并随数据同步实时更新。</p>
            </div>
            <Pill tone={configReady ? "neutral" : "warning"} icon={ShieldCheck}>
              {configReady ? "配置已填写" : "等待配置"}
            </Pill>
          </div>
          <div className="progress-panel-body">
            {typeof completionRate === "number" ? (
              <ProgressAnimation value={completionRate} label="完成率" />
            ) : (
              <div className="progress-empty-state">暂无数据</div>
            )}
            <div className="monitor-detail-stack">
              <span>
                <strong>{formatDisplayTime(backgroundSyncStatus?.lastCheckedAt)}</strong>
                <small>最近检测</small>
              </span>
              <span>
                <strong>{formatDisplayTime(backgroundSyncStatus?.lastFinishedAt)}</strong>
                <small>最近完成</small>
              </span>
              <span>
                <strong>{backgroundSyncStatus?.intervalMs ? `${Math.round(backgroundSyncStatus.intervalMs / 1000)}s` : "暂无数据"}</strong>
                <small>检测间隔</small>
              </span>
            </div>
          </div>
        </HoverCard>

        <HoverCard className="monitor-panel health-panel" as="section">
          <div className="section-head">
            <div>
              <h2>系统健康状态</h2>
              <p>异常监控、后台同步和飞书数据读写状态。</p>
            </div>
            <StatusPulse
              tone={backgroundSyncStatus?.lastError ? "error" : backgroundSyncStatus?.lastCheckedAt ? "online" : "standby"}
              label={healthLabel}
              detail="系统健康"
            />
          </div>
          <div className="health-meter">
            <span style={{ width: backgroundSyncStatus?.lastCheckedAt ? "100%" : "0%" }} />
          </div>
          <div className="monitor-detail-stack compact">
            <span>
                <strong>{backgroundSyncStatus?.lastError ? "异常待处理" : backgroundSyncStatus?.lastCheckedAt ? "无异常" : "暂无数据"}</strong>
                <small>异常监控</small>
              </span>
            <span>
              <strong>{backgroundSyncStatus?.running ? "运行中" : "待命"}</strong>
              <small>后台任务</small>
            </span>
          </div>
        </HoverCard>
      </section>

      <section className="card monitor-control-panel">
        <div className="status-filter-bar">
          <FieldRow label="开始日期" hint="默认前天">
            <input
              type="date"
              value={statusDateRange.startDate}
              onChange={(event) =>
                setStatusDateRange((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </FieldRow>
          <FieldRow label="结束日期" hint="默认今天">
            <input
              type="date"
              value={statusDateRange.endDate}
              onChange={(event) =>
                setStatusDateRange((current) => ({ ...current, endDate: event.target.value }))
              }
            />
          </FieldRow>
          <div className="target-table-row">
            <span>查询表</span>
            <TableSelector value={targetTable} onChange={setTargetTable} />
          </div>
        </div>
        <ProgressBar active={statusSyncing} label="正在检测并同步图纸状态" />
        <div className="connection-actions">
          {statusState && (
            <div className={`inline-result ${statusState.ok ? "ok" : "error"}`}>
              {statusState.text}
            </div>
          )}
          <div className="action-buttons">
            <button
              className="button primary"
              onClick={() => syncDrawingStatus()}
              disabled={statusSyncing || !configReady}
            >
              <RefreshCw size={18} />
              {statusSyncing ? "检测中" : "立即检测"}
            </button>
          </div>
        </div>
      </section>

      <section className="monitoring-grid logs-grid">
        <HoverCard className="monitor-panel live-log-panel" as="section">
          <div className="section-head">
            <div>
              <h2>实时操作日志</h2>
              <p>机器人检测、同步与异常事件会在这里形成实时日志流。</p>
            </div>
          </div>
          <LiveLog items={logs} />
          {logs.length === 0 && <div className="monitor-empty-state">暂无日志数据</div>}
        </HoverCard>
        <HoverCard className="monitor-panel anomaly-panel" as="section">
          <div className="section-head">
            <div>
              <h2>异常关注</h2>
              <p>聚合未领取、绘图中、已完成和异常状态，辅助判断生产阻塞。</p>
            </div>
          </div>
          <div className="anomaly-stack">
            <StatusPulse
              tone={typeof summary.unclaimed === "number" && summary.unclaimed > 0 ? "running" : hasStatusSummary ? "online" : "standby"}
              label={typeof summary.unclaimed === "number" ? `${summary.unclaimed} 未领取` : "暂无数据"}
            />
            <StatusPulse
              tone={typeof summary.drawing === "number" && summary.drawing > 0 ? "running" : "standby"}
              label={typeof summary.drawing === "number" ? `${summary.drawing} 绘图中` : "暂无数据"}
            />
            <StatusPulse
              tone={typeof abnormal === "number" && abnormal > 0 ? "error" : hasStatusSummary ? "online" : "standby"}
              label={typeof abnormal === "number" ? `${abnormal} 异常` : "暂无数据"}
            />
          </div>
        </HoverCard>
      </section>
    </PageTransition>
  );
}

const feishuCommands = [
  {
    title: "新增写入",
    command: "@机器人 胶板新增 / 油漆新增",
    example: "@机器人 胶板新增",
    result: "机器人进入 10 分钟上传窗口，并按口令写入胶板或油漆表；上传 Excel/CSV 后发送 @机器人 完成。",
  },
  {
    title: "完成新增",
    command: "@机器人 完成",
    example: "@机器人 完成",
    result: "处理本次上传窗口内的 Excel/CSV 文件，并写入飞书表格。",
  },
  {
    title: "领图",
    command: "@机器人 料号 领图",
    example: "@机器人 I-089F-K42 领图 2026-07-11 2026-07-13",
    result: "自动在胶板/油漆表匹配料号，写入发送人，状态改为绘图中，并记录领图时间。",
  },
  {
    title: "绘图完成",
    command: "@机器人 料号 绘图完成",
    example: "@机器人 I-089F-K42 绘图完成 2026-07-11 2026-07-13",
    result: "自动在胶板/油漆表匹配料号，状态改为绘图完成，并记录完成时间和用时。",
  },
  {
    title: "查询未领取",
    command: "@机器人 查询未领取",
    example: "@机器人 查询未领取",
    result: "返回当前未领取图纸数量。",
  },
  {
    title: "状态检测",
    command: "@机器人 状态检测",
    example: "@机器人 状态检测 2026-07-11 2026-07-13",
    result: "按指定或默认日期范围同步状态，返回未领取、绘图中、绘图完成数量。",
  },
  {
    title: "获取 ID",
    command: "@机器人 获取ID",
    example: "@机器人 获取ID",
    result: "机器人回复发送人的飞书用户 ID，可用于人员映射表。",
  },
  {
    title: "查看口令",
    command: "@机器人 口令",
    example: "@机器人 口令",
    result: "机器人在群里返回可用口令清单。",
  },
];

function App() {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(emptyConfig);
  const [configBaseline, setConfigBaseline] = useState(emptyConfig);
  const [configLoading, setConfigLoading] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [checkState, setCheckState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [bitableFields, setBitableFields] = useState([]);
  const [fieldMappings, setFieldMappings] = useState({});
  const [nameIdRows, setNameIdRows] = useState([{ id: "", name: "" }]);
  const [activeTab, setActiveTab] = useState("connection");
  const [targetTable, setTargetTable] = useState("board");
  const fileInputRef = useRef(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [uploadState, setUploadState] = useState(null);
  const [claimForm, setClaimForm] = useState({
    materialCodes: "",
    senderName: "",
  });
  const [claiming, setClaiming] = useState(false);
  const [completingDrawing, setCompletingDrawing] = useState(false);
  const [queryingClaims, setQueryingClaims] = useState(false);
  const [claimState, setClaimState] = useState(null);
  const [claimQueryResult, setClaimQueryResult] = useState(null);
  const [statusSyncing, setStatusSyncing] = useState(false);
  const [statusState, setStatusState] = useState(null);
  const [statusResult, setStatusResult] = useState(null);
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState(null);
  const [ownerStats, setOwnerStats] = useState(null);
  const [ownerStatsLoading, setOwnerStatsLoading] = useState(false);
  const [ownerStatsState, setOwnerStatsState] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const copiedFieldTimerRef = useRef(null);
  const [statusDateRange, setStatusDateRange] = useState(() => {
    const today = new Date();
    return {
      startDate: formatDateInput(addDays(today, -2)),
      endDate: formatDateInput(today),
    };
  });

  async function loadConfig() {
    setConfigLoading(true);
    try {
      const response = await fetch("/api/config");
      const data = await response.json();
      if (data.ok) {
        setStatus(data.status);
        const loadedConfig = { ...emptyConfig, ...data.config, appSecret: "" };
        setConfig(loadedConfig);
        setConfigBaseline(loadedConfig);
        setNameIdRows(mapToNameIdRows(data.config?.nameIdMap || data.status?.nameIdMap));
        if (data.status?.ready) {
          await autoFetchFields(data.status);
        }
      }
    } catch {
      setStatus(null);
    } finally {
      setConfigLoading(false);
    }
  }

  async function loadHealthStatus() {
    setHealthLoading(true);
    try {
      const response = await fetch("/api/health");
      const data = await response.json();
      if (data.ok) {
        setHealthStatus(data.health);
      } else {
        setHealthStatus({
          ok: false,
          label: "飞书连接异常",
          checkedAt: new Date().toISOString(),
          checks: { error: { ok: false, message: data.error || "健康检查失败" } },
        });
      }
    } catch (error) {
      setHealthStatus({
        ok: false,
        label: "飞书连接异常",
        checkedAt: new Date().toISOString(),
        checks: { network: { ok: false, message: error.message } },
      });
    } finally {
      setHealthLoading(false);
    }
  }

  async function autoFetchFields(currentStatus) {
    try {
      const response = await fetch("/api/check-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableKey: targetTable }),
      });
      const data = await response.json();
      if (data.ok && data.fields) {
        setBitableFields(data.fields);
        const existing = invertFieldMap(currentStatus?.fieldMap);
        const merged = {};
        for (const field of data.fields) {
          merged[field] = existing[field] || "";
        }
        setFieldMappings(merged);
      }
    } catch {
      // Initial field loading should not block the page.
    }
  }

  useEffect(() => {
    loadConfig();
    loadHealthStatus();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(loadHealthStatus, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(copiedFieldTimerRef.current);
  }, []);

  function updateConfig(key, value) {
    setConfig((current) => ({ ...current, [key]: value }));
    setSaveState(null);
    setCheckState(null);
  }

  function resetConfigChanges() {
    setConfig(configBaseline);
    setSaveState(null);
    setCheckState(null);
  }

  async function copyConfigValue(key, value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.clearTimeout(copiedFieldTimerRef.current);
      copiedFieldTimerRef.current = window.setTimeout(() => setCopiedField(null), 1200);
    } catch {
      setCopiedField(null);
    }
  }

  function addUploadFiles(files) {
    const incoming = Array.from(files || []);
    if (incoming.length === 0) return;

    const { validFiles, errors } = validateImportFiles(incoming);
    if (errors.length > 0) {
      setUploadState({
        ok: false,
        phase: "validation",
        text: errors.map((error) => `${error.fileName}: ${error.message}`).join("；"),
        errors,
      });
    }
    if (validFiles.length === 0) {
      return;
    }

    setUploadFiles((current) => {
      const existing = new Set(current.map(getImportFileKey));
      return [
        ...current,
        ...validFiles.filter((file) => !existing.has(getImportFileKey(file))),
      ];
    });
    if (errors.length === 0) setUploadState(null);
  }

  function removeUploadFile(fileToRemove) {
    setUploadFiles((current) => current.filter((file) => file !== fileToRemove));
  }

  function clearUploadFiles() {
    setUploadFiles([]);
    setUploadState(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateClaimForm(key, value) {
    if (key === "dismissState") {
      setClaimState(null);
      return;
    }
    setClaimForm((current) => ({ ...current, [key]: value }));
    setClaimState(null);
    setClaimQueryResult(null);
  }

  function parseMaterialCodes(value) {
    return parseMaterialCodeSummary(value).uniqueCodes;
  }

  function removeClaimMaterialCode(index) {
    updateClaimForm("materialCodes", removeMaterialCodeAtIndex(claimForm.materialCodes, index));
  }

  function clearClaimForm() {
    setClaimForm({ materialCodes: "", senderName: "" });
    setClaimState(null);
    setClaimQueryResult(null);
  }

  function requestAdminPassword() {
    const password = window.prompt("请输入管理密码");
    if (password === null) return null;
    return password.trim();
  }

  async function saveConfig(adminPassword = requestAdminPassword()) {
    if (adminPassword === null) return false;
    const dataToSave = {
      ...config,
      fieldMap: buildFieldMap(fieldMappings),
      nameIdMap: buildNameIdMap(nameIdRows),
      adminPassword,
    };
    setSaving(true);
    setSaveState(null);
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setStatus(data.status);
      const savedConfig = { ...emptyConfig, ...data.config, appSecret: "" };
      setConfig(savedConfig);
      setConfigBaseline(savedConfig);
      setNameIdRows(mapToNameIdRows(data.config?.nameIdMap));
      setSaveState({ ok: true, text: "配置已保存" });
      return true;
    } catch (error) {
      setSaveState({ ok: false, text: error.message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function checkConnection() {
    const adminPassword = requestAdminPassword();
    if (adminPassword === null) return;
    setChecking(true);
    setCheckState(null);
    try {
      const saved = await saveConfig(adminPassword);
      if (!saved) return;
      const response = await fetch("/api/check-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableKey: targetTable }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setCheckState({ ok: true, text: `${data.message}，读取到 ${data.fieldCount} 个字段` });
      if (data.fields) {
        setBitableFields(data.fields);
        const existing = invertFieldMap(status?.fieldMap);
        const merged = {};
        for (const field of data.fields) {
          merged[field] = existing[field] || "";
        }
        setFieldMappings(merged);
      }
    } catch (error) {
      setCheckState({ ok: false, text: error.message });
    } finally {
      setChecking(false);
    }
  }

  async function uploadSpreadsheets() {
    if (uploadFiles.length === 0) {
      setUploadState({ ok: false, phase: "select", text: "请先拖入或选择 Excel / CSV 文件" });
      return;
    }
    const { errors } = validateImportFiles(uploadFiles);
    if (errors.length > 0) {
      setUploadState({
        ok: false,
        phase: "validation",
        text: errors.map((error) => `${error.fileName}: ${error.message}`).join("；"),
        errors,
      });
      return;
    }
    setUploading(true);
    setUploadState({ ok: null, phase: "submit", text: "正在提交文件" });
    const results = [];
    try {
      for (let index = 0; index < uploadFiles.length; index += 1) {
        const file = uploadFiles[index];
        setUploadState({
          ok: null,
          phase: "server",
          text: `服务端处理中 ${index + 1}/${uploadFiles.length}：${file.name}`,
          fileName: file.name,
        });
        const response = await fetch(
          `/api/upload-spreadsheet?fileName=${encodeURIComponent(file.name)}&tableKey=${encodeURIComponent(targetTable)}`,
          {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: await file.arrayBuffer(),
          },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          const error = new Error(`${file.name}: ${data.error || response.statusText || "服务端处理失败"}`);
          error.fileName = file.name;
          error.status = response.status;
          error.phase = "server";
          throw error;
        }
        results.push(data);
      }
      setUploadState({
        ok: true,
        phase: "complete",
        text: buildImportSuccessText(results),
        results,
      });
      setUploadFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadState({
        ok: false,
        phase: error.phase || "server",
        text: sanitizeImportError(error),
        fileName: error.fileName,
        status: error.status,
      });
    } finally {
      setUploading(false);
    }
  }

  async function claimDrawing() {
    const materialCodes = parseMaterialCodes(claimForm.materialCodes);
    if (materialCodes.length === 0) {
      setClaimState({ ok: false, operation: "claim", text: "请输入至少一个料号" });
      return;
    }
    setClaiming(true);
    setClaimState(null);
    try {
      const response = await fetch("/api/claim-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialCodes,
          senderName: claimForm.senderName.trim(),
          ...statusDateRange,
          tableKey: targetTable,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        operation: "claim",
        text: `领图成功：${data.materialCodes.join("，")}，共更新 ${data.count} 条记录`,
        data,
      });
    } catch (error) {
      setClaimState({ ok: false, operation: "claim", text: sanitizeAssignmentError(error) });
    } finally {
      setClaiming(false);
    }
  }

  async function completeDrawing() {
    const materialCodes = parseMaterialCodes(claimForm.materialCodes);
    if (materialCodes.length === 0) {
      setClaimState({ ok: false, operation: "complete", text: "请输入至少一个料号" });
      return;
    }
    setCompletingDrawing(true);
    setClaimState(null);
    try {
      const response = await fetch("/api/complete-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialCodes, ...statusDateRange, tableKey: targetTable }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        operation: "complete",
        text: `绘图完成：${data.materialCodes.join("，")}，共更新 ${data.count} 条记录`,
        data,
      });
    } catch (error) {
      setClaimState({ ok: false, operation: "complete", text: sanitizeAssignmentError(error) });
    } finally {
      setCompletingDrawing(false);
    }
  }

  async function queryDrawingClaims() {
    setQueryingClaims(true);
    setClaimState(null);
    setClaimQueryResult(null);
    try {
      const response = await fetch("/api/query-unclaimed-drawings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableKey: targetTable }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        operation: "query",
        text: data.count > 0 ? `查询完成：共 ${data.count} 条图纸未被领取` : "查询完成：没有未领取图纸",
        data,
      });
      setClaimQueryResult(data);
    } catch (error) {
      setClaimState({ ok: false, operation: "query", text: sanitizeAssignmentError(error) });
    } finally {
      setQueryingClaims(false);
    }
  }

  async function syncDrawingStatus({ silent = false } = {}) {
    if (!silent) setStatusState(null);
    setStatusSyncing(true);
    try {
      const response = await fetch("/api/sync-drawing-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...statusDateRange, tableKey: targetTable }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setStatusResult(data);
      setStatusState({
        ok: true,
        text: `检测完成：未领取 ${data.summary.unclaimed} 个，绘图中 ${data.summary.drawing} 个，绘图完成 ${data.summary.done} 个`,
      });
    } catch (error) {
      if (!(silent && String(error.message || "").includes("状态检测正在进行"))) {
        setStatusState({ ok: false, text: error.message });
      }
    } finally {
      setStatusSyncing(false);
    }
  }

  async function loadBackgroundSyncStatus() {
    try {
      const response = await fetch("/api/background-status-sync");
      const data = await response.json();
      if (data.ok) setBackgroundSyncStatus(data.status);
    } catch {
      setBackgroundSyncStatus(null);
    }
  }

  async function loadDrawingOwnerStats({ silent = false } = {}) {
    if (!silent) {
      setOwnerStatsLoading(true);
      setOwnerStatsState(null);
    }
    try {
      const response = await fetch("/api/drawing-owner-stats");
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setOwnerStats(data);
      setOwnerStatsState(null);
    } catch (error) {
      setOwnerStatsState({ ok: false, text: error.message });
    } finally {
      if (!silent) setOwnerStatsLoading(false);
    }
  }

  function formatDisplayTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  const configReady = Boolean(status?.ready);
  const connected = Boolean(checkState?.ok);
  const savingConfig = saving && !checking;

  useEffect(() => {
    if (activeTab !== "status" || !configReady) return undefined;
    syncDrawingStatus({ silent: true });
    loadBackgroundSyncStatus();
    return undefined;
  }, [activeTab, configReady, statusDateRange.startDate, statusDateRange.endDate, targetTable]);

  useEffect(() => {
    if (activeTab !== "status") return undefined;
    loadBackgroundSyncStatus();
    const timer = window.setInterval(loadBackgroundSyncStatus, 3000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "owners" || !configReady) return undefined;
    loadDrawingOwnerStats();
    const timer = window.setInterval(() => loadDrawingOwnerStats({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [activeTab, configReady]);

  return (
    <>
      <LightFallBackground />
      <main className="app-shell">
      <header className="page-header">
        <div className="header-main">
          <div className="app-mark">
            <Bot size={24} />
          </div>
          <div>
            <h1>技术组机器人控制台</h1>
            <p>连接飞书开放平台与多维表，把 Excel、图片附件和领图任务稳定写入目标表格。</p>
          </div>
        </div>
        <div className="header-status">
          <Pill tone={configReady ? "success" : "warning"} icon={ShieldCheck}>
            {configReady ? "配置已加载" : "等待配置"}
          </Pill>
          <Pill tone={healthStatus?.ok ? "success" : "warning"} icon={Activity}>
            {healthLoading && !healthStatus ? "正在检查飞书" : healthStatus?.label || "等待飞书检查"}
          </Pill>
        </div>
      </header>

      <RobotStatusWidget
        activeTab={activeTab}
        configReady={configReady}
        healthStatus={healthStatus}
        statusResult={statusResult}
        ownerStats={ownerStats}
      />

      <ProgressBar active={configLoading} label="正在刷新配置" />

      <nav className="tab-bar" aria-label="功能菜单">
        <button
          className={`tab-button ${activeTab === "connection" ? "active" : ""}`}
          onClick={() => setActiveTab("connection")}
        >
          <Settings2 size={18} />
          连接配置
        </button>
        <button
          className={`tab-button ${activeTab === "mapping" ? "active" : ""}`}
          onClick={() => setActiveTab("mapping")}
        >
          <Database size={18} />
          字段映射
          <span>{bitableFields.length}</span>
        </button>
        <button
          className={`tab-button ${activeTab === "commands" ? "active" : ""}`}
          onClick={() => setActiveTab("commands")}
        >
          <MessageSquareText size={18} />
          飞书口令
        </button>
        <button
          className={`tab-button ${activeTab === "people" ? "active" : ""}`}
          onClick={() => setActiveTab("people")}
        >
          <UsersRound size={18} />
          人员映射
        </button>
        <button
          className={`tab-button ${activeTab === "status" ? "active" : ""}`}
          onClick={() => setActiveTab("status")}
        >
          <Activity size={18} />
          状态检测
        </button>
        <button
          className={`tab-button ${activeTab === "owners" ? "active" : ""}`}
          onClick={() => setActiveTab("owners")}
        >
          <UsersRound size={18} />
          绘图人动态
        </button>
        <button
          className={`tab-button ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          <FileUp size={18} />
          新增
        </button>
        <button
          className={`tab-button ${activeTab === "drawing" ? "active" : ""}`}
          onClick={() => setActiveTab("drawing")}
        >
          <Images size={18} />
          领图
        </button>
      </nav>

      {activeTab === "connection" && (
        <React.Suspense
          fallback={
            <section className="connection-loading-shell card">
              <span />
              <span />
              <span />
            </section>
          }
        >
          <ConnectionManagementCenter
            configReady={configReady}
            healthStatus={healthStatus}
            healthLoading={healthLoading}
            bitableFields={bitableFields}
            targetTable={targetTable}
            setTargetTable={setTargetTable}
            TableSelector={TableSelector}
            config={config}
            configBaseline={configBaseline}
            updateConfig={updateConfig}
            resetConfig={resetConfigChanges}
            copyConfigValue={copyConfigValue}
            copiedField={copiedField}
            checkState={checkState}
            saveState={saveState}
            saving={saving}
            savingConfig={savingConfig}
            checking={checking}
            saveConfig={saveConfig}
            checkConnection={checkConnection}
            formatDisplayTime={formatDisplayTime}
          />
        </React.Suspense>
      )}

      {false && activeTab === "connection" && (
        <section className="tab-panel">
          <section className="card connection-card">
            <div className="section-head">
              <div>
                <h2>飞书连接配置</h2>
                <p>保存到本地环境配置，密钥不会在页面上明文展示。</p>
              </div>
              <Pill tone={connected || configReady ? "success" : "warning"} icon={CheckCircle2}>
                {connected ? "连接成功" : configReady ? "已保存" : "未连接"}
              </Pill>
            </div>

            <div className="target-table-row">
              <span>当前测试表</span>
              <TableSelector value={targetTable} onChange={setTargetTable} />
            </div>

            {healthStatus && (
              <div className="health-grid" aria-label="飞书连接健康检查">
                {Object.entries(healthStatus.checks || {}).map(([key, item]) => (
                  <div className={`health-item ${item.ok ? "ok" : "error"}`} key={key}>
                    <span>{item.ok ? "正常" : "异常"}</span>
                    <strong>{item.message}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="form-grid">
              <FieldRow label="App ID" hint="飞书应用凭证">
                <input
                  placeholder="请输入 App ID"
                  value={config.appId}
                  onChange={(event) => updateConfig("appId", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="App Secret" hint="留空则不修改已保存密钥">
                <input
                  type="password"
                  placeholder={config.appSecretSet ? "已保存 ******" : "请输入 App Secret"}
                  value={config.appSecret}
                  onChange={(event) => updateConfig("appSecret", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="多维表 App Token" hint="目标多维表 token">
                <input
                  placeholder="请输入多维表 App Token"
                  value={config.bitableAppToken}
                  onChange={(event) => updateConfig("bitableAppToken", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="Table ID" hint="目标数据表 ID">
                <input
                  placeholder="请输入 Table ID"
                  value={config.bitableTableId}
                  onChange={(event) => updateConfig("bitableTableId", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="油漆 App Token" hint="油漆多维表 token">
                <input
                  placeholder="请输入油漆多维表 App Token"
                  value={config.paintBitableAppToken}
                  onChange={(event) => updateConfig("paintBitableAppToken", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="油漆 Table ID" hint="油漆数据表 ID">
                <input
                  placeholder="请输入油漆 Table ID"
                  value={config.paintBitableTableId}
                  onChange={(event) => updateConfig("paintBitableTableId", event.target.value)}
                />
              </FieldRow>
            </div>

            <ProgressBar active={savingConfig} label="正在保存配置" />
            <ProgressBar active={checking} label="正在测试连接并读取字段" />

            <div className="connection-actions">
              {(checkState || saveState) && (
                <div className={`inline-result ${(checkState || saveState).ok ? "ok" : "error"}`}>
                  {(checkState || saveState).text}
                </div>
              )}
              <div className="action-buttons">
                <button className="button secondary" onClick={() => saveConfig()} disabled={saving}>
                  <Save size={18} />
                  {saving ? "保存中" : "保存配置"}
                </button>
                <button className="button primary" onClick={checkConnection} disabled={checking}>
                  <KeyRound size={18} />
                  {checking ? "检查中" : "测试连接"}
                </button>
              </div>
            </div>
          </section>

          <aside className="workflow-card">
            <h2>机器人使用方式</h2>
            <div className="workflow-list">
              <span>
                <FileSpreadsheet size={18} />
                @机器人 胶板新增 / 油漆新增
              </span>
              <span>
                <Link2 size={18} />
                上传 Excel
              </span>
              <span>
                <CheckCircle2 size={18} />
                @机器人 完成
              </span>
              <span>
                <Images size={18} />
                @机器人 料号 领图
              </span>
            </div>
          </aside>
        </section>
      )}

      {activeTab === "mapping" && (
        <React.Suspense
          fallback={
            <section className="mapping-loading-state card">
              <span />
              <span />
              <span />
            </section>
          }
        >
          <MappingStudio
            bitableFields={bitableFields}
            fieldMappings={fieldMappings}
            backendFieldMap={status?.fieldMap || {}}
            onFieldMappingsChange={setFieldMappings}
            onSave={saveConfig}
            onLoadFields={checkConnection}
            saving={saving}
            loading={checking || configLoading}
            configReady={configReady}
            saveState={saveState}
            checkState={checkState}
          />
        </React.Suspense>
      )}

      {activeTab === "people" && (
        <React.Suspense fallback={<div className="glass-skeleton people-skeleton" />}>
          <PeopleMappingCenter
            rows={nameIdRows}
            baselineRows={mapToNameIdRows(configBaseline.nameIdMap)}
            loading={configLoading}
            saving={saving}
            saveState={saveState}
            onRowsChange={(updater) => {
              setNameIdRows(updater);
              setSaveState(null);
            }}
            onSave={() => saveConfig()}
            onReset={() => {
              setNameIdRows(mapToNameIdRows(configBaseline.nameIdMap));
              setSaveState(null);
            }}
          />
        </React.Suspense>
      )}

      {activeTab === "upload" && (
        <React.Suspense fallback={<div className="glass-skeleton import-skeleton" />}>
          <DataImportCenter
            files={uploadFiles}
            dragging={draggingUpload}
            uploading={uploading}
            uploadState={uploadState}
            targetTable={targetTable}
            setTargetTable={setTargetTable}
            tableSelector={<TableSelector value={targetTable} onChange={setTargetTable} />}
            configReady={configReady}
            fileInputRef={fileInputRef}
            onDragStateChange={setDraggingUpload}
            onFilesSelected={addUploadFiles}
            onRemoveFile={removeUploadFile}
            onClearFiles={clearUploadFiles}
            onSubmit={uploadSpreadsheets}
            onDismissError={() => setUploadState(null)}
          />
        </React.Suspense>
      )}

      {activeTab === "status" && (
        <React.Suspense
          fallback={
            <section className="monitoring-loading-shell card">
              <span />
              <span />
              <span />
            </section>
          }
        >
          <MonitoringCenter
            configReady={configReady}
            targetTable={targetTable}
            setTargetTable={setTargetTable}
            statusDateRange={statusDateRange}
            setStatusDateRange={setStatusDateRange}
            statusSyncing={statusSyncing}
            backgroundSyncStatus={backgroundSyncStatus}
            statusResult={statusResult}
            statusState={statusState}
            syncDrawingStatus={syncDrawingStatus}
            formatDisplayTime={formatDisplayTime}
          />
        </React.Suspense>
      )}

      {false && activeTab === "status" && (
        <section className="card mapping-section status-section">
            <div className="section-head mapping-head">
              <div>
                <h2>图纸状态检测</h2>
                <p>按日期范围检测“绘图人”和“状态”列，实时同步表格状态，并统计当前图纸进度。</p>
              </div>
            <Pill tone={configReady ? "success" : "warning"} icon={Activity}>
                {configReady ? "自动检测中" : "需先配置"}
              </Pill>
            </div>

          <div className="target-table-row">
            <span>查询表</span>
            <TableSelector value={targetTable} onChange={setTargetTable} />
          </div>

          <div className="status-filter-bar">
            <FieldRow label="开始日期" hint="默认前天">
              <input
                type="date"
                value={statusDateRange.startDate}
                onChange={(event) =>
                  setStatusDateRange((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </FieldRow>
            <FieldRow label="结束日期" hint="默认今天">
              <input
                type="date"
                value={statusDateRange.endDate}
                onChange={(event) =>
                  setStatusDateRange((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </FieldRow>
          </div>

          <ProgressBar active={statusSyncing} label="正在检测并同步图纸状态" />

          <div className={`background-sync-card ${backgroundSyncStatus?.running ? "running" : ""}`}>
            <div>
              <strong>{backgroundSyncStatus?.running ? "后台正在检测" : "后台自动检测已开启"}</strong>
              <span>
                每 {Math.round((backgroundSyncStatus?.intervalMs || 10000) / 1000)} 秒检查表格变化，有变化才自动检测
              </span>
            </div>
            <div className="background-sync-meta">
              <span>上次检查：{formatDisplayTime(backgroundSyncStatus?.lastCheckedAt)}</span>
              <span>上次变动：{formatDisplayTime(backgroundSyncStatus?.lastChangedAt)}</span>
              <span>上次开始：{formatDisplayTime(backgroundSyncStatus?.lastStartedAt)}</span>
              <span>上次完成：{formatDisplayTime(backgroundSyncStatus?.lastFinishedAt)}</span>
              {backgroundSyncStatus?.lastSummary && (
                <span>
                  最近结果：未领取 {backgroundSyncStatus.lastSummary.unclaimed}，绘图中{" "}
                  {backgroundSyncStatus.lastSummary.drawing}，完成 {backgroundSyncStatus.lastSummary.done}
                </span>
              )}
              {backgroundSyncStatus?.lastError && <span>最近错误：{backgroundSyncStatus.lastError}</span>}
            </div>
          </div>

          {statusResult && (
            <div className="status-summary-grid">
              <div className="status-summary-card unclaimed">
                <span>未领取</span>
                <strong>{statusResult.summary.unclaimed}</strong>
              </div>
              <div className="status-summary-card drawing">
                <span>绘图中</span>
                <strong>{statusResult.summary.drawing}</strong>
              </div>
              <div className="status-summary-card done">
                <span>绘图完成</span>
                <strong>{statusResult.summary.done}</strong>
              </div>
              <div className="status-summary-card neutral">
                <span>检测总数</span>
                <strong>{statusResult.summary.total}</strong>
              </div>
            </div>
          )}

          <div className="connection-actions">
            {statusState && (
              <div className={`inline-result ${statusState.ok ? "ok" : "error"}`}>
                {statusState.text}
              </div>
            )}
            <div className="action-buttons">
              <button
                className="button primary"
                onClick={() => syncDrawingStatus()}
                disabled={statusSyncing || !configReady}
              >
                <RefreshCw size={18} />
                {statusSyncing ? "检测中" : "立即检测"}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === "owners" && (
        <React.Suspense fallback={<div className="glass-skeleton drawing-skeleton" />}>
          <DrawingOperationsCenter
            ownerStats={ownerStats}
            loading={ownerStatsLoading}
            errorState={ownerStatsState}
            configReady={configReady}
            onRefresh={() => loadDrawingOwnerStats()}
            formatTime={formatDisplayTime}
          />
        </React.Suspense>
      )}

      {activeTab === "drawing" && (
        <React.Suspense fallback={<div className="glass-skeleton assignment-skeleton" />}>
          <DrawingAssignmentCenter
            claimForm={claimForm}
            nameIdRows={nameIdRows}
            claimState={claimState}
            claimQueryResult={claimQueryResult}
            claiming={claiming}
            completingDrawing={completingDrawing}
            queryingClaims={queryingClaims}
            configReady={configReady}
            updateClaimForm={updateClaimForm}
            removeMaterialCode={removeClaimMaterialCode}
            clearClaimForm={clearClaimForm}
            claimDrawing={claimDrawing}
            completeDrawing={completeDrawing}
            queryDrawingClaims={queryDrawingClaims}
          />
        </React.Suspense>
      )}

      {activeTab === "commands" && (
        <React.Suspense fallback={<div className="glass-skeleton command-skeleton" />}>
          <CommandCenter commands={feishuCommands} />
        </React.Suspense>
      )}

      <button className="refresh-fab" onClick={loadConfig} aria-label="刷新配置" title="刷新配置">
        <RefreshCw size={18} />
      </button>
      </main>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
