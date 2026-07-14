import { SearchX } from "lucide-react";
import { GlassCard } from "../design-system";

export default function CommandEmptyState({ hasQuery, onClear }) {
  return (
    <GlassCard className="command-empty-state" as="section">
      <div className="command-empty-icon" aria-hidden="true">
        <SearchX size={28} />
      </div>
      <div>
        <h2>{hasQuery ? "没有匹配的机器人口令" : "暂无口令数据"}</h2>
        <p>
          {hasQuery
            ? "当前搜索条件没有命中现有口令，请调整关键词后再试。"
            : "当前项目没有返回可展示的口令清单。"}
        </p>
      </div>
      {hasQuery && (
        <button className="command-clear-link" type="button" onClick={onClear}>
          清空搜索
        </button>
      )}
    </GlassCard>
  );
}
