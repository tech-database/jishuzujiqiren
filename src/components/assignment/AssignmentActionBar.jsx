import { CheckCircle2, Search, X } from "lucide-react";
import { GlassButton } from "../design-system";

export default function AssignmentActionBar({
  completeDisabled,
  queryDisabled,
  querying,
  claiming,
  completing,
  hasCodes,
  onClear,
  onQuery,
  onComplete,
}) {
  return (
    <section className="assignment-action-bar">
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
      </div>
    </section>
  );
}
