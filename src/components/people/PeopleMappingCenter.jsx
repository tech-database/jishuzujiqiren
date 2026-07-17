import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Database, Fingerprint, UsersRound } from "lucide-react";
import { GlassCard } from "../design-system";
import { PageTransition } from "../motion";
import {
  arePeopleRowsEqual,
  deletePeopleRow,
  filterPeopleRows,
  getPagedRows,
  getPeopleStats,
  getValidPeopleRows,
  upsertPeopleRow,
} from "../../utils/peopleMappingUtils";
import DeletePersonDialog from "./DeletePersonDialog";
import PeopleEmptyState from "./PeopleEmptyState";
import PeopleTable from "./PeopleTable";
import PeopleToolbar from "./PeopleToolbar";
import PersonDialog from "./PersonDialog";

const PAGE_SIZE = 12;

export default function PeopleMappingCenter({
  rows,
  baselineRows,
  loading,
  saving,
  saveState,
  onRowsChange,
  onSave,
  onReset,
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dialogState, setDialogState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const validRows = useMemo(() => getValidPeopleRows(rows), [rows]);
  const filteredRows = useMemo(() => filterPeopleRows(validRows, query), [validRows, query]);
  const stats = useMemo(() => getPeopleStats(rows), [rows]);
  const hasUnsavedChanges = useMemo(() => !arePeopleRowsEqual(rows, baselineRows), [rows, baselineRows]);
  const paged = useMemo(() => getPagedRows(filteredRows, page, PAGE_SIZE), [filteredRows, page]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page !== paged.page) setPage(paged.page);
  }, [page, paged.page]);

  const addPerson = useCallback(() => {
    setDialogState({ mode: "add", person: null });
  }, []);

  const editPerson = useCallback((person) => {
    setDialogState({ mode: "edit", person });
  }, []);

  const submitPerson = useCallback(
    (draft) => {
      const editIndex = dialogState?.mode === "edit" ? dialogState.person.index : null;
      onRowsChange((currentRows) => upsertPeopleRow(currentRows, draft, editIndex));
      setDialogState(null);
    },
    [dialogState, onRowsChange],
  );

  const confirmDelete = useCallback(
    (person) => {
      onRowsChange((currentRows) => deletePeopleRow(currentRows, person.index));
      setDeleteTarget(null);
    },
    [onRowsChange],
  );

  return (
    <PageTransition className="people-center">
      <section className="people-stat-grid" aria-label="人员映射统计">
        <GlassCard className="people-stat-card" as="article">
          <span>
            <UsersRound size={20} />
            人员总数
          </span>
          <strong>{stats.total}</strong>
          <small>来自真实 nameIdMap 配置</small>
        </GlassCard>
        <GlassCard className="people-stat-card muted" as="article">
          <span>
            <Fingerprint size={20} />
            状态字段
          </span>
          <strong>未提供</strong>
          <small>不展示绑定率或异常统计</small>
        </GlassCard>
        <GlassCard className="people-stat-card muted" as="article">
          <span>
            <Database size={20} />
            保存方式
          </span>
          <strong>统一配置</strong>
          <small>POST /api/config</small>
        </GlassCard>
      </section>

      <PeopleToolbar
        query={query}
        onQueryChange={setQuery}
        total={validRows.length}
        visible={filteredRows.length}
        hasUnsavedChanges={hasUnsavedChanges}
        saving={saving}
        onAdd={addPerson}
        onSave={onSave}
        onReset={onReset}
      />

      {saveState && (
        <motion.div
          className={`people-feedback ${saveState.ok ? "ok" : "error"}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
        >
          {saveState.text}
        </motion.div>
      )}

      {loading ? (
        <section className="people-loading-shell" aria-label="人员映射加载中">
          <span />
          <span />
          <span />
        </section>
      ) : filteredRows.length > 0 ? (
        <PeopleTable
          rows={paged.rows}
          page={paged.page}
          totalPages={paged.totalPages}
          onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
          onNextPage={() => setPage((current) => Math.min(paged.totalPages, current + 1))}
          onEdit={editPerson}
          onDelete={setDeleteTarget}
        />
      ) : (
        <PeopleEmptyState
          hasQuery={Boolean(query.trim())}
          canAdd
          onAdd={addPerson}
          onClear={() => setQuery("")}
        />
      )}

      <section className="people-boundary-note">
        <strong>能力边界</strong>
        <span>
          当前后端没有单条人员管理接口、状态字段或更新时间字段。新增、编辑、删除会先进入本地草稿，统一通过现有配置保存流程写入。
        </span>
      </section>

      <AnimatePresence>
        {dialogState && (
          <PersonDialog
            key={`${dialogState.mode}-${dialogState.person?.rowKey || "new"}`}
            mode={dialogState.mode}
            person={dialogState.person}
            onClose={() => setDialogState(null)}
            onSubmit={submitPerson}
          />
        )}
        {deleteTarget && (
          <DeletePersonDialog
            key={`delete-${deleteTarget.rowKey}`}
            person={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
