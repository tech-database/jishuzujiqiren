import { AlertTriangle, Copy, RotateCcw, X } from "lucide-react";
import { GlassButton, GlassCard } from "../design-system";

export default function ImportErrorPanel({ state, onRetry, onDismiss, disabled }) {
  if (state?.ok !== false) return null;

  const copyDetails = async () => {
    await navigator.clipboard?.writeText(state.text || "");
  };

  return (
    <GlassCard className="import-error-panel" as="section">
      <AlertTriangle size={22} aria-hidden="true" />
      <div className="import-error-copy" role="alert">
        <h2>处理失败</h2>
        <p>{state.text}</p>
        <dl>
          {state.fileName && (
            <div>
              <dt>文件</dt>
              <dd>{state.fileName}</dd>
            </div>
          )}
          {state.phase && (
            <div>
              <dt>阶段</dt>
              <dd>{state.phase}</dd>
            </div>
          )}
          {state.status && (
            <div>
              <dt>HTTP 状态</dt>
              <dd>{state.status}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="import-error-actions">
        <GlassButton type="button" variant="secondary" onClick={copyDetails}>
          <Copy size={16} />
          复制错误
        </GlassButton>
        <GlassButton type="button" variant="secondary" onClick={onDismiss}>
          <X size={16} />
          关闭
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={onRetry} disabled={disabled}>
          <RotateCcw size={16} />
          重试
        </GlassButton>
      </div>
    </GlassCard>
  );
}
