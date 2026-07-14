import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Edit3, Trash2, UserCheck, UserX } from "lucide-react";
import { StatusBadge } from "../design-system";
import CopyIdButton from "./CopyIdButton";

const PeopleRow = memo(function PeopleRow({ row, onEdit, onDelete }) {
  const isBound = row.status === "bound";
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <td>
        <div className="people-name-cell">
          <span className="people-avatar" aria-hidden="true">
            {row.name ? row.name.slice(0, 1).toUpperCase() : "?"}
          </span>
          <strong>{row.name || "未填写姓名"}</strong>
        </div>
      </td>
      <td>
        <div className="people-id-cell">
          <code title={row.id || "未填写飞书用户 ID"}>{row.id || "未填写"}</code>
          <CopyIdButton value={row.id} />
        </div>
      </td>
      <td>
        <StatusBadge tone={isBound ? "success" : "warning"}>
          {isBound ? (
            <>
              <UserCheck size={13} />
              已绑定
            </>
          ) : (
            <>
              <UserX size={13} />
              待完善
            </>
          )}
        </StatusBadge>
      </td>
      <td>
        <div className="people-row-actions">
          <button type="button" onClick={() => onEdit(row)} aria-label={`编辑 ${row.name || row.id || "人员映射"}`}>
            <Edit3 size={16} />
            编辑
          </button>
          <button type="button" className="danger" onClick={() => onDelete(row)} aria-label={`删除 ${row.name || row.id || "人员映射"}`}>
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </td>
    </motion.tr>
  );
});

export default function PeopleTable({ rows, page, totalPages, onPrevPage, onNextPage, onEdit, onDelete }) {
  return (
    <section className="people-table-shell" aria-label="人员身份映射表">
      <div className="people-table-scroll">
        <table className="people-table">
          <thead>
            <tr>
              <th scope="col">姓名</th>
              <th scope="col">飞书用户 ID</th>
              <th scope="col">绑定状态</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {rows.map((row) => (
                <PeopleRow key={row.rowKey} row={row} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <footer className="people-pagination">
          <span>
            第 {page} / {totalPages} 页
          </span>
          <div>
            <button type="button" onClick={onPrevPage} disabled={page <= 1}>
              上一页
            </button>
            <button type="button" onClick={onNextPage} disabled={page >= totalPages}>
              下一页
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
