import { Bot, Database, FileSpreadsheet, Settings2 } from "lucide-react";
import { ConfigSection } from "./ConfigSection";
import { SecureInput } from "./SecureInput";

function BooleanSwitch({ checked, onChange, label, description }) {
  return (
    <label className="connection-switch">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ConfigField({ configKey, children }) {
  return <div data-config-key={configKey}>{children}</div>;
}

export function ConnectionConfigForm({
  config,
  copyConfigValue,
  errors,
  updateField,
}) {
  return (
    <section className="connection-form-grid">
      <ConfigSection
        icon={Bot}
        title="飞书应用配置"
        description="应用身份与密钥。App Secret 留空时沿用服务器已保存值。"
      >
        <ConfigField configKey="appId">
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
        </ConfigField>
        <ConfigField configKey="appSecret">
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
        </ConfigField>
      </ConfigSection>

      <ConfigSection
        icon={Database}
        title="胶板多维表配置"
        description="胶板业务主表，用于新增写入、字段映射和状态同步。"
      >
        <ConfigField configKey="bitableAppToken">
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
        </ConfigField>
        <ConfigField configKey="bitableTableId">
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
        </ConfigField>
      </ConfigSection>

      <ConfigSection
        icon={FileSpreadsheet}
        title="油漆多维表配置"
        description="油漆业务表，可用于同一套机器人流程的分表写入。"
      >
        <ConfigField configKey="paintBitableAppToken">
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
        </ConfigField>
        <ConfigField configKey="paintBitableTableId">
          <SecureInput
            fieldKey="paintBitableTableId"
            label="油漆 Table ID"
            hint="油漆数据表 ID。"
            placeholder="请输入油漆 Table ID"
            value={config.paintBitableTableId}
            onChange={(value) => updateField("paintBitableTableId", value)}
            onCopy={() => copyConfigValue("paintBitableTableId", config.paintBitableTableId)}
          />
        </ConfigField>
      </ConfigSection>

      <ConfigSection
        icon={FileSpreadsheet}
        title="报价统计表配置"
        description="报价统计使用独立多维表应用，需要填写对应的 App Token 和数据表 ID。"
      >
        <ConfigField configKey="quoteBitableAppToken">
          <SecureInput
            fieldKey="quoteBitableAppToken"
            label="报价 App Token"
            hint="报价统计多维表的 App Token。"
            placeholder="请输入报价多维表 App Token"
            value={config.quoteBitableAppToken}
            sensitive
            onChange={(value) => updateField("quoteBitableAppToken", value)}
            onCopy={() => copyConfigValue("quoteBitableAppToken", config.quoteBitableAppToken)}
          />
        </ConfigField>
        <ConfigField configKey="quoteBitableTableId">
          <SecureInput
            fieldKey="quoteBitableTableId"
            label="报价统计表 ID"
            hint="报价数据统计表的 Table ID。"
            placeholder="请输入报价统计表 ID"
            value={config.quoteBitableTableId}
            onChange={(value) => updateField("quoteBitableTableId", value)}
            onCopy={() => copyConfigValue("quoteBitableTableId", config.quoteBitableTableId)}
          />
        </ConfigField>
      </ConfigSection>

      <ConfigSection
        icon={Settings2}
        title="高级配置"
        description="保留现有布尔配置，不改变后端保存结构。"
      >
        <BooleanSwitch
          checked={Boolean(config.replyEnabled)}
          onChange={(value) => updateField("replyEnabled", value)}
          label="飞书回复"
          description="开启后，机器人会按现有后端逻辑回复处理结果。"
        />
      </ConfigSection>
    </section>
  );
}
