import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  FileUp,
  House,
  Images,
  LogIn,
  LogOut,
  MessageSquareText,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Timer,
  UsersRound,
} from "lucide-react";
import { LightFallBackground } from "./components/design-system";
import {
  AnimatedNumber,
  PageTransition,
} from "./components/motion";
import { ErrorBoundary } from "./components/system/ErrorBoundary.jsx";
import { AdminAccessGate } from "./components/system/AdminAccessGate.jsx";
import { getImportFileKey, validateImportFiles } from "./utils/importFileUtils";
import { aggregateImportResults, buildImportSuccessText, sanitizeImportError } from "./utils/importResultUtils";
import { parseMaterialCodes as parseMaterialCodeSummary, removeMaterialCodeAtIndex } from "./utils/materialCodeUtils";
import { sanitizeAssignmentError } from "./utils/assignmentResultUtils";
import "./styles.css";
import "./styles/cockpit.css";
import "./styles/saas-light.css";
import "./styles/analytics.css";
import "./styles/home-dashboard.css";
import "./styles/admin-access.css";

const MappingStudio = React.lazy(() => import("./components/field-mapping/MappingStudio.jsx"));
const MonitoringCenter = React.lazy(() => import("./components/monitoring/MonitoringCenter.jsx"));
const ConnectionManagementCenter = React.lazy(() => import("./components/connection/ConnectionManagementCenter.jsx"));
const CommandCenter = React.lazy(() => import("./components/commands/CommandCenter.jsx"));
const PeopleMappingCenter = React.lazy(() => import("./components/people/PeopleMappingCenter.jsx"));
const DrawingOperationsCenter = React.lazy(() => import("./components/drawing/DrawingOperationsCenter.jsx"));
const DataImportCenter = React.lazy(() => import("./components/import-write/DataImportCenter.jsx"));
const DrawingAssignmentCenter = React.lazy(() => import("./components/assignment/DrawingAssignmentCenter.jsx"));
const DataAnalyticsCenter = React.lazy(() => import("./components/analytics/DataAnalyticsCenter.jsx"));
const HomeDashboard = React.lazy(() => import("./components/home/HomeDashboard.jsx"));

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

const tabRoutes = {
  home: "/home",
  connection: "/connection",
  mapping: "/mapping",
  commands: "/commands",
  people: "/people",
  status: "/status",
  owners: "/owners",
  analytics: "/analytics",
  upload: "/upload",
  drawing: "/drawing",
};

const adminOnlyTabs = new Set(["connection", "people"]);
const adminTabLabels = { connection: "连接配置", people: "人员映射" };

function tabFromPath(pathname = window.location.pathname) {
  const entry = Object.entries(tabRoutes).find(([, path]) => path === pathname);
  return entry?.[0] || "home";
}

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

