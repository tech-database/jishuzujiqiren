import { useMemo, useState } from "react";
import {
  Check,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { GlassButton } from "../design-system/index.js";
import { PageTransition } from "../motion/index.js";

const PAGE_SIZE = 20;

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    index,
    name: String(row?.name || "").trim(),
    region: String(row?.region || "").trim(),
  })).filter((row) => row.name || row.region);
}

function rowsEqual(left, right) {
  return JSON.stringify(normalizeRows(left).map(({ name, region }) => ({ name, region })))
    === JSON.stringify(normalizeRows(right).map(({ name, region }) => ({ name, region })));
}

export default function BusinessRegionsCenter({
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
  const [editor, setEditor] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [error, setError] = useState("");
  const normalizedRows = useMemo(() => normalizeRows(rows), [rows]);
  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return normalizedRows;
    return normalizedRows.filter((row) =>
      `${row.name} ${row.region}`.toLowerCase().includes(keyword));
  }, [normalizedRows, query]);
  const regionCount = useMemo(
    () => new Set(normalizedRows.map((row) => row.region).filter(Boolean)).size,
    [normalizedRows],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasChanges = !rowsEqual(rows, baselineRows);

  function openAdd() {
    setEditor({ index: null, name: "", region: "" });
    setError("");
  }

  function openEdit(row) {
    setEditor({ index: row.index, name: row.name, region: row.region });
    setError("");
  }

  function submitEditor(event) {
    event.preventDefault();
    const name = editor.name.trim();
    const region = editor.region.trim();
    if (!name || !region) {
      setError("姓名和区域都必须填写。");
      return;
    }
    const duplicate = normalizedRows.some((row) => row.name === name && row.index !== editor.index);
    if (duplicate) {
      setError(`人员“${name}”已存在，请直接修改原记录。`);
      return;
    }
    onRowsChange((current) => {
      const next = [...current];
      if (editor.index === null) next.push({ name, region });
      else next[editor.index] = { name, region };
      return next;
    });
    setEditor(null);
    setError("");
  }

  function deleteRow(index) {
    onRowsChange((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setDeleteIndex(null);
    setPage(1);
  }

  return (
    <PageTransition className="region-directory">
      <header className="region-directory-heading">
        <div className="region-directory-title">
          <span><MapPinned size={21} /></span>
          <div>
            <h1>人员区域</h1>
            <p>统一维护业务人员所属区域。多维表读取和后续写入均以这里的匹配结果为准。</p>
          </div>
        </div>
        <div className="region-directory-stats" aria-label="人员区域统计">
          <span><UsersRound size={16} />人员 <strong>{normalizedRows.length}</strong></span>
          <span><MapPinned size={16} />区域 <strong>{regionCount}</strong></span>
        </div>
      </header>

      <section className="region-directory-toolbar">
        <label className="region-directory-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索姓名或区域"
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜索"><X size={15} /></button>}
        </label>
        <div>
          <GlassButton type="button" onClick={openAdd}><Plus size={16} />新增人员</GlassButton>
          <GlassButton type="button" onClick={onReset} disabled={!hasChanges || saving}><RotateCcw size={16} />撤销修改</GlassButton>
          <GlassButton type="button" variant="primary" onClick={onSave} disabled={!hasChanges || saving}>
            <Save size={16} />{saving ? "保存中" : "保存配置"}
          </GlassButton>
        </div>
      </section>

      {editor && (
        <form className="region-directory-editor" onSubmit={submitEditor}>
          <strong>{editor.index === null ? "新增人员" : "修改人员"}</strong>
          <label>
            <span>姓名</span>
            <input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} autoFocus />
          </label>
          <label>
            <span>区域 / 小组</span>
            <input value={editor.region} onChange={(event) => setEditor({ ...editor, region: event.target.value })} />
          </label>
          <GlassButton type="submit" variant="primary"><Check size={16} />确认</GlassButton>
          <GlassButton type="button" onClick={() => setEditor(null)}><X size={16} />取消</GlassButton>
          {error && <small role="alert">{error}</small>}
        </form>
      )}

      {saveState && <div className={`region-directory-feedback ${saveState.ok ? "ok" : "error"}`} role="status">{saveState.text}</div>}

      <section className="region-directory-table-shell">
        {loading ? (
          <div className="region-directory-skeleton" aria-label="人员区域加载中" />
        ) : (
          <>
            <div className="region-directory-table-scroll">
              <table className="region-directory-table">
                <thead><tr><th>姓名</th><th>区域 / 小组</th><th>操作</th></tr></thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={`${row.name}-${row.index}`}>
                      <td><strong>{row.name}</strong></td>
                      <td><span className="region-directory-tag">{row.region}</span></td>
                      <td>
                        <div className="region-directory-actions">
                          <button type="button" onClick={() => openEdit(row)}><Pencil size={15} />修改</button>
                          {deleteIndex === row.index ? (
                            <>
                              <button className="danger" type="button" onClick={() => deleteRow(row.index)}><Check size={15} />确认删除</button>
                              <button type="button" onClick={() => setDeleteIndex(null)}><X size={15} />取消</button>
                            </>
                          ) : (
                            <button className="danger" type="button" onClick={() => setDeleteIndex(row.index)}><Trash2 size={15} />删除</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr><td className="region-directory-empty" colSpan="3">没有匹配的人员记录。</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="region-directory-pagination">
              <span>显示 {visibleRows.length} 条，共 {filteredRows.length} 条</span>
              <div>
                <button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
                <strong>{safePage} / {totalPages}</strong>
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button>
              </div>
            </footer>
          </>
        )}
      </section>
    </PageTransition>
  );
}
