import { CheckCircle2, Images, Search } from "lucide-react";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";
import AssigneeSelector from "./AssigneeSelector";

export default function AssignmentSummary({
  summary,
  assignee,
  peopleRows,
  assigneeError,
  busy,
  claiming,
  completing,
  querying,
  claimDisabled,
  completeDisabled,
  queryDisabled,
  onAssigneeChange,
  onClaim,
  onComplete,
  onQueryBoard,
  onQueryPaint,
}) {
  const ready = summary.uniqueCount > 0 && Boolean(assignee);
  return (
    <GlassCard className={`assignment-summary-panel ${ready ? "ready" : ""}`} as="aside">
      <header>
        <div className="assignment-step-heading compact"><span>3</span><div><h2>确认提交</h2><p>核对本次登记内容</p></div></div>
        <StatusBadge tone={ready ? "success" : "neutral"}>{ready ? "可以提交" : "等待填写"}</StatusBadge>
      </header>
      <AssigneeSelector
        value={assignee}
        peopleRows={peopleRows}
        disabled={busy}
        error={assigneeError}
        onChange={onAssigneeChange}
      />
      {summary.duplicates.length > 0 && <p className="assignment-duplicate-note">已自动排除 {summary.duplicates.length} 个重复项</p>}
      <div className="assignment-summary-actions">
        <GlassButton data-testid="claim-submit" type="button" variant="primary" onClick={onClaim} disabled={claimDisabled}>
          <Images size={17} />{claiming ? "领图中" : "领图"}
        </GlassButton>
        <GlassButton data-testid="complete-submit" type="button" variant="secondary" onClick={onComplete} disabled={completeDisabled}>
          <CheckCircle2 size={17} />{completing ? "完成中" : "绘图完成"}
        </GlassButton>
      </div>
      <div className="assignment-query-actions">
        <GlassButton data-testid="query-board-unclaimed" type="button" variant="secondary" onClick={onQueryBoard} disabled={queryDisabled}>
          <Search size={16} />{querying ? "查询中" : "查询胶板未领取"}
        </GlassButton>
        <GlassButton data-testid="query-paint-unclaimed" type="button" variant="secondary" onClick={onQueryPaint} disabled={queryDisabled}>
          <Search size={16} />{querying ? "查询中" : "查询油漆未领取"}
        </GlassButton>
      </div>
    </GlassCard>
  );
}
