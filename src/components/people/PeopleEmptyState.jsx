import { UserRoundSearch } from "lucide-react";
import { GlassCard } from "../design-system";

export default function PeopleEmptyState({ hasQuery, canAdd, onAdd, onClear }) {
  return (
    <GlassCard className="people-empty-state" as="section">
      <div className="people-empty-icon" aria-hidden="true">
        <UserRoundSearch size={28} />
      </div>
      <div>
        <h2>{hasQuery ? "没有匹配的人员映射" : "暂无人员映射数据"}</h2>
        <p>
          {hasQuery
            ? "当前姓名或飞书用户 ID 没有命中记录，请调整搜索条件。"
            : "当前配置中还没有有效的姓名与飞书用户 ID 映射。"}
        </p>
      </div>
      <div className="people-empty-actions">
        {hasQuery && (
          <button type="button" onClick={onClear}>
            清空搜索
          </button>
        )}
        {canAdd && (
          <button type="button" onClick={onAdd}>
            新增第一条映射
          </button>
        )}
      </div>
    </GlassCard>
  );
}
