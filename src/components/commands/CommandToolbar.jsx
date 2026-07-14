import { Search, X } from "lucide-react";
import { StatusBadge } from "../design-system";

export default function CommandToolbar({ query, onQueryChange, total, filtered }) {
  return (
    <div className="command-toolbar">
      <label className="command-search-field">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索口令名称、触发方式或执行结果"
          aria-label="搜索飞书口令"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} aria-label="清空搜索">
            <X size={16} />
          </button>
        )}
      </label>

      <div className="command-toolbar-meta">
        <StatusBadge tone="neutral">{filtered} / {total} 条口令</StatusBadge>
        <StatusBadge tone="warning">只读清单</StatusBadge>
        <span className="command-interface-note" title="当前后端未提供口令管理接口">
          管理接口未开放
        </span>
      </div>
    </div>
  );
}
