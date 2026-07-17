import { RefreshCw, Search, X } from "lucide-react";

export default function CommandToolbar({ query, onQueryChange, total, filtered, onRefresh }) {
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
        <span className="command-count-label">{filtered} / {total} 条口令</span>
        <button className="command-refresh-button" type="button" onClick={onRefresh}>
          <RefreshCw size={16} />
          刷新
        </button>
      </div>
    </div>
  );
}
