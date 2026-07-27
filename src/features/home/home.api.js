import { getJson } from "../../shared/api/client.js";

export function getHomeDashboard({
  startDate,
  endDate,
  includePerformance,
  forceRefresh = false,
  signal,
}) {
  const query = new URLSearchParams({
    refresh: String(Date.now()),
    startDate,
    endDate,
    includePerformance: includePerformance ? "1" : "0",
  });
  if (forceRefresh) query.set("forceRefresh", "1");
  return getJson(`/api/home-dashboard?${query.toString()}`, {
    signal,
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
}
