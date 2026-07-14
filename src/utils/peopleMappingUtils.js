export function normalizePeopleRows(rows = []) {
  return rows.map((row, index) => {
    const id = String(row?.id || "").trim();
    const name = String(row?.name || "").trim();
    return {
      id,
      name,
      index,
      rowKey: `${id || "empty"}-${name || "person"}-${index}`,
      status: id && name ? "bound" : "incomplete",
      searchText: `${id} ${name}`.toLowerCase(),
    };
  });
}

export function getValidPeopleRows(rows = []) {
  return normalizePeopleRows(rows).filter((row) => row.id || row.name);
}

export function filterPeopleRows(rows = [], query = "") {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return rows;
  return rows.filter((row) => row.searchText.includes(keyword));
}

export function getPeopleStats(rows = []) {
  const validRows = getValidPeopleRows(rows);
  return {
    total: validRows.length,
  };
}

export function createPersonDraft(row = {}) {
  return {
    name: String(row.name || "").trim(),
    id: String(row.id || "").trim(),
  };
}

export function validatePersonDraft(draft) {
  const errors = {};
  if (!draft.name.trim()) errors.name = "请输入人员姓名";
  if (!draft.id.trim()) errors.id = "请输入飞书用户 ID";
  return errors;
}

export function upsertPeopleRow(rows = [], draft, editIndex = null) {
  const nextRow = createPersonDraft(draft);
  if (typeof editIndex === "number" && editIndex >= 0) {
    return rows.map((row, index) => (index === editIndex ? nextRow : row));
  }
  return [...rows.filter((row) => row.id || row.name), nextRow];
}

export function deletePeopleRow(rows = [], deleteIndex) {
  const next = rows.filter((_, index) => index !== deleteIndex);
  return next.length > 0 ? next : [{ id: "", name: "" }];
}

export function arePeopleRowsEqual(left = [], right = []) {
  const normalize = (rows) =>
    getValidPeopleRows(rows)
      .map((row) => `${row.id}:${row.name}`)
      .sort()
      .join("|");
  return normalize(left) === normalize(right);
}

export function getPagedRows(rows = [], page = 1, pageSize = 12) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    rows: rows.slice(start, start + pageSize),
  };
}
