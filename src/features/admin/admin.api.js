import { getJson, postJson } from "../../shared/api/client.js";

export function getAdminSession() {
  return getJson("/api/admin/session");
}

export function loginAdmin(password) {
  return postJson("/api/admin/login", { password });
}

export function logoutAdmin() {
  return postJson("/api/admin/logout");
}
