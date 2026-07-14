import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { GlassButton } from "../design-system";

export default function DeletePersonDialog({ person, onClose, onConfirm }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="person-dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={onClose}
    >
      <motion.section
        className="person-dialog delete"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-person-title"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="person-dialog-header">
          <div>
            <span>删除确认</span>
            <h2 id="delete-person-title">删除人员映射</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭删除确认">
            <X size={18} />
          </button>
        </header>

        <div className="delete-person-body">
          <span aria-hidden="true">
            <AlertTriangle size={24} />
          </span>
          <div>
            <p>将从当前草稿中删除这条映射，点击“保存映射”后才会写入后端配置。</p>
            <dl>
              <div>
                <dt>姓名</dt>
                <dd>{person?.name || "未填写"}</dd>
              </div>
              <div>
                <dt>飞书用户 ID</dt>
                <dd>{person?.id || "未填写"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <footer className="person-dialog-footer">
          <GlassButton type="button" variant="secondary" onClick={onClose}>
            取消
          </GlassButton>
          <GlassButton type="button" variant="primary" className="danger" onClick={() => onConfirm(person)}>
            确认删除
          </GlassButton>
        </footer>
      </motion.section>
    </motion.div>
  );
}
