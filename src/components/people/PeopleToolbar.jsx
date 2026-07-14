import { Plus, RotateCcw, Save, Search, X } from "lucide-react";
import { GlassButton, StatusBadge } from "../design-system";

export default function PeopleToolbar({
  query,
  onQueryChange,
  total,
  visible,
  hasUnsavedChanges,
  saving,
  onAdd,
  onSave,
  onReset,
}) {
  return (
    <section className="people-toolbar" aria-label="人员映射搜索和操作">
      <label className="people-search-field">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索姓名或飞书用户 ID"
          aria-label="搜索姓名或飞书用户 ID"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} aria-label="清空搜索">
            <X size={16} />
          </button>
        )}
      </label>

      <div className="people-toolbar-actions">
        <StatusBadge tone={hasUnsavedChanges ? "warning" : "neutral"}>
          {hasUnsavedChanges ? "有未保存修改" : `${visible} / ${total} 条`}
        </StatusBadge>
        <span className="people-status-note">后端未提供独立状态字段</span>
        <GlassButton type="button" variant="secondary" onClick={onReset} disabled={!hasUnsavedChanges || saving}>
          <RotateCcw size={16} />
          重置草稿
        </GlassButton>
        <GlassButton type="button" variant="secondary" onClick={onAdd}>
          <Plus size={16} />
          新增映射
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={onSave} disabled={saving || !hasUnsavedChanges}>
          <Save size={16} />
          {saving ? "保存中" : "保存映射"}
        </GlassButton>
      </div>
    </section>
  );
}
