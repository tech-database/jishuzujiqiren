import { getJson } from "../../shared/api/client.js";

export function getQuoteDashboard({ signal, startDate, endDate } = {}) {
  const search = new URLSearchParams();
  if (startDate) search.set("startDate", startDate);
  if (endDate) search.set("endDate", endDate);
  const query = search.size > 0 ? `?${search.toString()}` : "";
  return getJson(`/api/quote-dashboard${query}`, { signal });
}
