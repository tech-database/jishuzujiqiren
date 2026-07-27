import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database, FileSpreadsheet, MessageSquareText } from "lucide-react";
import { isConfigDirty, validateConnectionConfig } from "../../utils/configFormUtils";
import { ConfigActionBar } from "./ConfigActionBar";
import { ConnectionConfigForm } from "./ConnectionConfigForm.jsx";
import { ConnectionStatusCard } from "./ConnectionStatusCard";

export default function ConnectionManagementCenter({
  configReady,
  healthStatus,
  healthLoading,
  bitableFields,
  targetTable,
  setTargetTable,
  TableSelector,
  config,
  configBaseline,
  updateConfig,
  resetConfig,
  copyConfigValue,
  copiedField,
  checkState,
  saveState,
  saving,
  savingConfig,
  checking,
  refreshingConfig,
  saveConfig,
  checkConnection,
  forceRefreshConfig,
  formatDisplayTime,
}) {
  const [errors, setErrors] = useState({});
  const dirty = useMemo(
    () => isConfigDirty(config, configBaseline),
    [config, configBaseline],
  );
  const firstErrorKey = Object.keys(errors)[0];
  const statusCards = useMemo(
    () => [
      {
        title: "飞书应用连接",
        icon: MessageSquareText,
        status:
          healthLoading && !healthStatus
            ? "检测中"
            : healthStatus?.checks?.feishu
              ? "已检测"
              : "等待检测",
        tone: healthStatus?.ok
          ? "success"
          : healthStatus?.checks?.feishu?.ok === false
            ? "danger"
            : "neutral",
        detail:
          healthStatus?.checks?.feishu?.message ||
          healthStatus?.label ||
          "当前接口尚未提供检测结果。",
        meta: healthStatus?.checkedAt
          ? `最近检测 ${formatDisplayTime(healthStatus.checkedAt)}`
          : "暂无检测时间",
      },
      {
        title: "多维表连接",
        icon: Database,
        status:
          healthStatus?.checks?.board?.ok || healthStatus?.checks?.paint?.ok
            ? "已检测"
            : configReady
              ? "等待检测"
              : "配置缺失",
        tone:
          healthStatus?.checks?.board?.ok || healthStatus?.checks?.paint?.ok
            ? "success"
            : configReady
              ? "neutral"
              : "warning",
        detail:
          healthStatus?.checks?.[targetTable]?.message ||
          "需要通过测试连接读取真实字段。",
        meta: `当前目标表 ${targetTable === "paint" ? "油漆" : "胶板"}`,
      },
      {
        title: "字段数据源",
        icon: FileSpreadsheet,
        status: bitableFields.length > 0 ? "已读取字段" : "暂无数据",
        tone: bitableFields.length > 0 ? "success" : "neutral",
        detail:
          bitableFields.length > 0
            ? `已读取 ${bitableFields.length} 个真实字段。`
            : "测试连接成功后才会读取字段。",
        meta: checkState?.ok ? "检测刚刚完成" : "等待检测",
      },
    ],
    [
      bitableFields.length,
      checkState?.ok,
      configReady,
      formatDisplayTime,
      healthLoading,
      healthStatus,
      targetTable,
    ],
  );

  function validateBeforeSubmit() {
    const nextErrors = validateConnectionConfig(config);
    setErrors(nextErrors);
    const firstKey = Object.keys(nextErrors)[0];
    if (!firstKey) return true;
    requestAnimationFrame(() => {
      document.querySelector(`[data-config-key="${firstKey}"] input`)?.focus();
    });
    return false;
  }

  async function runValidated(action) {
    if (validateBeforeSubmit()) await action();
  }

  function handleReset() {
    if (!dirty) return;
    const confirmed = window.confirm(
      "确认重置未保存修改？这只会恢复到最近一次成功加载或保存的配置，不会删除后端数据。",
    );
    if (!confirmed) return;
    resetConfig();
    setErrors({});
  }

  function updateField(key, value) {
    updateConfig(key, value);
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  }

  return (
    <motion.section
      className="connection-management-center"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
    >
      <section className="connection-status-grid" aria-label="连接状态概览">
        {statusCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.04,
              duration: 0.26,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <ConnectionStatusCard {...card} />
          </motion.div>
        ))}
      </section>

      <ConnectionConfigForm
        config={config}
        copyConfigValue={copyConfigValue}
        errors={errors}
        updateField={updateField}
      />

      {firstErrorKey && (
        <div className="connection-validation-summary">
          请先处理表单错误：{errors[firstErrorKey]}
        </div>
      )}

      <ConfigActionBar
        dirty={dirty}
        saving={saving}
        checking={checking}
        refreshing={refreshingConfig}
        disabled={saving || checking}
        saveState={saveState}
        checkState={checkState}
        copiedField={copiedField}
        onSave={() => runValidated(saveConfig)}
        onTest={() => runValidated(checkConnection)}
        onForceRefresh={() => runValidated(forceRefreshConfig)}
        onReset={handleReset}
      >
        <div className="connection-test-target">
          <span>当前测试表</span>
          {TableSelector && (
            <TableSelector value={targetTable} onChange={setTargetTable} />
          )}
        </div>
        {(savingConfig || checking) && (
          <div className="connection-progress-note">
            {refreshingConfig
              ? "正在保存并应用新的表格地址"
              : checking
                ? "正在测试连接并读取字段"
                : "正在保存配置"}
          </div>
        )}
      </ConfigActionBar>
    </motion.section>
  );
}
