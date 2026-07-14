import { Copy, Eye, MessageSquareText, TerminalSquare } from "lucide-react";
import { motion } from "framer-motion";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";

export default function CommandCard({ command, index, copied, onCopy, onView }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.025, 0.12), ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="robot-command-card" as="article">
        <div className="robot-command-card__top">
          <span className="robot-command-icon" aria-hidden="true">
            <TerminalSquare size={22} />
          </span>
          <StatusBadge tone="neutral">真实口令</StatusBadge>
        </div>

        <div className="robot-command-card__body">
          <h2>{command.title}</h2>
          <code>{command.command || "暂无触发方式"}</code>
        </div>

        <div className="robot-command-example">
          <span>
            <MessageSquareText size={15} aria-hidden="true" />
            示例
          </span>
          <code>{command.example || "暂无示例"}</code>
        </div>

        <p>{command.result || "暂无执行说明"}</p>

        <div className="robot-command-actions">
          <GlassButton type="button" variant="secondary" onClick={() => onCopy(command)}>
            <Copy size={16} />
            {copied ? "已复制" : "复制示例"}
          </GlassButton>
          <GlassButton type="button" variant="secondary" onClick={() => onView(command)}>
            <Eye size={16} />
            查看详情
          </GlassButton>
        </div>
      </GlassCard>
    </motion.div>
  );
}
