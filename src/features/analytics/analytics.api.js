import { getJson } from "../../shared/api/client.js";

export function getDrawingAnalytics({ tableKey, startDate, endDate, signal }) {
  const query = new URLSearchParams({ tableKey, startDate, endDate });
  return getJson(`/api/drawing-analytics?${query.toString()}`, { signal });
}
