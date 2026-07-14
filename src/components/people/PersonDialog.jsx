import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { GlassButton } from "../design-system";
import { createPersonDraft, validatePersonDraft } from "../../utils/peopleMappingUtils";

export default function PersonDialog({ mode, person, onClose, onSubmit }) {
  const [draft, setDraft] = useState(() => createPersonDraft(person));
  const [errors, setErrors] = useState({});
  const [confirmClose, setConfirmClose] = useState(false);
  const closeRef = useRef(null);

  const initialDraft = useMemo(() => createPersonDraft(person), [person]);
  const isDirty = draft.name !== initialDraft.name || draft.id !== initialDraft.id;

  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validatePersonDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(createPersonDraft(draft));
  };

  return (
    <motion.div
      className="person-dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={requestClose}
    >
      <motion.form
        className="person-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-dialog-title"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <header className="person-dialog-header">
          <div>
            <span>{mode === "edit" ? "编辑草稿" : "新增草稿"}</span>
            <h2 id="person-dialog-title">{mode === "edit" ? "编辑人员映射" : "新增人员映射"}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={requestClose} aria-label="关闭人员映射窗口">
            <X size={18} />
          </button>
        </header>

        <label className="person-field">
          <span>姓名</span>
          <input
            value={draft.name}
            onChange={(event) => updateDraft("name", event.target.value)}
            placeholder="例如：张三"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <small>{errors.name}</small>}
        </label>

        <label className="person-field">
          <span>飞书用户 ID</span>
          <input
            value={draft.id}
            onChange={(event) => updateDraft("id", event.target.value)}
            placeholder="例如：ou_xxx 或 open_id"
            aria-invalid={Boolean(errors.id)}
          />
          {errors.id && <small>{errors.id}</small>}
        </label>

        {confirmClose && (
          <div className="person-unsaved-confirm" role="alert">
            <strong>放弃未保存修改？</strong>
            <p>当前窗口内的输入还没有写入草稿。</p>
            <div>
              <button type="button" onClick={() => setConfirmClose(false)}>
                继续编辑
              </button>
              <button type="button" onClick={onClose}>
                放弃修改
              </button>
            </div>
          </div>
        )}

        <footer className="person-dialog-footer">
          <GlassButton type="button" variant="secondary" onClick={requestClose}>
            取消
          </GlassButton>
          <GlassButton type="submit" variant="primary">
            保存到草稿
          </GlassButton>
        </footer>
      </motion.form>
    </motion.div>
  );
}
