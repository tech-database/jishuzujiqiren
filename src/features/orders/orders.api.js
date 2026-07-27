import { postJson } from "../../shared/api/client.js";

export function confirmOrders(materialCodes, tableKey) {
  return postJson("/api/confirm-orders", { materialCodes, tableKey });
}
