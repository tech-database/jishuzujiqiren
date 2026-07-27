import { getJson, postJson } from "../../shared/api/client.js";

export function claimDrawing(payload) {
  return postJson("/api/claim-drawing", payload);
}

export function completeDrawing(payload) {
  return postJson("/api/complete-drawing", payload);
}

export function queryUnclaimedDrawings(tableKey) {
  return postJson("/api/query-unclaimed-drawings", { tableKey });
}

export function getDrawingOwnerStats() {
  return getJson("/api/drawing-owner-stats");
}
