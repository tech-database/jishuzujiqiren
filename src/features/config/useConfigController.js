import { useEffect, useRef, useState } from "react";
import {
  buildFieldMap,
  buildNameIdMap,
  emptyConfig,
  invertFieldMap,
  mapToNameIdRows,
} from "./config.model.js";
import {
  checkConnection as checkConnectionApi,
  getConfig,
  getHealth,
  saveConfig as saveConfigApi,
} from "./config.api.js";
import { healthFromError, healthFromResponse } from "./config-health.model.js";
import { useClipboardFeedback } from "./useClipboardFeedback.js";

export function useConfigController({ requestSensitiveAction, targetTable }) {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(emptyConfig);
  const [configBaseline, setConfigBaseline] = useState(emptyConfig);
  const [configLoading, setConfigLoading] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [checkState, setCheckState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [refreshingConfig, setRefreshingConfig] = useState(false);
  const [bitableFields, setBitableFields] = useState([]);
  const [fieldMappings, setFieldMappings] = useState({});
  const [nameIdRows, setNameIdRows] = useState([{ id: "", name: "" }]);
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [monitoringResetVersion, setMonitoringResetVersion] = useState(0);
  const adminAccessRef = useRef(false);
  const { copiedField, copyConfigValue } = useClipboardFeedback();

  async function autoFetchFields(currentStatus) {
    try {
      const data = await checkConnectionApi(targetTable);
      if (data.ok && data.fields) {
        setBitableFields(data.fields);
        const existing = invertFieldMap(currentStatus?.fieldMap);
        setFieldMappings(Object.fromEntries(data.fields.map((field) => [field, existing[field] || ""])));
      }
    } catch {
      // Initial field loading should not block the page.
    }
  }

  async function loadConfig({ adminAccess = adminAccessRef.current } = {}) {
    setConfigLoading(true);
    try {
      const data = await getConfig();
      if (!data.ok) return;
      setStatus(data.status);
      const loadedConfig = { ...emptyConfig, ...data.config, appSecret: "" };
      setConfig(loadedConfig);
      setConfigBaseline(loadedConfig);
      const loadedNameIdMap = Object.keys(data.config?.nameIdMap || {}).length > 0
        ? data.config.nameIdMap
        : data.status?.nameIdMap;
      setNameIdRows(mapToNameIdRows(loadedNameIdMap));
      if (data.status?.ready && adminAccess) await autoFetchFields(data.status);
    } catch {
      setStatus(null);
    } finally {
      setConfigLoading(false);
    }
  }

  async function loadHealthStatus() {
    setHealthLoading(true);
    try {
      const data = await getHealth();
      setHealthStatus(healthFromResponse(data));
    } catch (error) {
      setHealthStatus(healthFromError(error));
    } finally {
      setHealthLoading(false);
    }
  }

  function clearAdminConfig() {
    setConfig(emptyConfig);
    setConfigBaseline(emptyConfig);
    setBitableFields([]);
    setFieldMappings({});
  }

  function setAdminAccess(authenticated) {
    adminAccessRef.current = Boolean(authenticated);
  }

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

  async function persistConfig(adminPassword) {
    const dataToSave = {
      ...config,
      fieldMap: buildFieldMap(fieldMappings),
      nameIdMap: buildNameIdMap(nameIdRows),
      adminPassword,
    };
    setSaving(true);
    setSaveState(null);
    try {
      const data = await saveConfigApi(dataToSave);
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
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndVerifyConnection(adminPassword, { forceRefresh = false } = {}) {
    if (forceRefresh) setRefreshingConfig(true);
    setChecking(true);
    setCheckState(null);
    try {
      await persistConfig(adminPassword);
      const data = await checkConnectionApi(targetTable);
      if (!data.ok) throw new Error(data.error);
      setCheckState({
        ok: true,
        text: forceRefresh
          ? `新表格地址已保存并生效，读取到 ${data.fieldCount} 个字段`
          : `${data.message}，读取到 ${data.fieldCount} 个字段`,
      });
      if (data.fields) {
        const existing = invertFieldMap(status?.fieldMap);
        setBitableFields(data.fields);
        setFieldMappings(Object.fromEntries(data.fields.map((field) => [field, existing[field] || ""])));
      }
      if (forceRefresh) {
        setMonitoringResetVersion((version) => version + 1);
        await loadHealthStatus();
      }
    } catch (error) {
      setCheckState({ ok: false, text: error.message });
      throw error;
    } finally {
      setChecking(false);
      if (forceRefresh) setRefreshingConfig(false);
    }
  }

  function saveConfig() {
    requestSensitiveAction("保存配置", persistConfig);
  }

  function checkConnection() {
    requestSensitiveAction("测试连接", saveAndVerifyConnection);
  }

  function forceRefreshConfig() {
    requestSensitiveAction("强制刷新表格地址", (password) =>
      saveAndVerifyConnection(password, { forceRefresh: true }));
  }

  useEffect(() => {
    loadConfig();
    loadHealthStatus();
    const timer = window.setInterval(loadHealthStatus, 30000);
    return () => window.clearInterval(timer);
    // Initial load and polling lifecycle are intentionally mounted once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    bitableFields,
    checkConnection,
    checking,
    checkState,
    clearAdminConfig,
    config,
    configBaseline,
    configLoading,
    configReady: Boolean(status?.ready),
    copiedField,
    copyConfigValue,
    fieldMappings,
    forceRefreshConfig,
    healthLoading,
    healthStatus,
    loadConfig,
    monitoringResetVersion,
    nameIdRows,
    refreshingConfig,
    resetConfigChanges,
    saveConfig,
    saveState,
    saving,
    savingConfig: saving && !checking,
    setFieldMappings,
    setAdminAccess,
    setNameIdRows,
    setSaveState,
    status,
    updateConfig,
  };
}
