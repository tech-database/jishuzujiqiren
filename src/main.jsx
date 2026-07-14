import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Database,
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
  Settings2,
  ShieldCheck,
  UploadCloud,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import "./styles.css";

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

function mapToNameIdRows(nameIdMap) {
  const rows = Object.entries(nameIdMap || {}).map(([id, name]) => ({ id, name }));
  return rows.length > 0 ? rows : [{ id: "", name: "" }];
}

function buildNameIdMap(rows) {
  const result = {};
  for (const row of rows) {
    const id = row.id.trim();
    const name = row.name.trim();
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
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: "" });
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
        setConfig({ ...emptyConfig, ...data.config, appSecret: "" });
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

  function updateConfig(key, value) {
    setConfig((current) => ({ ...current, [key]: value }));
    setSaveState(null);
    setCheckState(null);
  }

  function updateFieldMapping(bitableField, exportTitle) {
    setFieldMappings((current) => ({ ...current, [bitableField]: exportTitle }));
  }

  function updateNameIdRow(index, key, value) {
    setNameIdRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
    setSaveState(null);
  }

  function addNameIdRow() {
    setNameIdRows((current) => [...current, { id: "", name: "" }]);
    setSaveState(null);
  }

  function removeNameIdRow(index) {
    setNameIdRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [{ id: "", name: "" }];
    });
    setSaveState(null);
  }

  function formatBytes(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function addUploadFiles(files) {
    const accepted = Array.from(files || []).filter((file) => /\.(xlsx|xls|csv)$/i.test(file.name));
    if (accepted.length === 0) {
      setUploadState({ ok: false, text: "请上传 xlsx、xls 或 csv 文件" });
      return;
    }
    setUploadFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [
        ...current,
        ...accepted.filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`)),
      ];
    });
    setUploadState(null);
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
    setClaimForm((current) => ({ ...current, [key]: value }));
    setClaimState(null);
    setClaimQueryResult(null);
  }

  function parseMaterialCodes(value) {
    return [
      ...new Set(
        String(value || "")
          .split(/[\s,，、。;；|/\\]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
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
      setConfig({ ...emptyConfig, ...data.config, appSecret: "" });
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
      setUploadState({ ok: false, text: "请先拖入或选择 Excel 文件" });
      return;
    }
    setUploading(true);
    setUploadState(null);
    setUploadProgress({ current: 0, total: uploadFiles.length, fileName: "" });
    const results = [];
    try {
      for (let index = 0; index < uploadFiles.length; index += 1) {
        const file = uploadFiles[index];
        setUploadProgress({ current: index, total: uploadFiles.length, fileName: file.name });
        const response = await fetch(
          `/api/upload-spreadsheet?fileName=${encodeURIComponent(file.name)}&tableKey=${encodeURIComponent(targetTable)}`,
          {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: await file.arrayBuffer(),
          },
        );
        const data = await response.json();
        if (!data.ok) throw new Error(`${file.name}: ${data.error}`);
        results.push(data);
        setUploadProgress({ current: index + 1, total: uploadFiles.length, fileName: file.name });
      }
      const total = results.reduce((sum, item) => sum + item.count, 0);
      const warnings = results.flatMap((item) => item.warnings || []);
      setUploadState({
        ok: true,
        text:
          warnings.length > 0
            ? `写入完成：${results.length} 个文件，共 ${total} 条记录；${warnings.length} 个图片未上传，需开通飞书图片上传权限`
            : `写入完成：${results.length} 个文件，共 ${total} 条记录`,
      });
      setUploadFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadState({ ok: false, text: error.message });
    } finally {
      setUploading(false);
    }
  }

  async function claimDrawing() {
    const materialCodes = parseMaterialCodes(claimForm.materialCodes);
    if (materialCodes.length === 0) {
      setClaimState({ ok: false, text: "请输入至少一个料号" });
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
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        text: `领图成功：${data.materialCodes.join("，")}，共更新 ${data.count} 条记录`,
      });
    } catch (error) {
      setClaimState({ ok: false, text: error.message });
    } finally {
      setClaiming(false);
    }
  }

  async function completeDrawing() {
    const materialCodes = parseMaterialCodes(claimForm.materialCodes);
    if (materialCodes.length === 0) {
      setClaimState({ ok: false, text: "请输入至少一个料号" });
      return;
    }
    setCompletingDrawing(true);
    setClaimState(null);
    try {
      const response = await fetch("/api/complete-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialCodes, ...statusDateRange }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        text: `绘图完成：${data.materialCodes.join("，")}，共更新 ${data.count} 条记录`,
      });
    } catch (error) {
      setClaimState({ ok: false, text: error.message });
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
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        text: data.count > 0 ? `查询完成：共 ${data.count} 条图纸未被领取` : "查询完成：没有未领取图纸",
      });
      setClaimQueryResult(data);
    } catch (error) {
      setClaimState({ ok: false, text: error.message });
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
  const claimCodes = parseMaterialCodes(claimForm.materialCodes);
  const uploadPercent =
    uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0;
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
        <section className="card mapping-section">
          <div className="section-head mapping-head">
            <div>
              <h2>字段映射</h2>
              <p>设置 Excel 列标题与飞书多维表字段的对应关系，留空则默认使用同名字段。</p>
            </div>
            <Pill tone="neutral" icon={Database}>
              {bitableFields.length} 个字段
            </Pill>
          </div>

          <div className="data-grid" role="table" aria-label="字段映射">
            <div className="data-header" role="row">
              <span role="columnheader">Excel 字段</span>
              <span role="columnheader">连接</span>
              <span role="columnheader">飞书字段</span>
            </div>
            <div className="data-body">
              {bitableFields.map((field) => (
                <div className="data-row" role="row" key={field}>
                  <div className="excel-cell" role="cell">
                    <input
                      className="mapping-input"
                      value={fieldMappings[field] || ""}
                      onChange={(event) => updateFieldMapping(field, event.target.value)}
                      placeholder={field}
                    />
                  </div>
                  <div className="connector-cell" role="cell" aria-hidden="true">
                    <span className="connector-line" />
                    <span className="connector-node">
                      <ArrowRight size={15} />
                    </span>
                  </div>
                  <div className="feishu-cell" role="cell">
                    <span className="field-tag">{field}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === "people" && (
        <section className="card mapping-section">
          <div className="section-head mapping-head">
            <div>
              <h2>名字和 ID 映射</h2>
              <p>领图时会先按发送人 ID 查找名字；找到名字就写入名字，找不到才写入 ID。</p>
            </div>
            <Pill tone="neutral" icon={UsersRound}>
              {Object.keys(buildNameIdMap(nameIdRows)).length} 组映射
            </Pill>
          </div>

          <div className="people-map-list" aria-label="名字和 ID 映射关系表">
            <div className="people-map-header">
              <span>名字</span>
              <span>飞书用户 ID</span>
              <span>操作</span>
            </div>
            {nameIdRows.map((row, index) => (
              <div className="people-map-row" key={index}>
                <input
                  value={row.name}
                  placeholder="例如：张三"
                  onChange={(event) => updateNameIdRow(index, "name", event.target.value)}
                />
                <input
                  value={row.id}
                  placeholder="例如：ou_xxx 或 open_id"
                  onChange={(event) => updateNameIdRow(index, "id", event.target.value)}
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label="删除映射"
                  title="删除映射"
                  onClick={() => removeNameIdRow(index)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <ProgressBar active={savingConfig} label="正在保存人员映射" />

          <div className="connection-actions">
            {saveState && (
              <div className={`inline-result ${saveState.ok ? "ok" : "error"}`}>
                {saveState.text}
              </div>
            )}
            <div className="action-buttons">
              <button className="button secondary" type="button" onClick={addNameIdRow}>
                <Plus size={18} />
                添加一行
              </button>
              <button className="button primary" onClick={() => saveConfig()} disabled={saving}>
                <Save size={18} />
                {saving ? "保存中" : "保存映射"}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === "upload" && (
        <section className="tab-panel upload-panel">
          <section className="card connection-card">
            <div className="section-head">
              <div>
                <h2>新增写入</h2>
                <p>拖入 Excel 或 CSV 文件，系统会解析表头、套用字段映射，并把记录写入目标多维表。</p>
              </div>
              <Pill tone={configReady ? "success" : "warning"} icon={FileSpreadsheet}>
                {configReady ? "可上传" : "需先配置"}
              </Pill>
            </div>

            <div className="target-table-row">
              <span>写入到</span>
              <TableSelector value={targetTable} onChange={setTargetTable} />
            </div>

            <div
              className={`upload-dropzone ${draggingUpload ? "dragging" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDraggingUpload(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                setDraggingUpload(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDraggingUpload(false);
                addUploadFiles(event.dataTransfer.files);
              }}
            >
              <UploadCloud size={38} />
              <strong>拖动文件到这里上传</strong>
              <span>支持 xlsx、xls、csv，可一次放入多个文件</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={(event) => addUploadFiles(event.target.files)}
              />
              <button
                className="button secondary"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet size={18} />
                选择文件
              </button>
            </div>

            {uploadFiles.length > 0 && (
              <div className="upload-list" aria-label="待上传文件">
                {uploadFiles.map((file) => (
                  <div className="upload-file" key={`${file.name}:${file.size}:${file.lastModified}`}>
                    <FileSpreadsheet size={18} />
                    <span>
                      <strong>{file.name}</strong>
                      <small>{formatBytes(file.size)}</small>
                    </span>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`移除 ${file.name}`}
                      title="移除"
                      onClick={() => removeUploadFile(file)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <ProgressBar
              active={uploading}
              label={
                uploadProgress.fileName
                  ? `正在写入 ${uploadProgress.current + 1 > uploadProgress.total ? uploadProgress.total : uploadProgress.current + 1}/${uploadProgress.total}：${uploadProgress.fileName}`
                  : "正在准备写入"
              }
              value={uploadPercent}
            />

            <div className="connection-actions">
              {uploadState && (
                <div className={`inline-result ${uploadState.ok ? "ok" : "error"}`}>
                  {uploadState.text}
                </div>
              )}
              <div className="action-buttons">
                <button className="button secondary" onClick={clearUploadFiles} disabled={uploading}>
                  <X size={18} />
                  清空
                </button>
                <button
                  className="button primary"
                  onClick={uploadSpreadsheets}
                  disabled={uploading || !configReady}
                >
                  <UploadCloud size={18} />
                  {uploading ? "写入中" : "开始写入"}
                </button>
              </div>
            </div>
          </section>

          <aside className="workflow-card">
            <h2>写入规则</h2>
            <div className="workflow-list">
              <span>
                <FileSpreadsheet size={18} />
                自动识别首个工作表
              </span>
              <span>
                <Database size={18} />
                使用字段映射
              </span>
              <span>
                <Images size={18} />
                支持表格内图片
              </span>
            </div>
          </aside>
        </section>
      )}

      {activeTab === "status" && (
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
        <section className="card mapping-section owner-section">
          <div className="section-head mapping-head">
            <div>
              <h2>绘图人动态检测</h2>
              <p>自动读取清单里出现过的绘图人，显示当前绘图状态、今日接图和今日完成数量。</p>
            </div>
            <Pill tone={configReady ? "success" : "warning"} icon={UsersRound}>
              {configReady ? `${ownerStats?.summary?.owners || 0} 位绘图人` : "需先配置"}
            </Pill>
          </div>

          <ProgressBar active={ownerStatsLoading} label="正在读取绘图人动态" />

          {ownerStats?.summary && (
            <div className="owner-summary-grid">
              <div className="owner-summary-card drawing">
                <span>绘图中人员</span>
                <strong>{ownerStats.summary.drawing}</strong>
              </div>
              <div className="owner-summary-card idle">
                <span>空闲人员</span>
                <strong>{ownerStats.summary.idle}</strong>
              </div>
              <div className="owner-summary-card claimed">
                <span>今日接图</span>
                <strong>{ownerStats.summary.todayClaimed}</strong>
              </div>
              <div className="owner-summary-card done">
                <span>今日完成</span>
                <strong>{ownerStats.summary.todayCompleted}</strong>
              </div>
            </div>
          )}

          <div className="owner-toolbar">
            <span>上次刷新：{formatDisplayTime(ownerStats?.checkedAt)}</span>
            <button
              className="button secondary"
              type="button"
              onClick={() => loadDrawingOwnerStats()}
              disabled={ownerStatsLoading || !configReady}
            >
              <RefreshCw size={18} />
              刷新
            </button>
          </div>

          {ownerStatsState && (
            <div className={`inline-result ${ownerStatsState.ok ? "ok" : "error"}`}>
              {ownerStatsState.text}
            </div>
          )}

          {ownerStats?.items?.length > 0 ? (
            <div className="owner-grid">
              {ownerStats.items.map((item) => (
                <article className={`owner-card ${item.status}`} key={item.owner}>
                  <div className="owner-card-head">
                    <div>
                      <strong>{item.owner}</strong>
                      <span>{item.status === "drawing" ? `绘图中 ${item.drawingCount} 张` : "空闲"}</span>
                    </div>
                    <Pill tone={item.status === "drawing" ? "warning" : "success"} icon={Activity}>
                      {item.status === "drawing" ? "绘图中" : "空闲"}
                    </Pill>
                  </div>

                  <div className="owner-metrics">
                    <div>
                      <span>当前</span>
                      <strong>{item.drawingCount}</strong>
                    </div>
                    <div>
                      <span>今日接图</span>
                      <strong>{item.todayClaimed}</strong>
                    </div>
                    <div>
                      <span>今日完成</span>
                      <strong>{item.todayCompleted}</strong>
                    </div>
                  </div>

                  {item.activeItems.length > 0 && (
                    <div className="owner-active-list" aria-label={`${item.owner} 当前绘图`}>
                      {item.activeItems.slice(0, 6).map((activeItem) => (
                        <span key={`${activeItem.table}:${activeItem.recordId}`}>
                          {activeItem.materialCode}
                        </span>
                      ))}
                      {item.activeItems.length > 6 && <span>+{item.activeItems.length - 6}</span>}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="owner-empty">
              <UsersRound size={28} />
              <strong>还没有读取到绘图人</strong>
              <span>清单里出现绘图人后，这里会自动形成状态看板。</span>
            </div>
          )}
        </section>
      )}

      {activeTab === "drawing" && (
        <section className="tab-panel drawing-panel">
          <section className="card connection-card">
            <div className="section-head">
              <div>
                <h2>领图登记</h2>
                <p>提交领图会按料号写入绘图人；绘图完成会把输入料号同步为完成状态。</p>
              </div>
              <Pill tone={configReady ? "success" : "warning"} icon={ClipboardCheck}>
                {configReady ? "可提交" : "需先配置"}
              </Pill>
            </div>

            <div className="claim-layout">
              <FieldRow label="料号" hint="多个料号可用空格、逗号或换行分隔">
                <textarea
                  rows={5}
                  placeholder="例如：I-089F-K42&#10;I-089F-K43"
                  value={claimForm.materialCodes}
                  onChange={(event) => updateClaimForm("materialCodes", event.target.value)}
                />
              </FieldRow>
              <FieldRow label="领取人" hint="写入文本字段时使用">
                <input
                  placeholder="请输入领取人姓名"
                  value={claimForm.senderName}
                  onChange={(event) => updateClaimForm("senderName", event.target.value)}
                />
              </FieldRow>
            </div>

            <ProgressBar active={claiming} label="正在提交领图登记" />
            <ProgressBar active={completingDrawing} label="正在同步绘图完成状态" />
            <ProgressBar active={queryingClaims} label="正在查询绘图人领取状态" />

            {claimQueryResult && (
              <div className="claim-result-list" aria-label="图纸领取查询结果">
                {claimQueryResult.items.length === 0 && (
                  <div className="claim-result-item claimed">
                    <strong>全部图纸</strong>
                    <span>均已领取</span>
                  </div>
                )}
                {claimQueryResult.items.map((item) => (
                  <div className="claim-result-item unclaimed" key={item.recordId}>
                    <strong>{item.materialCode}</strong>
                    <span>未被领取</span>
                  </div>
                ))}
              </div>
            )}

            <div className="connection-actions">
              {claimState && (
                <div className={`inline-result ${claimState.ok ? "ok" : "error"}`}>
                  {claimState.text}
                </div>
              )}
              <div className="action-buttons">
                <button
                  className="button secondary"
                  onClick={queryDrawingClaims}
                  disabled={queryingClaims || claiming || completingDrawing || !configReady}
                >
                  <Search size={18} />
                  {queryingClaims ? "查询中" : "查询全部未领取"}
                </button>
                <button
                  className="button secondary"
                  onClick={completeDrawing}
                  disabled={completingDrawing || claiming || queryingClaims || !configReady}
                >
                  <CheckCircle2 size={18} />
                  {completingDrawing ? "同步中" : "绘图完成"}
                </button>
                <button
                  className="button primary"
                  onClick={claimDrawing}
                  disabled={claiming || completingDrawing || queryingClaims || !configReady}
                >
                  <UserRoundCheck size={18} />
                  {claiming ? "提交中" : "提交领图"}
                </button>
              </div>
            </div>
          </section>

          <aside className="workflow-card claim-summary">
            <h2>本次料号</h2>
            {claimCodes.length > 0 ? (
              <div className="claim-code-list">
                {claimCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
            ) : (
              <p>输入料号后，这里会自动整理去重。</p>
            )}
          </aside>
        </section>
      )}

      {activeTab === "commands" && (
        <section className="card mapping-section command-section">
          <div className="section-head mapping-head">
            <div>
              <h2>飞书口令操作</h2>
              <p>群里 @ 机器人即可触发这些操作；领图相关口令会自动在胶板/油漆表匹配料号，也可以在口令后追加日期范围。</p>
            </div>
            <Pill tone="neutral" icon={MessageSquareText}>
              {feishuCommands.length} 条口令
            </Pill>
          </div>

          <div className="command-grid">
            {feishuCommands.map((item) => (
              <article className="command-card" key={item.title}>
                <div className="command-card-head">
                  <strong>{item.title}</strong>
                  <code>{item.command}</code>
                </div>
                <div className="command-example">
                  <span>示例</span>
                  <code>{item.example}</code>
                </div>
                <p>{item.result}</p>
              </article>
            ))}
          </div>

          <div className="command-note">
            <strong>注意</strong>
            <span>
              新增必须发送胶板新增或油漆新增；领图、绘图完成会自动按料号定位胶板或油漆表，状态检测仍按页面或口令中指定的表执行。
            </span>
          </div>
        </section>
      )}

      <button className="refresh-fab" onClick={loadConfig} aria-label="刷新配置" title="刷新配置">
        <RefreshCw size={18} />
      </button>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
