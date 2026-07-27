import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import { CountUpNumber } from "./CountUpNumber.jsx";
import { SectionFrame } from "./SectionFrame.jsx";

export function PersonnelPanel({ personnel }) {
  const items = personnel?.items || [];
  const previousRef = useRef(new Map());
  useEffect(() => {
    previousRef.current = new Map(
      (personnel?.items || []).map((person) => [
        person.owner,
        {
          status: person.status,
          task: person.activeItems?.[0]?.materialCode || "",
          completed: Number(person.todayCompleted || 0),
        },
      ]),
    );
  }, [personnel]);

  return (
    <SectionFrame title="绘图人员实时状态" className="home-personnel-panel">
      <div className={`home-personnel-grid count-${Math.min(items.length, 12)}`}>
        {items.length === 0 ? (
          <div className="home-empty">暂无绘图人员实时数据</div>
        ) : (
          items.map((person) => {
            const drawing = person.status === "drawing";
            const previous = previousRef.current.get(person.owner);
            const currentTask = person.activeItems?.[0]?.materialCode || "";
            const hasNewTask = Boolean(
              previous &&
                currentTask &&
                (previous.task !== currentTask || previous.status !== "drawing"),
            );
            const hasCompletion = Boolean(
              previous &&
                (Number(person.todayCompleted || 0) > previous.completed ||
                  (previous.status === "drawing" && !drawing)),
            );
            const feedbackClass = hasCompletion
              ? "has-completion"
              : hasNewTask
                ? "has-new-task"
                : "";
            return (
              <motion.article
                layout="position"
                transition={{ layout: { duration: 0.42, ease: [0.25, 1, 0.5, 1] } }}
                className={`home-person-card ${drawing ? "drawing" : "idle"} ${feedbackClass}`.trim()}
                key={person.owner}
              >
                <div className="home-person-heading">
                  <span className="home-avatar"><UserRound size={22} /></span>
                  <strong>{person.owner}</strong>
                  <em><i />{drawing ? "绘图中" : "空闲"}</em>
                </div>
                <div
                  className="home-person-task"
                  title={(person.activeItems || []).map((item) => item.materialCode).join("、")}
                >
                  <span>当前任务</span>
                  <strong>{currentTask || "—"}</strong>
                </div>
                <div className="home-person-stats">
                  <span>今日接图<CountUpNumber value={person.todayClaimed ?? 0} /></span>
                  <span>今日完成<CountUpNumber value={person.todayCompleted ?? 0} /></span>
                </div>
              </motion.article>
            );
          })
        )}
      </div>
    </SectionFrame>
  );
}
