export function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultPerformanceRange(now = new Date()) {
  const end = new Date(now);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

export function buildTodaySummary(data) {
  const board = data?.today?.board?.summary || {};
  const paint = data?.today?.paint?.summary || {};
  const unclaimed = Number(board.unclaimed || 0) + Number(paint.unclaimed || 0);
  const drawing = Number(board.drawing || 0) + Number(paint.drawing || 0);
  const done = Number(board.done || 0) + Number(paint.done || 0);
  return {
    total: unclaimed + drawing + done,
    unclaimed,
    drawing,
    done,
  };
}
