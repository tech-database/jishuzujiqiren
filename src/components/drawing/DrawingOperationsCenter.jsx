import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, X } from "lucide-react";
import { StatusBadge } from "../design-system";
import { PageTransition } from "../motion";
import {
  buildDrawingSummary,
  normalizeDrawingOperators,
} from "../../utils/drawingDataTransform";
import DrawingEmptyState from "./DrawingEmptyState";
import DrawingErrorState from "./DrawingErrorState";
import DrawingOperatorCard from "./DrawingOperatorCard";
import DrawingSummary from "./DrawingSummary";
import DrawingTaskList from "./DrawingTaskList";

export default function DrawingOperationsCenter({
  ownerStats,
  loading,
  errorState,
  configReady,
  onRefresh,
  formatTime,
}) {
  const [selectedOperator, setSelectedOperator] = useState(null);
  const closeButtonRef = useRef(null);

  const operators = useMemo(() => normalizeDrawingOperators(ownerStats), [ownerStats]);
  const summary = useMemo(() => buildDrawingSummary(ownerStats, operators), [ownerStats, operators]);
  useEffect(() => {
    if (!selectedOperator) return undefined;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSelectedOperator(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedOperator]);

  return (
    <PageTransition className="drawing-center">
      <DrawingSummary summary={summary} formatTime={formatTime} />

      <DrawingErrorState message={errorState?.ok === false ? errorState.text : ""} onRetry={onRefresh} disabled={loading || !configReady} />

      {loading && !ownerStats ? (
        <section className="drawing-loading-grid" aria-label="绘图动态加载中">
          <span />
          <span />
          <span />
        </section>
      ) : operators.length > 0 ? (
        <motion.section className="drawing-operator-grid" layout>
          <AnimatePresence mode="popLayout">
            {operators.map((operator, index) => (
              <DrawingOperatorCard
                key={operator.id}
                operator={operator}
                index={index}
                onSelect={setSelectedOperator}
              />
            ))}
          </AnimatePresence>
        </motion.section>
      ) : (
        <DrawingEmptyState type="empty" />
      )}

      <AnimatePresence>
        {selectedOperator && (
          <motion.div
            className="drawing-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={() => setSelectedOperator(null)}
          >
            <motion.section
              className="drawing-detail-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawing-detail-title"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="drawing-detail-header">
                <div>
                  <StatusBadge tone={selectedOperator.status.tone}>
                    <Activity size={13} />
                    {selectedOperator.status.label}
                  </StatusBadge>
                  <h2 id="drawing-detail-title">{selectedOperator.owner}</h2>
                </div>
                <button ref={closeButtonRef} type="button" onClick={() => setSelectedOperator(null)} aria-label="关闭任务明细">
                  <X size={18} />
                </button>
              </header>
              <DrawingTaskList operator={selectedOperator} />
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
