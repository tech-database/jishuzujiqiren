export const emptyConfig = {
  appId: "",
  appSecret: "",
  appSecretSet: false,
  bitableAppToken: "",
  bitableTableId: "",
  paintBitableAppToken: "",
  paintBitableTableId: "",
  quoteBitableAppToken: "",
  quoteBitableTableId: "",
  replyEnabled: false,
  nameIdMap: {},
};

export function invertFieldMap(fieldMap) {
  const result = {};
  for (const [exportTitle, bitableField] of Object.entries(fieldMap || {})) {
    if (exportTitle !== bitableField) result[bitableField] = exportTitle;
  }
  return result;
}

export function buildFieldMap(fieldMappings) {
  const result = {};
  for (const [bitableField, exportTitle] of Object.entries(fieldMappings)) {
    const trimmed = exportTitle.trim();
    if (trimmed && trimmed !== bitableField) result[trimmed] = bitableField;
  }
  return result;
}

export function normalizeNameIdMap(source) {
  let value = source;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => [String(item?.id || item?.userId || "").trim(), String(item?.name || "").trim()])
        .filter(([id, name]) => id && name),
    );
  }

  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([id, name]) => [String(id || "").trim(), String(name || "").trim()])
      .filter(([id, name]) => id && name),
  );
}

export function mapToNameIdRows(nameIdMap) {
  const rows = Object.entries(normalizeNameIdMap(nameIdMap)).map(([id, name]) => ({ id, name }));
  return rows.length > 0 ? rows : [{ id: "", name: "" }];
}

export function buildNameIdMap(rows) {
  const result = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = String(row?.id || "").trim();
    const name = String(row?.name || "").trim();
    if (id && name) result[id] = name;
  }
  return result;
}
