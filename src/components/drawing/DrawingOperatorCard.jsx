import { memo } from "react";
import { motion } from "framer-motion";
import { Activity, Clock3, Database, UserRound } from "lucide-react";
import { GlassCard, StatusBadge } from "../design-system";
import CopyPartNumberButton from "./CopyPartNumberButton";
import { getOperatorActivePartNumber, getVisibleActiveItems } from "../../utils/drawingDataTransform";

function DrawingOperatorCard({ operator, index, onSelect }) {
  const activePart = getOperatorActivePartNumber(operator);
  const visibleItems = getVisibleActiveItems(operator, 4);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.018, 0.12), ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className={`drawing-operator-card ${operator.status.key}`} as="article">
        <header className="drawing-operator-head">
          <div className="drawing-operator-title">
            <span className="drawing-avatar" aria-hidden="true">
              <UserRound size={18} />
            </span>
            <div>
              <h2>{operator.owner}</h2>
              <small>{operator.totalOwned} 条关联记录</small>
            </div>
          </div>
          <StatusBadge tone={operator.status.tone}>
            {operator.status.key === "drawing" ? <Activity size={13} /> : <Clock3 size={13} />}
            {operator.status.label}
          </StatusBadge>
        </header>

        <div className="drawing-current-task">
          <span>当前料号</span>
          {activePart ? (
            <div>
              <code title={activePart}>{activePart}</code>
              <CopyPartNumberButton value={activePart} />
            </div>
          ) : (
            <p>暂无当前绘图料号</p>
          )}
        </div>

        <div className="drawing-operator-metrics">
          <span>
            <small>当前任务</small>
            <strong>{operator.drawingCount}</strong>
          </span>
          <span>
            <small>今日接图</small>
            <strong>{operator.todayClaimed}</strong>
          </span>
          <span>
            <small>今日完成</small>
            <strong>{operator.todayCompleted}</strong>
          </span>
        </div>

        <div className="drawing-card-progress-note">
          <Database size={14} />
          当前接口未提供可靠任务进度字段
        </div>

        {visibleItems.items.length > 0 && (
          <div className="drawing-active-chips" aria-label={`${operator.owner} 活跃料号`}>
            {visibleItems.items.map((item) => (
              <code title={item.materialCode} key={`${item.table}:${item.recordId}`}>
                {item.materialCode}
              </code>
            ))}
            {visibleItems.hiddenCount > 0 && <span>+{visibleItems.hiddenCount}</span>}
          </div>
        )}

        <button className="drawing-card-detail-button" type="button" onClick={() => onSelect(operator)}>
          查看任务明细
        </button>
      </GlassCard>
    </motion.div>
  );
}

export default memo(DrawingOperatorCard);
