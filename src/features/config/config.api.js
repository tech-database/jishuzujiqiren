import { getJson, postJson } from "../../shared/api/client.js";

export function getConfig() {
  return getJson("/api/config");
}

export function saveConfig(data) {
  return postJson("/api/config", data);
}

export function checkConnection(tableKey) {
  return postJson("/api/check-connection", { tableKey });
}

export function getHealth() {
  return getJson("/api/health");
}
