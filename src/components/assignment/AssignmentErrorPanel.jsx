import { AlertTriangle, Copy, RotateCcw, X } from "lucide-react";
import { GlassButton, GlassCard } from "../design-system";

export default function AssignmentErrorPanel({ state, materialCount, assignee, disabled, onRetry, onDismiss }) {
  if (state?.ok !== false) return null;
  const copy = async () => {
    await navigator.clipboard?.writeText(state.text || "");
  };

  return (
    <GlassCard className="assignment-error-panel" as="section">
      <AlertTriangle size={22} aria-hidden="true" />
      <div role="alert">
        <h2>提交失败</h2>
        <p>{state.text}</p>
        <dl>
          <div>
            <dt>阶段</dt>
            <dd>{state.operation || "提交"}</dd>
          </div>
          <div>
            <dt>领取人</dt>
            <dd>{assignee || "未填写"}</dd>
          </div>
          <div>
            <dt>料号数量</dt>
            <dd>{materialCount}</dd>
          </div>
        </dl>
      </div>
      <div className="assignment-error-actions">
        <GlassButton type="button" variant="secondary" onClick={copy}>
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
