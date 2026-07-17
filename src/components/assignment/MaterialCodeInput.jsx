export default function MaterialCodeInput({ value, summary, disabled, error, onChange, onClear }) {
  return (
    <section className="assignment-field-card">
      <div className="assignment-step-heading">
        <span>1</span><div><h2>输入料号</h2><p>支持换行、空格、逗号、顿号、分号或斜杠分隔</p></div>
      </div>
      <textarea
        id="assignment-material-codes"
        value={value}
        disabled={disabled}
        rows={4}
        placeholder="J-JW-JG1634&#10;J-JW-JG1635&#10;J-JW-JG1636"
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={error ? "assignment-material-error" : "assignment-material-help"}
        aria-invalid={Boolean(error)}
      />
      <div className="assignment-input-meta" id="assignment-material-help">
        <span>已识别 <strong>{summary.uniqueCount}</strong> 个料号</span>
        {summary.duplicates.length > 0 && <span>{summary.duplicates.length} 个重复项将不会重复提交</span>}
        <button type="button" onClick={onClear} disabled={disabled || !value.trim()}>
          清空
        </button>
      </div>
      {error && (
        <p className="assignment-field-error" id="assignment-material-error">
          {error}
        </p>
      )}
    </section>
  );
}
