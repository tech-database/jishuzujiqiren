import { memo, useEffect, useRef, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBadge } from "../design-system";

const statusLabels = {
  pending: "待提交",
  duplicate: "重复",
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(resetTimerRef.current);
  }, []);

  const copy = async () => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button type="button" onClick={copy} aria-label={`复制料号 ${value}`}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span aria-live="polite">{copied ? "已复制" : "复制"}</span>
    </button>
  );
}

const MaterialCodeItem = memo(function MaterialCodeItem({ item, onRemove }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      <span className="assignment-code-index">{item.index + 1}</span>
      <code title={item.code}>{item.code}</code>
      <StatusBadge tone={item.duplicate ? "warning" : "neutral"}>{statusLabels[item.status]}</StatusBadge>
      <div className="assignment-code-actions">
        <CopyButton value={item.code} />
        <button type="button" onClick={() => onRemove(item.index)} aria-label={`删除料号 ${item.code}`}>
          <Trash2 size={14} />
          删除
        </button>
      </div>
    </motion.li>
  );
});

export default function MaterialCodeList({ items, onRemove }) {
  if (items.length === 0) {
    return (
      <div className="assignment-code-empty">
        <strong>尚未输入料号</strong>
        <span>输入后会在这里自动解析并标记重复项。</span>
      </div>
    );
  }

  return (
    <ol className="assignment-code-list">
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <MaterialCodeItem item={item} onRemove={onRemove} key={`${item.code}-${item.index}`} />
        ))}
      </AnimatePresence>
    </ol>
  );
}
