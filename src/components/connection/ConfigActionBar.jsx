import { memo } from "react";
import { KeyRound, RotateCcw, Save } from "lucide-react";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";

function ConfigActionBarComponent({
  dirty,
  saving,
  checking,
  disabled,
  saveState,
  checkState,
  copiedField,
  onSave,
  onTest,
  onReset,
  children,
}) {
  const result = checkState || saveState;

  return (
    <GlassCard className="connection-action-bar">
      <div className="connection-action-main">
        <div className="connection-action-title">
          <h3>配置操作</h3>
          <p>保存配置或执行真实连接测试。测试成功后会读取字段供映射页使用。</p>
        </div>
        {children}
        <div className="connection-action-feedback">
          {dirty && <StatusBadge tone="warning">有未保存修改</StatusBadge>}
          {copiedField && <StatusBadge tone="success">已复制 {copiedField}</StatusBadge>}
          {result && <div className={`connection-result ${result.ok ? "ok" : "error"}`}>{result.text}</div>}
        </div>
      </div>
      <div className="connection-action-buttons">
        <GlassButton variant="secondary" onClick={onReset} disabled={!dirty || saving || checking}>
          <RotateCcw size={17} />
          重置修改
        </GlassButton>
        <GlassButton variant="secondary" onClick={onSave} disabled={disabled || saving}>
          <Save size={17} />
          {saving && !checking ? "保存中" : "保存配置"}
        </GlassButton>
        <GlassButton variant="primary" onClick={onTest} disabled={disabled || checking}>
          <KeyRound size={17} />
          {checking ? "测试中" : "测试连接"}
        </GlassButton>
      </div>
    </GlassCard>
  );
}

export const ConfigActionBar = memo(ConfigActionBarComponent);
