import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "../design-system";

export default function AssignmentResultPanel({ state, assignee, materialCount }) {
  if (!state?.ok) return null;
  return (
    <GlassCard className="assignment-result-panel" as="section">
      <CheckCircle2 size={22} aria-hidden="true" />
      <div role="status">
        <h2>{state.operation === "query" ? "查询完成" : state.operation === "complete" ? "状态同步完成" : "登记成功"}</h2>
        <p>{state.operation === "claim" ? `已提交 ${materialCount} 个料号，领取人：${assignee}` : state.text}</p>
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
