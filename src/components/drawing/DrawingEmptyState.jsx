import { SearchX, UsersRound } from "lucide-react";
import { GlassCard } from "../design-system";

export default function DrawingEmptyState({ type = "empty", onClear }) {
  const isSearch = type === "search";
  return (
    <GlassCard className="drawing-empty-state" as="section">
      <div className="drawing-empty-icon" aria-hidden="true">
        {isSearch ? <SearchX size={28} /> : <UsersRound size={28} />}
      </div>
      <div>
        <h2>{isSearch ? "没有匹配的绘图动态" : "暂无绘图人动态数据"}</h2>
        <p>
          {isSearch
            ? "当前搜索或筛选条件没有命中绘图人员，请调整条件后再试。"
            : "接口尚未返回绘图人员。清单里出现绘图人后，这里会形成运行监控视图。"}
        </p>
      </div>
      {isSearch && (
        <button type="button" onClick={onClear}>
          清空条件
        </button>
      )}
    </GlassCard>
  );
}
