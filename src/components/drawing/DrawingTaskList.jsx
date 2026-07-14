import CopyPartNumberButton from "./CopyPartNumberButton";

export default function DrawingTaskList({ operator }) {
  if (!operator.activeItems.length) {
    return (
      <div className="drawing-task-empty">
        <span>当前接口未返回正在处理的料号</span>
      </div>
    );
  }

  return (
    <div className="drawing-task-list" aria-label={`${operator.owner} 当前绘图料号`}>
      {operator.activeItems.map((item) => (
        <div className="drawing-task-row" key={`${item.table}:${item.recordId}`}>
          <code title={item.materialCode}>{item.materialCode}</code>
          <CopyPartNumberButton value={item.materialCode} />
        </div>
      ))}
    </div>
  );
}
