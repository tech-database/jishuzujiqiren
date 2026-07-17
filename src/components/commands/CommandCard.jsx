import {
  Activity,
  BadgeCheck,
  Copy,
  Eye,
  FilePlus2,
  IdCard,
  Images,
  ListTree,
  SearchCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";

function getCommandIcon(title = "") {
  if (title.includes("完成新增")) return BadgeCheck;
  if (title.includes("新增")) return FilePlus2;
  if (title.includes("领图完成")) return BadgeCheck;
  if (title.includes("查询未领图")) return SearchCheck;
  if (title.includes("领图")) return Images;
  if (title.includes("状态")) return Activity;
  if (title.includes("ID")) return IdCard;
  return ListTree;
}

export default function CommandCard({ command, index, copied, onCopy, onView }) {
  const CommandIcon = getCommandIcon(command.title);

  return (
    <motion.div
      className="robot-command-card-shell"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.08), ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="robot-command-card" as="article">
        <div className="robot-command-card__top">
          <div className="robot-command-heading">
            <span className="robot-command-icon" aria-hidden="true">
              <CommandIcon size={19} />
            </span>
            <h2>{command.title}</h2>
          </div>
          <StatusBadge tone="success">已启用</StatusBadge>
        </div>

        <div className="robot-command-block robot-command-block--primary">
          <span className="robot-command-label">口令</span>
          <div className="robot-command-code-row">
            <code>{command.command || "暂无触发方式"}</code>
            <button type="button" onClick={() => onCopy(command)} aria-label={`复制${command.title}口令`} title="复制口令">
              <Copy size={15} />
            </button>
          </div>
        </div>

        <div className="robot-command-block robot-command-block--example">
          <span className="robot-command-label">示例</span>
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
