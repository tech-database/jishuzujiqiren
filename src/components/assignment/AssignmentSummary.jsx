import { ClipboardCheck, Send, UserRoundCheck } from "lucide-react";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";

export default function AssignmentSummary({ summary, assignee, submitting, disabled, onSubmit }) {
  const ready = summary.uniqueCount > 0 && Boolean(assignee);
  return (
    <GlassCard className={`assignment-summary-panel ${ready ? "ready" : ""}`} as="aside">
      <header>
        <div className="assignment-step-heading compact"><span>3</span><div><h2>确认提交</h2><p>核对本次登记内容</p></div></div>
        <StatusBadge tone={ready ? "success" : "neutral"}>{ready ? "可以提交" : "等待填写"}</StatusBadge>
      </header>
      <div className="assignment-live-summary">
        <div><small>当前料号数量</small><strong>{summary.uniqueCount}</strong></div>
        <div><small>领取人</small><strong>{assignee || "尚未选择"}</strong></div>
        <div><small>预计提交</small><strong>{summary.uniqueCount} 条</strong></div>
        <div><small>任务状态</small><strong>{submitting ? "提交中" : ready ? "已准备" : "待完善"}</strong></div>
      </div>
      {summary.duplicates.length > 0 && <p className="assignment-duplicate-note">已自动排除 {summary.duplicates.length} 个重复项</p>}
      <GlassButton className="assignment-summary-submit" type="button" variant="primary" onClick={onSubmit} disabled={disabled}>
        <Send size={17} />{submitting ? "正在提交" : "提交领取登记"}
      </GlassButton>
      <div className="assignment-submit-state"><ClipboardCheck size={15} /><span>提交后将写入 {summary.uniqueCount} 条唯一料号</span></div>
      {assignee && <div className="assignment-current-assignee"><UserRoundCheck size={15} /><span>{assignee}</span></div>}
    </GlassCard>
  );
}
