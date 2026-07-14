import { useEffect, useRef } from "react";
import { Copy, MessageSquareText, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassButton, StatusBadge } from "../design-system";

export default function CommandDialog({ command, copied, onClose, onCopy }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!command) return undefined;
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [command, onClose]);

  return (
    <AnimatePresence>
      {command && (
        <motion.div
          className="command-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={onClose}
        >
          <motion.section
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-dialog-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="command-dialog-header">
              <div>
                <StatusBadge tone="neutral">只读详情</StatusBadge>
                <h2 id="command-dialog-title">{command.title}</h2>
              </div>
              <button ref={closeRef} className="command-dialog-close" type="button" onClick={onClose} aria-label="关闭详情">
                <X size={18} />
              </button>
            </header>

            <div className="command-detail-stack">
              <div className="command-detail-item">
                <span>触发方式</span>
                <code>{command.command || "暂无触发方式"}</code>
              </div>
              <div className="command-detail-item">
                <span>示例</span>
                <code>{command.example || "暂无示例"}</code>
              </div>
              <div className="command-detail-item command-detail-result">
                <span>执行结果</span>
                <p>{command.result || "暂无执行说明"}</p>
              </div>
            </div>

            <footer className="command-dialog-footer">
              <p>
                <MessageSquareText size={15} />
                该口令来自当前项目已有飞书机器人识别逻辑，未附带后台管理接口。
              </p>
              <GlassButton type="button" onClick={() => onCopy(command)}>
                <Copy size={16} />
                {copied ? "已复制" : "复制示例"}
              </GlassButton>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
