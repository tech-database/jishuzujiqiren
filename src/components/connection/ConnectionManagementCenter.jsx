import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Database, FileSpreadsheet, Link2, MessageSquareText, Settings2, ShieldCheck } from "lucide-react";
import { GlassCard, StatusBadge } from "../design-system";
import { ConfigActionBar } from "./ConfigActionBar";
import { ConfigSection } from "./ConfigSection";
import { ConnectionStatusCard } from "./ConnectionStatusCard";
import { SecureInput } from "./SecureInput";
import { isConfigDirty, validateConnectionConfig } from "../../utils/configFormUtils";

function BooleanSwitch({ checked, onChange, label, description }) {
  return (
    <label className="connection-switch">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

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
  saveConfig,
  checkConnection,
  formatDisplayTime,
}) {
  const [errors, setErrors] = useState({});
  const dirty = useMemo(() => isConfigDirty(config, configBaseline), [config, configBaseline]);
  const firstErrorKey = Object.keys(errors)[0];

  const statusCards = useMemo(
    () => [
      {
        title: "飞书应用连接",
        icon: MessageSquareText,
        status: healthLoading && !healthStatus ? "检测中" : healthStatus?.checks?.feishu ? "已检测" : "等待检测",
        tone: healthStatus?.ok ? "success" : healthStatus?.checks?.feishu?.ok === false ? "danger" : "neutral",
        detail: healthStatus?.checks?.feishu?.message || healthStatus?.label || "当前接口尚未提供检测结果。",
        meta: healthStatus?.checkedAt ? `最近检测 ${formatDisplayTime(healthStatus.checkedAt)}` : "暂无检测时间",
      },
      {
        title: "多维表连接",
        icon: Database,
        status: healthStatus?.checks?.board?.ok || healthStatus?.checks?.paint?.ok ? "已检测" : configReady ? "等待检测" : "配置缺失",
        tone: healthStatus?.checks?.board?.ok || healthStatus?.checks?.paint?.ok ? "success" : configReady ? "neutral" : "warning",
        detail: healthStatus?.checks?.[targetTable]?.message || "需要通过测试连接读取真实字段。",
        meta: `当前目标表 ${targetTable === "paint" ? "油漆" : "胶板"}`,
      },
      {
        title: "字段数据源",
        icon: FileSpreadsheet,
        status: bitableFields.length > 0 ? "已读取字段" : "暂无数据",
        tone: bitableFields.length > 0 ? "success" : "neutral",
        detail: bitableFields.length > 0 ? `已读取 ${bitableFields.length} 个真实字段。` : "测试连接成功后才会读取字段。",
        meta: checkState?.ok ? "检测刚刚完成" : "等待检测",
      },
    ],
    [bitableFields.length, checkState?.ok, configReady, formatDisplayTime, healthLoading, healthStatus, targetTable],
  );

  function validateBeforeSubmit() {
    const nextErrors = validateConnectionConfig(config);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => {
        document.querySelector(`[data-config-key="${Object.keys(nextErrors)[0]}"] input`)?.focus();
      });
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validateBeforeSubmit()) return;
    await saveConfig();
  }

  async function handleTest() {
    if (!validateBeforeSubmit()) return;
    await checkConnection();
  }

  function handleReset() {
    if (!dirty) return;
    const confirmed = window.confirm("确认重置未保存修改？这只会恢复到最近一次成功加载或保存的配置，不会删除后端数据。");
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
      <GlassCard className="connection-management-hero">
        <div className="section-title-block">
          <span className="section-icon">
            <Link2 size={24} />
          </span>
          <div>
            <h2>系统连接与凭据管理中心</h2>
            <p>集中管理飞书应用、多维表和机器人写入链路，敏感字段默认隐藏并按现有接口保存。</p>
          </div>
        </div>
        <div className="connection-management-status">
          <StatusBadge tone={configReady ? "success" : "warning"}>{configReady ? "配置已填写" : "配置缺失"}</StatusBadge>
          {dirty && <StatusBadge tone="warning">有未保存修改</StatusBadge>}
        </div>
      </GlassCard>

      <section className="connection-status-grid" aria-label="连接状态概览">
        {statusCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <ConnectionStatusCard {...card} />
          </motion.div>
        ))}
      </section>

      <section className="connection-form-grid">
        <ConfigSection icon={Bot} title="飞书应用配置" description="应用身份与密钥。App Secret 留空时沿用服务器已保存值。">
          <div data-config-key="appId">
            <SecureInput
              fieldKey="appId"
              label="App ID"
              hint="飞书应用凭证标识。"
              placeholder="请输入 App ID"
              value={config.appId}
              error={errors.appId}
              onChange={(value) => updateField("appId", value)}
              onCopy={() => copyConfigValue("appId", config.appId)}
            />
          </div>
          <div data-config-key="appSecret">
            <SecureInput
              fieldKey="appSecret"
              label="App Secret"
              hint={config.appSecretSet ? "服务器已有保存值；留空不会覆盖。" : "首次配置需要填写。"}
              placeholder="请输入 App Secret"
              value={config.appSecret}
              savedSecret={config.appSecretSet}
              error={errors.appSecret}
              sensitive
              onChange={(value) => updateField("appSecret", value)}
              onCopy={() => copyConfigValue("appSecret", config.appSecret)}
            />
          </div>
        </ConfigSection>

        <ConfigSection icon={Database} title="胶板多维表配置" description="胶板业务主表，用于新增写入、字段映射和状态同步。">
          <div data-config-key="bitableAppToken">
            <SecureInput
              fieldKey="bitableAppToken"
              label="胶板 App Token"
              hint="目标多维表 App Token。"
              placeholder="请输入胶板多维表 App Token"
              value={config.bitableAppToken}
              error={errors.bitableAppToken}
              sensitive
              onChange={(value) => updateField("bitableAppToken", value)}
              onCopy={() => copyConfigValue("bitableAppToken", config.bitableAppToken)}
            />
          </div>
          <div data-config-key="bitableTableId">
            <SecureInput
              fieldKey="bitableTableId"
              label="胶板 Table ID"
              hint="目标数据表 ID。"
              placeholder="请输入胶板 Table ID"
              value={config.bitableTableId}
              error={errors.bitableTableId}
              onChange={(value) => updateField("bitableTableId", value)}
              onCopy={() => copyConfigValue("bitableTableId", config.bitableTableId)}
            />
          </div>
        </ConfigSection>

        <ConfigSection icon={FileSpreadsheet} title="油漆多维表配置" description="油漆业务表，可用于同一套机器人流程的分表写入。">
          <div data-config-key="paintBitableAppToken">
            <SecureInput
              fieldKey="paintBitableAppToken"
              label="油漆 App Token"
              hint="油漆多维表 App Token。"
              placeholder="请输入油漆多维表 App Token"
              value={config.paintBitableAppToken}
              sensitive
              onChange={(value) => updateField("paintBitableAppToken", value)}
              onCopy={() => copyConfigValue("paintBitableAppToken", config.paintBitableAppToken)}
            />
          </div>
          <div data-config-key="paintBitableTableId">
            <SecureInput
              fieldKey="paintBitableTableId"
              label="油漆 Table ID"
              hint="油漆数据表 ID。"
              placeholder="请输入油漆 Table ID"
              value={config.paintBitableTableId}
              onChange={(value) => updateField("paintBitableTableId", value)}
              onCopy={() => copyConfigValue("paintBitableTableId", config.paintBitableTableId)}
            />
          </div>
        </ConfigSection>

        <ConfigSection icon={Settings2} title="高级配置" description="保留现有布尔配置，不改变后端保存结构。">
          <BooleanSwitch
            checked={Boolean(config.replyEnabled)}
            onChange={(value) => updateField("replyEnabled", value)}
            label="飞书回复"
            description="开启后，机器人会按现有后端逻辑回复处理结果。"
          />
        </ConfigSection>
      </section>

      {firstErrorKey && <div className="connection-validation-summary">请先处理表单错误：{errors[firstErrorKey]}</div>}

      <ConfigActionBar
        dirty={dirty}
        saving={saving}
        checking={checking}
        disabled={saving || checking}
        saveState={saveState}
        checkState={checkState}
        copiedField={copiedField}
        onSave={handleSave}
        onTest={handleTest}
        onReset={handleReset}
      >
        <div className="connection-test-target">
          <span>当前测试表</span>
          {TableSelector && <TableSelector value={targetTable} onChange={setTargetTable} />}
        </div>
        {(savingConfig || checking) && (
          <div className="connection-progress-note">{checking ? "正在测试连接并读取字段" : "正在保存配置"}</div>
        )}
      </ConfigActionBar>
    </motion.section>
  );
}
