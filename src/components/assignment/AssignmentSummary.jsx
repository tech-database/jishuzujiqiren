import { ClipboardCheck, UserRoundCheck } from "lucide-react";
import { GlassCard, StatusBadge } from "../design-system";
import MaterialCodeList from "./MaterialCodeList";

export default function AssignmentSummary({ summary, assignee, submitting, onRemoveCode }) {
  return (
    <GlassCard className="assignment-summary-panel" as="aside">
      <header>
        <div>
          <h2>本次任务</h2>
          <p>实际提交会使用去重后的唯一料号列表。</p>
        </div>
        <StatusBadge tone={summary.uniqueCount > 0 ? "success" : "warning"}>
          {summary.uniqueCount} 个料号
        </StatusBadge>
      </header>

      <div className="assignment-summary-metrics">
        <span>
          <small>识别总数</small>
          <strong>{summary.rawCount}</strong>
        </span>
        <span>
          <small>唯一料号</small>
          <strong>{summary.uniqueCount}</strong>
        </span>
        <span>
          <small>重复项</small>
          <strong>{summary.duplicates.length}</strong>
        </span>
      </div>

      <div className="assignment-current-assignee">
        <UserRoundCheck size={17} />
        <span>{assignee || "未选择领取人"}</span>
      </div>

      <MaterialCodeList items={summary.items} onRemove={onRemoveCode} />

      <div className="assignment-submit-state">
        <ClipboardCheck size={16} />
        <span>{submitting ? "正在提交当前任务" : "等待提交"}</span>
      </div>
    </GlassCard>
  );
}
