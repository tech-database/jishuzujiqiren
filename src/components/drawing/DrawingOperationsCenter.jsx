import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Gauge, X } from "lucide-react";
import { PageHeader, StatusBadge } from "../design-system";
import { PageTransition } from "../motion";
import {
  buildDrawingSummary,
  filterDrawingOperators,
  normalizeDrawingOperators,
} from "../../utils/drawingDataTransform";
import DrawingEmptyState from "./DrawingEmptyState";
import DrawingErrorState from "./DrawingErrorState";
import DrawingOperatorCard from "./DrawingOperatorCard";
import DrawingSummary from "./DrawingSummary";
import DrawingTaskList from "./DrawingTaskList";
import DrawingToolbar from "./DrawingToolbar";

export default function DrawingOperationsCenter({
  ownerStats,
  loading,
  errorState,
  configReady,
  onRefresh,
  formatTime,
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOperator, setSelectedOperator] = useState(null);
  const closeButtonRef = useRef(null);

  const operators = useMemo(() => normalizeDrawingOperators(ownerStats), [ownerStats]);
  const summary = useMemo(() => buildDrawingSummary(ownerStats, operators), [ownerStats, operators]);
  const visibleOperators = useMemo(
    () => filterDrawingOperators(operators, query, statusFilter),
    [operators, query, statusFilter],
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter("all");
  }, []);

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
      <PageHeader
        icon={<Gauge size={24} />}
        title="绘图人动态中心"
        description="基于真实飞书表格记录监控绘图人员、当前料号、今日接图与完成数量。"
        actions={(
          <>
            <StatusBadge tone={configReady ? "success" : "warning"}>
              {configReady ? "配置已就绪" : "等待配置"}
            </StatusBadge>
            <StatusBadge tone={summary.checkedAt ? "neutral" : "warning"}>
              {summary.checkedAt ? `刷新 ${formatTime(summary.checkedAt)}` : "等待同步"}
            </StatusBadge>
          </>
        )}
      />

      <DrawingSummary summary={summary} formatTime={formatTime} />

      <DrawingToolbar
        query={query}
        statusFilter={statusFilter}
        total={operators.length}
        visible={visibleOperators.length}
        loading={loading}
        configReady={configReady}
        onQueryChange={setQuery}
        onStatusFilterChange={setStatusFilter}
        onRefresh={onRefresh}
      />

      <DrawingErrorState message={errorState?.ok === false ? errorState.text : ""} onRetry={onRefresh} disabled={loading || !configReady} />

      {loading && !ownerStats ? (
        <section className="drawing-loading-grid" aria-label="绘图动态加载中">
          <span />
          <span />
          <span />
        </section>
      ) : visibleOperators.length > 0 ? (
        <motion.section className="drawing-operator-grid" layout>
          <AnimatePresence mode="popLayout">
            {visibleOperators.map((operator, index) => (
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
        <DrawingEmptyState
          type={operators.length > 0 ? "search" : "empty"}
          onClear={clearFilters}
        />
      )}

      <section className="drawing-boundary-note">
        <strong>进度说明</strong>
        <span>
          当前接口没有返回任务总量、待处理数量或历史时间序列，因此本页不展示假进度条和趋势图，只展示可由真实字段计算的运行指标。
        </span>
      </section>

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
