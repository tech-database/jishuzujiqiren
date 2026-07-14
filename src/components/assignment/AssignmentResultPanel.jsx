import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "../design-system";

export default function AssignmentResultPanel({ state }) {
  if (!state?.ok) return null;
  return (
    <GlassCard className="assignment-result-panel" as="section">
      <CheckCircle2 size={22} aria-hidden="true" />
      <div role="status">
        <h2>提交成功</h2>
        <p>{state.text}</p>
        {state.data?.materialCodes?.length > 0 && (
          <div className="assignment-result-codes">
            {state.data.materialCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
