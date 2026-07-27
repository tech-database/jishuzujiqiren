import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatClock } from "./dashboard-formatters.js";
import { SectionFrame } from "./SectionFrame.jsx";

function logKey(log) {
  return log.id || `${log.time || ""}:${log.type || ""}:${log.content || ""}`;
}

export function LogPanel({ logs }) {
  const reduceMotion = useReducedMotion();
  const visibleLogs = logs.slice(0, 8);
  const previousKeysRef = useRef(new Set());
  const hasPreviousLogs = previousKeysRef.current.size > 0;

  useEffect(() => {
    previousKeysRef.current = new Set(logs.slice(0, 8).map(logKey));
  }, [logs]);

  return (
    <SectionFrame
      title="实时运行日志"
      meta="机器人任务流与系统状态实时记录"
      className="home-log-panel"
    >
      <div className="home-log-table" role="table" aria-label="最新8条实时运行日志">
        <div className="home-log-row head" role="row">
          <span>时间</span><span>类型</span><span>来源</span><span>日志内容</span><span>状态</span>
        </div>
        {visibleLogs.length === 0 ? (
          <div className="home-empty">暂无实时日志</div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {visibleLogs.map((log) => {
              const key = logKey(log);
              const isNew = hasPreviousLogs && !previousKeysRef.current.has(key);
              const isError = log.status === "异常";
              return (
                <motion.div
                  layout="position"
                  className={`home-log-row ${isNew ? "is-new" : ""} ${
                    isNew && isError ? "is-new-error" : ""
                  }`.trim()}
                  role="row"
                  key={key}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -9 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                  transition={{
                    duration: reduceMotion ? 0.12 : 0.38,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                >
                  <span>{formatClock(log.time)}</span>
                  <span><b className={`log-type type-${log.type}`}>{log.type}</b></span>
                  <span>{log.source}</span>
                  <span title={log.content}>{log.content}</span>
                  <span>
                    <b className={`log-state ${isError ? "error" : "ok"}`}>
                      <i />{log.status}
                    </b>
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </SectionFrame>
  );
}