function RobotStatusWidget({ activeTab, configReady, healthStatus, statusResult, ownerStats, uploadState, uploadFiles }) {
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
        <div className="status-overview-item">
          <span className="status-overview-icon"><FileSpreadsheet size={19} /></span>
          <span className="status-overview-copy"><small>待导入文件</small><AnimatedNumber value={queuedFiles} /><span>当前选择</span></span>
        </div>
        <div className="status-overview-item">
          <span className="status-overview-icon"><CheckCircle2 size={19} /></span>
          <span className="status-overview-copy"><small>成功写入</small><AnimatedNumber value={importSummary.resultCount} /><span>本次会话</span></span>
        </div>
        <div className="status-overview-item">
          <span className="status-overview-icon"><Activity size={19} /></span>
          <span className="status-overview-copy"><small>失败任务</small><AnimatedNumber value={failedTasks} /><span>本次会话</span></span>
        </div>
        <div className="status-overview-item">
          <span className="status-overview-icon"><Database size={19} /></span>
          <span className="status-overview-copy"><small>处理数据量</small><AnimatedNumber value={processedRows} /><span>解析记录</span></span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="robot-status-widget status-overview" aria-label="机器人状态">
      <div className="status-overview-item detection">
        <span className="status-overview-icon"><Activity size={19} /></span>
        <span className="status-overview-copy">
          <small>检测状态</small>
          <strong>{statusLabel}</strong>
          <span title={statusDetail}>{statusDetail}</span>
        </span>
      </div>
      <div className="status-overview-item">
        <span className="status-overview-icon"><Timer size={19} /></span>
        <span className="status-overview-copy">
          <small>运行时间</small>
          <strong>当前接口未提供</strong>
          <span>等待接口数据</span>
        </span>
      </div>
      <div className="status-overview-item">
        <span className="status-overview-icon"><ClipboardCheck size={19} /></span>
        <span className="status-overview-copy">
          <small>{completedLabel}</small>
          {typeof completed === "number" ? <AnimatedNumber value={completed} /> : <strong>暂无数据</strong>}
          <span>{completedDetail}</span>
        </span>
      </div>
      <div className="status-overview-item">
        <span className="status-overview-icon"><CheckCircle2 size={19} /></span>
        <span className="status-overview-copy">
          <small>完成率</small>
          {typeof completionRate === "number" ? (
            <AnimatedNumber value={completionRate} decimals={1} suffix="%" />
          ) : (
            <strong>暂无数据</strong>
          )}
          <span>按已检测任务计算</span>
        </span>
      </div>
    </aside>
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
    result: "自动在胶板/油漆表匹配料号，状态改为绘图完成，并将用时记录为分钟数。",
  },
  {
    title: "查询未领取",
    command: "@机器人 查询未领取 / 胶板查询未领取 / 油漆查询未领取",
    example: "@机器人 油漆查询未领取",
    result: "默认分别返回胶板、油漆及合计数量；带胶板或油漆时只查询对应表。",
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

const statusTableKeys = ["board", "paint"];

function buildStatusCacheKey(tableKey, range) {
  return `${tableKey}:${range.startDate || ""}:${range.endDate || ""}`;
}

function combineStatusResults(resultsByKey, range) {
  const tableResults = statusTableKeys.map((tableKey) => resultsByKey[buildStatusCacheKey(tableKey, range)]);
  if (tableResults.some((result) => !result?.summary)) return null;

  const summary = tableResults.reduce(
    (combined, result) => ({
      total: combined.total + Number(result.summary.total || 0),
      unclaimed: combined.unclaimed + Number(result.summary.unclaimed || 0),
      drawing: combined.drawing + Number(result.summary.drawing || 0),
      done: combined.done + Number(result.summary.done || 0),
      updated: combined.updated + Number(result.summary.updated || 0),
    }),
    { total: 0, unclaimed: 0, drawing: 0, done: 0, updated: 0 },
  );
  const items = tableResults.flatMap((result, index) => {
    const tableKey = result.table || statusTableKeys[index];
    return (result.items || []).map((item) => ({ ...item, table: tableKey, cacheId: `${tableKey}:${item.recordId}` }));
  });
  return { table: "all", tables: statusTableKeys, summary, items };
}

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
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = tabFromPath();
    return adminOnlyTabs.has(requestedTab) ? "home" : requestedTab;
  });
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminSessionLoading, setAdminSessionLoading] = useState(true);
  const [adminTarget, setAdminTarget] = useState(() => {
    const requestedTab = tabFromPath();
    return adminOnlyTabs.has(requestedTab) ? requestedTab : null;
  });
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
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
  const [statusActionRunning, setStatusActionRunning] = useState(false);
  const [statusState, setStatusState] = useState(null);
  const [statusResultsByKey, setStatusResultsByKey] = useState({});
  const statusResultsRef = useRef({});
  const statusRequestsRef = useRef(new Map());
  const [statusPendingKeys, setStatusPendingKeys] = useState({});
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

  function navigateTab(tab, { replace = false, bypassAdmin = false } = {}) {
    const path = tabRoutes[tab] || tabRoutes.home;
    if (adminOnlyTabs.has(tab) && !adminAuthenticated && !bypassAdmin) {
      window.history[replace ? "replaceState" : "pushState"]({ tab }, "", path);
      setAdminTarget(tab);
      setAdminError("");
      setMobileNavigationOpen(false);
      return;
    }
    window.history[replace ? "replaceState" : "pushState"]({ tab }, "", path);
    setActiveTab(tab);
    setAdminTarget(null);
    setMobileNavigationOpen(false);
  }
  const activeStatusCacheKey = buildStatusCacheKey(targetTable, statusDateRange);
  const statusResult = statusResultsByKey[activeStatusCacheKey] || null;
  const aggregateStatusResult = combineStatusResults(statusResultsByKey, statusDateRange);
  const statusSyncing =
    statusActionRunning ||
    statusTableKeys.some((tableKey) => statusPendingKeys[buildStatusCacheKey(tableKey, statusDateRange)]);

  function storeStatusResult(cacheKey, result) {
    statusResultsRef.current = { ...statusResultsRef.current, [cacheKey]: result };
    setStatusResultsByKey(statusResultsRef.current);
  }

  async function loadConfig({ adminAccess = adminAuthenticated } = {}) {
    setConfigLoading(true);
    try {
      const response = await fetch("/api/config");
      const data = await response.json();
      if (data.ok) {
        setStatus(data.status);
        const loadedConfig = { ...emptyConfig, ...data.config, appSecret: "" };
        setConfig(loadedConfig);
        setConfigBaseline(loadedConfig);
        const loadedNameIdMap = Object.keys(data.config?.nameIdMap || {}).length > 0
          ? data.config.nameIdMap
          : data.status?.nameIdMap;
        setNameIdRows(mapToNameIdRows(loadedNameIdMap));
        if (data.status?.ready && adminAccess) {
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

  async function submitAdminAccess(password) {
    setAdminSubmitting(true);
    setAdminError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok || !result.authenticated) {
        throw new Error(result.error || "管理员验证失败");
      }
      const target = adminTarget || "home";
      setAdminAuthenticated(true);
      setAdminTarget(null);
      navigateTab(target, { replace: true, bypassAdmin: true });
      await loadConfig({ adminAccess: true });
    } catch (error) {
      setAdminError(error.message || "管理员验证失败");
    } finally {
      setAdminSubmitting(false);
    }
  }

  function cancelAdminAccess() {
    setAdminTarget(null);
    setAdminError("");
    navigateTab("home", { replace: true, bypassAdmin: true });
  }

  async function logoutAdminAccess() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      setAdminAuthenticated(false);
      setAdminTarget(null);
      setAdminError("");
      setConfig(emptyConfig);
      setConfigBaseline(emptyConfig);
      setBitableFields([]);
      setFieldMappings({});
      if (adminOnlyTabs.has(activeTab)) {
        navigateTab("home", { replace: true, bypassAdmin: true });
      }
      await loadConfig({ adminAccess: false });
    }
  }

  useEffect(() => {
    loadConfig();
    loadHealthStatus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restoreAdminSession() {
      try {
        const response = await fetch("/api/admin/session");
        const result = await response.json();
        if (cancelled) return;
        const authenticated = Boolean(response.ok && result.authenticated);
        setAdminAuthenticated(authenticated);
        if (authenticated) {
          const requestedTab = adminTarget || tabFromPath();
          if (adminOnlyTabs.has(requestedTab)) {
            navigateTab(requestedTab, { replace: true, bypassAdmin: true });
          }
          await loadConfig({ adminAccess: true });
        }
      } catch {
        if (!cancelled) setAdminAuthenticated(false);
      } finally {
        if (!cancelled) setAdminSessionLoading(false);
      }
    }
    restoreAdminSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/") navigateTab("home", { replace: true, bypassAdmin: true });
    const handlePopState = () => {
      const requestedTab = tabFromPath();
      if (adminOnlyTabs.has(requestedTab) && !adminAuthenticated) {
        setActiveTab("home");
        setAdminTarget(requestedTab);
        setAdminError("");
        return;
      }
      setActiveTab(requestedTab);
      setAdminTarget(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [adminAuthenticated]);

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

  async function fetchTableStatus(tableKey, range, { force = false } = {}) {
    const cacheKey = buildStatusCacheKey(tableKey, range);
    if (!force && statusResultsRef.current[cacheKey]) return statusResultsRef.current[cacheKey];
    if (statusRequestsRef.current.has(cacheKey)) return statusRequestsRef.current.get(cacheKey);

    setStatusPendingKeys((current) => ({ ...current, [cacheKey]: true }));
    const request = (async () => {
      const response = await fetch("/api/sync-drawing-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...range, tableKey }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      const result = {
        ...data,
        source: "direct",
        refreshedAt: new Date().toISOString(),
      };
      storeStatusResult(cacheKey, result);
      return result;
    })();

    statusRequestsRef.current.set(cacheKey, request);
    try {
      return await request;
    } finally {
      statusRequestsRef.current.delete(cacheKey);
      setStatusPendingKeys((current) => {
        const next = { ...current };
        delete next[cacheKey];
        return next;
      });
    }
  }

  async function syncDrawingStatus({ silent = false, force = true } = {}) {
    const range = { ...statusDateRange };
    if (!silent) {
      setStatusState(null);
      setStatusActionRunning(true);
    }
    try {
      await Promise.all(statusTableKeys.map((tableKey) => fetchTableStatus(tableKey, range, { force })));
      const combined = combineStatusResults(statusResultsRef.current, range);
      if (combined?.summary) {
        setStatusState({
          ok: true,
          text: `两表检测完成：未领取 ${combined.summary.unclaimed} 个，绘图中 ${combined.summary.drawing} 个，绘图完成 ${combined.summary.done} 个`,
        });
      }
      return combined;
    } catch (error) {
      if (!(silent && String(error.message || "").includes("状态检测正在进行"))) {
        setStatusState({ ok: false, text: error.message });
      }
      return null;
    } finally {
      if (!silent) setStatusActionRunning(false);
    }
  }


  async function recalculateDrawingDurations() {
    setStatusState(null);
    setStatusActionRunning(true);
    try {
      const response = await fetch("/api/recalculate-drawing-durations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...statusDateRange, tableKey: targetTable }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setStatusState({
        ok: true,
        text: `用时重算完成：检查 ${data.summary.scanned} 条，可计算 ${data.summary.eligible} 条，更新 ${data.summary.updated} 条，缺少时间 ${data.summary.missingTime} 条`,
      });
      await fetchTableStatus(targetTable, { ...statusDateRange }, { force: true });
    } catch (error) {
      setStatusState({ ok: false, text: error.message });
    } finally {
      setStatusActionRunning(false);
    }
  }

  async function loadBackgroundSyncStatus() {
    try {
      const response = await fetch("/api/background-status-sync");
      const data = await response.json();
      if (data.ok) {
        setBackgroundSyncStatus(data.status);
        const cachedResults = {};
        for (const [tableKey, tableStatus] of Object.entries(data.status?.tables || {})) {
          if (!tableStatus?.lastSummary || !tableStatus?.range) continue;
          const cacheKey = buildStatusCacheKey(tableKey, tableStatus.range);
          const existing = statusResultsRef.current[cacheKey];
          const refreshedAt = tableStatus.lastFinishedAt || tableStatus.lastCheckedAt || "";
          if (existing?.refreshedAt && refreshedAt && Date.parse(existing.refreshedAt) >= Date.parse(refreshedAt)) {
            continue;
          }
          cachedResults[cacheKey] = {
            table: tableKey,
            summary: tableStatus.lastSummary,
            items: existing?.items || [],
            source: "background",
            refreshedAt,
          };
        }
        if (Object.keys(cachedResults).length > 0) {
          const nextResults = { ...statusResultsRef.current, ...cachedResults };
          statusResultsRef.current = nextResults;
          setStatusResultsByKey(nextResults);
        }
      }
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
    syncDrawingStatus({ silent: true, force: false });
    return undefined;
  }, [activeTab, configReady, statusDateRange.startDate, statusDateRange.endDate]);

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
      <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileNavigationOpen ? "mobile-nav-open" : ""} ${activeTab === "home" ? "home-active" : ""}`}>
      <aside className="app-sidebar" aria-label="主导航">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" aria-hidden="true"><Bot size={30} /></span>
          <span className="sidebar-brand-copy">
            <strong>技术组机器人</strong>
            <small>自动化控制台</small>
          </span>
        </div>

        <nav className="tab-bar" aria-label="功能菜单">
          <button
            className={`tab-button ${activeTab === "home" ? "active" : ""}`}
            onClick={() => navigateTab("home")}
            title="首页"
          >
            <House size={20} />
            <span className="tab-label">首页</span>
          </button>
          {adminAuthenticated && (
            <button
              className={`tab-button ${activeTab === "connection" ? "active" : ""}`}
              onClick={() => navigateTab("connection")}
              title="连接配置"
            >
              <Settings2 size={20} />
              <span className="tab-label">连接配置</span>
            </button>
          )}
          <button
            className={`tab-button ${activeTab === "mapping" ? "active" : ""}`}
            onClick={() => navigateTab("mapping")}
            title="字段映射"
          >
            <Database size={20} />
            <span className="tab-label">字段映射</span>
            {bitableFields.length > 0 && <span className="tab-count">{bitableFields.length}</span>}
          </button>
          <button
            className={`tab-button ${activeTab === "commands" ? "active" : ""}`}
            onClick={() => navigateTab("commands")}
            title="飞书口令"
          >
            <MessageSquareText size={20} />
            <span className="tab-label">飞书口令</span>
          </button>
          {adminAuthenticated && (
            <button
              className={`tab-button ${activeTab === "people" ? "active" : ""}`}
              onClick={() => navigateTab("people")}
              title="人员映射"
            >
              <UsersRound size={20} />
              <span className="tab-label">人员映射</span>
            </button>
          )}
          <button
            className={`tab-button ${activeTab === "status" ? "active" : ""}`}
            onClick={() => navigateTab("status")}
            title="状态检测"
          >
            <Activity size={20} />
            <span className="tab-label">状态检测</span>
          </button>
          <button
            className={`tab-button ${activeTab === "owners" ? "active" : ""}`}
            onClick={() => navigateTab("owners")}
            title="绘图人动态"
          >
            <UsersRound size={20} />
            <span className="tab-label">绘图人动态</span>
          </button>
          <button
            className={`tab-button ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => navigateTab("analytics")}
            title="数据看板"
          >
            <ChartNoAxesCombined size={20} />
            <span className="tab-label">数据看板</span>
          </button>
          <button
            className={`tab-button ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => navigateTab("upload")}
            title="新增"
          >
            <FileUp size={20} />
            <span className="tab-label">新增</span>
          </button>
          <button
            className={`tab-button ${activeTab === "drawing" ? "active" : ""}`}
            onClick={() => navigateTab("drawing")}
            title="领图"
          >
            <Images size={20} />
            <span className="tab-label">领图</span>
          </button>
        </nav>

        <div className="sidebar-system-card" aria-label="机器人系统状态">
          <span className="sidebar-system-icon"><Bot size={17} /></span>
          <span className="sidebar-system-copy">
            <strong>{configReady ? "机器人已就绪" : "等待配置"}</strong>
            <small>控制台 v0.1.0</small>
          </span>
          <span className={`sidebar-system-dot ${configReady ? "online" : "standby"}`} />
        </div>

        {!adminSessionLoading && !adminAuthenticated && (
          <button
            className="admin-login-button"
            type="button"
            onClick={() => navigateTab("connection")}
            title="管理员登录"
          >
            <LogIn size={16} />
            <span>管理员登录</span>
          </button>
        )}

        {adminAuthenticated && (
          <button className="admin-logout-button" type="button" onClick={logoutAdminAccess} title="退出管理模式">
            <LogOut size={16} />
            <span>退出管理模式</span>
          </button>
        )}

        <button
          className="sidebar-collapse-button"
          type="button"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={sidebarCollapsed ? "展开菜单" : "收起菜单"}
          title={sidebarCollapsed ? "展开菜单" : "收起菜单"}
        >
          <ChevronLeft size={18} />
          <span>{sidebarCollapsed ? "展开菜单" : "收起菜单"}</span>
        </button>
      </aside>

      <button
        className="mobile-navigation-backdrop"
        type="button"
        aria-label="关闭导航"
        onClick={() => setMobileNavigationOpen(false)}
      />

      <div className="app-main">
      <main className="app-shell">
      <div className="global-status-row">
        <button
          className="mobile-menu-button"
          type="button"
          onClick={() => setMobileNavigationOpen(true)}
          aria-label="打开导航"
        >
          <Menu size={20} />
        </button>
        <div className="header-status">
          <Pill tone={configReady ? "success" : "warning"} icon={ShieldCheck}>
            {configReady ? "配置已加载" : "等待配置"}
          </Pill>
          <Pill tone={healthStatus?.ok ? "success" : "warning"} icon={Activity}>
            {healthLoading && !healthStatus ? "正在检查飞书" : healthStatus?.label || "等待飞书检查"}
          </Pill>
        </div>
      </div>

      <RobotStatusWidget
        activeTab={activeTab}
        configReady={configReady}
        healthStatus={healthStatus}
        statusResult={aggregateStatusResult}
        ownerStats={ownerStats}
        uploadState={uploadState}
        uploadFiles={uploadFiles}
      />

      <ProgressBar active={configLoading} label="正在刷新配置" />

      {activeTab === "home" && (
        <React.Suspense fallback={<div className="home-dashboard-loading" aria-label="首页数据大屏加载中" />}>
          <HomeDashboard />
        </React.Suspense>
      )}

      {activeTab === "connection" && adminAuthenticated && (
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

      {activeTab === "people" && adminAuthenticated && (
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
            recalculateDrawingDurations={recalculateDrawingDurations}
            formatDisplayTime={formatDisplayTime}
          />
        </React.Suspense>
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

      {activeTab === "analytics" && (
        <React.Suspense fallback={<div className="analytics-loading-shell" aria-label="数据看板加载中" />}>
          <DataAnalyticsCenter
            configReady={configReady}
            targetTable={targetTable}
            setTargetTable={setTargetTable}
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
          <CommandCenter commands={feishuCommands} onRefresh={loadConfig} />
        </React.Suspense>
      )}

      {!(["home", "commands", "status", "analytics"].includes(activeTab)) && (
        <button className="refresh-fab" onClick={loadConfig} aria-label="刷新配置" title="刷新配置">
          <RefreshCw size={18} />
        </button>
      )}
      </main>
      </div>
      </div>
      <AdminAccessGate
        open={!adminSessionLoading && Boolean(adminTarget) && !adminAuthenticated}
        targetLabel={adminTabLabels[adminTarget] || "受限页面"}
        loading={adminSubmitting}
        error={adminError}
        onSubmit={submitAdminAccess}
        onCancel={cancelAdminAccess}
      />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
