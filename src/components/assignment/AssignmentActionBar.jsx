import { CheckCircle2, Search, UserRoundCheck, X } from "lucide-react";
import { GlassButton } from "../design-system";

export default function AssignmentActionBar({
  claimDisabled,
  completeDisabled,
  queryDisabled,
  querying,
  claiming,
  completing,
  hasCodes,
  onClear,
  onQuery,
  onComplete,
  onClaim,
}) {
  return (
    <section className="assignment-action-bar">
      <div>
        <strong>{hasCodes ? "任务已准备" : "等待料号"}</strong>
        <span>{claimDisabled ? "请确认配置、料号和领取人" : "可提交领图登记或同步绘图完成状态"}</span>
      </div>
      <div>
        <GlassButton type="button" variant="secondary" onClick={onClear} disabled={claiming || completing || querying || !hasCodes}>
          <X size={16} />
          清空
        </GlassButton>
        <GlassButton type="button" variant="secondary" onClick={onQuery} disabled={queryDisabled || querying || claiming || completing}>
          <Search size={16} />
          {querying ? "查询中" : "查询未领取"}
        </GlassButton>
        <GlassButton type="button" variant="secondary" onClick={onComplete} disabled={completeDisabled || completing || claiming || querying}>
          <CheckCircle2 size={16} />
          {completing ? "同步中" : "绘图完成"}
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={onClaim} disabled={claimDisabled || claiming || completing || querying}>
          <UserRoundCheck size={16} />
          {claiming ? "提交中" : "提交领图"}
        </GlassButton>
      </div>
    </section>
  );
}
