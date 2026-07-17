import { memo } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Circle, Clock3, UserRound } from "lucide-react";
import CopyPartNumberButton from "./CopyPartNumberButton";
import { getOperatorActivePartNumber } from "../../utils/drawingDataTransform";

const statusIcons = {
  drawing: Clock3,
  idle: Circle,
  unknown: AlertCircle,
};

function DrawingOperatorCard({ operator, index, onSelect }) {
  const activePart = getOperatorActivePartNumber(operator);
  const StatusIcon = statusIcons[operator.status.key] || AlertCircle;

  return (
    <motion.article
      layout
      className={`drawing-operator-card ${operator.status.key}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.018, 0.1), ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="drawing-operator-head">
        <div className="drawing-operator-title">
          <span className="drawing-avatar" aria-hidden="true"><UserRound size={18} /></span>
          <h2>{operator.owner}</h2>
        </div>
        <span className={`drawing-status ${operator.status.key}`}>
          <StatusIcon size={12} fill="currentColor" />{operator.status.label}
        </span>
      </header>

      <div className="drawing-current-task">
        <span>当前料号</span>
        <div>
          <code title={activePart || "暂无当前料号"}>{activePart || "暂无"}</code>
          {activePart && <CopyPartNumberButton value={activePart} />}
        </div>
      </div>

      <div className="drawing-operator-metrics">
        <span><small>当前任务</small><strong>{operator.drawingCount}</strong></span>
        <span><small>今日接图</small><strong>{operator.todayClaimed}</strong></span>
        <span><small>今日完成</small><strong>{operator.todayCompleted}</strong></span>
      </div>

      <button className="drawing-card-detail-button" type="button" onClick={() => onSelect(operator)}>
        查看任务明细
      </button>
    </motion.article>
  );
}

export default memo(DrawingOperatorCard);
