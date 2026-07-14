export default function MaterialCodeInput({ value, summary, disabled, error, onChange, onClear }) {
  return (
    <section className="assignment-field-card">
      <label className="assignment-field-label" htmlFor="assignment-material-codes">
        <span>料号输入</span>
        <small>支持换行、空格、逗号、顿号、分号或斜杠分隔</small>
      </label>
      <textarea
        id="assignment-material-codes"
        value={value}
        disabled={disabled}
        rows={8}
        placeholder="例如：I-089F-K42&#10;I-089F-K43"
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={error ? "assignment-material-error" : "assignment-material-help"}
        aria-invalid={Boolean(error)}
      />
      <div className="assignment-input-meta" id="assignment-material-help">
        <span>识别 {summary.uniqueCount} 个唯一料号</span>
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
