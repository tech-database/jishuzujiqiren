import { AlertTriangle, RefreshCw } from "lucide-react";
import { GlassButton, GlassCard } from "../design-system";

export default function DrawingErrorState({ message, onRetry, disabled }) {
  if (!message) return null;
  return (
    <GlassCard className="drawing-error-state" as="section">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <strong>绘图动态读取失败</strong>
        <p>{message}</p>
      </div>
      <GlassButton type="button" variant="secondary" onClick={onRetry} disabled={disabled}>
        <RefreshCw size={16} />
        重试
      </GlassButton>
    </GlassCard>
  );
}
