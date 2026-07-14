import { memo, useId, useState } from "react";
import { Copy, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { isSensitiveConfigKey, maskSensitiveValue } from "../../utils/configFormUtils";

function SecureInputComponent({
  fieldKey,
  label,
  value,
  placeholder,
  hint,
  error,
  sensitive = false,
  savedSecret = false,
  onChange,
  onCopy,
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [revealed, setRevealed] = useState(false);
  const filled = Boolean(String(value || "").trim());
  const isSensitive = sensitive || isSensitiveConfigKey(fieldKey);
  const displayPlaceholder = savedSecret && !filled ? "已保存，留空保持不变" : placeholder;
  const inputType = isSensitive && !revealed ? "password" : "text";

  return (
    <label className={`secure-field ${error ? "has-error" : ""}`}>
      <span className="secure-field-label">
        <strong>{label}</strong>
        {isSensitive && (
          <small>
            <ShieldCheck size={13} />
            敏感字段
          </small>
        )}
      </span>
      {hint && <span className="secure-field-hint">{hint}</span>}
      <span className={`secure-input-shell ${filled || savedSecret ? "filled" : ""}`}>
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={displayPlaceholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          spellCheck="false"
          autoComplete={isSensitive ? "off" : "off"}
        />
        {savedSecret && !filled && <span className="secure-mask-preview">{maskSensitiveValue("saved-secret")}</span>}
        {isSensitive && (
          <button
            type="button"
            className="secure-field-button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? "隐藏敏感字段" : "显示敏感字段"}
          >
            {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
        <button
          type="button"
          className="secure-field-button"
          onClick={onCopy}
          disabled={!filled}
          aria-label={`复制${label}`}
          title={filled ? `复制${label}` : "当前没有可复制的明文值"}
        >
          <Copy size={17} />
        </button>
      </span>
      {error && (
        <span className="secure-field-error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}

export const SecureInput = memo(SecureInputComponent);
