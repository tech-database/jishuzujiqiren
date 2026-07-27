import { getJson, postJson } from "../../shared/api/client.js";

export function syncDrawingStatuses(payload) {
  return postJson("/api/sync-drawing-statuses", payload);
}

export function recalculateDrawingDurations(payload) {
  return postJson("/api/recalculate-drawing-durations", payload);
}

export function getBackgroundSyncStatus() {
  return getJson("/api/background-status-sync");
}
