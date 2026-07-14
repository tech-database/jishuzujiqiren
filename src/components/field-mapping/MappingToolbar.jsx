import { RotateCcw, Save, Search, Wand2 } from "lucide-react";
import { GlassButton, StatusBadge } from "../design-system";

export function MappingToolbar({
  stats,
  addExcelFieldValue,
  onAddExcelFieldValueChange,
  onAddExcelField,
  onSmartMatch,
  onSave,
  onReset,
  saving,
  dirty,
  disabled,
}) {
  return (
    <div className="mapping-toolbar">
      <div className="mapping-toolbar-stats">
        <StatusBadge tone="neutral">Excel {stats.excelCount}</StatusBadge>
        <StatusBadge tone="neutral">飞书 {stats.feishuCount}</StatusBadge>
        <StatusBadge tone={stats.explicitCount > 0 ? "success" : "neutral"}>显式映射 {stats.explicitCount}</StatusBadge>
        <StatusBadge tone={stats.defaultCount > 0 ? "warning" : "neutral"}>默认同名 {stats.defaultCount}</StatusBadge>
        {dirty && <StatusBadge tone="warning">未保存</StatusBadge>}
      </div>

      <form className="mapping-add-field" onSubmit={onAddExcelField}>
        <Search size={16} />
        <input
          value={addExcelFieldValue}
          onChange={(event) => onAddExcelFieldValueChange(event.target.value)}
          placeholder="添加 Excel 列标题"
          disabled={disabled}
        />
      </form>

      <div className="mapping-toolbar-actions">
        <GlassButton variant="secondary" onClick={onSmartMatch} disabled={disabled}>
          <Wand2 size={17} />
          智能匹配
        </GlassButton>
        <GlassButton variant="secondary" onClick={onReset} disabled={!dirty || disabled}>
          <RotateCcw size={17} />
          重置修改
        </GlassButton>
        <GlassButton variant="primary" onClick={onSave} disabled={saving || disabled}>
          <Save size={17} />
          {saving ? "保存中" : "保存映射"}
        </GlassButton>
      </div>
    </div>
  );
}
