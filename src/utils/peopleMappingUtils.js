function normalizePeopleRows(rows = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return sourceRows.map((row, index) => {
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
  const source = row || {};
  return {
    name: String(source.name || "").trim(),
    id: String(source.id || "").trim(),
  };
}

export function validatePersonDraft(draft) {
  const source = createPersonDraft(draft);
  const errors = {};
  if (!source.name) errors.name = "请输入人员姓名";
  if (!source.id) errors.id = "请输入飞书用户 ID";
  return errors;
}

export function upsertPeopleRow(rows = [], draft, editIndex = null) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const nextRow = createPersonDraft(draft);
  if (typeof editIndex === "number" && editIndex >= 0) {
    return sourceRows.map((row, index) => (index === editIndex ? nextRow : row));
  }
  return [...sourceRows.filter((row) => row.id || row.name), nextRow];
}

export function deletePeopleRow(rows = [], deleteIndex) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const next = sourceRows.filter((_, index) => index !== deleteIndex);
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
  const sourceRows = Array.isArray(rows) ? rows : [];
  const totalPages = Math.max(1, Math.ceil(sourceRows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    rows: sourceRows.slice(start, start + pageSize),
  };
}
