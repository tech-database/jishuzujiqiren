export const FIELD_NODE_SIDE = {
  excel: "excel",
  feishu: "feishu",
};

export function normalizeFieldName(value) {
  return String(value || "").trim();
}

export function makeFieldNodeId(side, name) {
  return `${side}:${encodeURIComponent(normalizeFieldName(name))}`;
}

export function parseFieldNodeId(id) {
  const [side, encodedName = ""] = String(id || "").split(":");
  return {
    side,
    name: decodeURIComponent(encodedName),
  };
}

export function buildExcelFieldNames(bitableFields = [], fieldMappings = {}, customExcelFields = []) {
  const names = new Set();
  for (const field of bitableFields) {
    const name = normalizeFieldName(field);
    if (name) names.add(name);
  }
  for (const value of Object.values(fieldMappings || {})) {
    const name = normalizeFieldName(value);
    if (name) names.add(name);
  }
  for (const field of customExcelFields || []) {
    const name = normalizeFieldName(field);
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function fieldMappingsToEdges(fieldMappings = {}) {
  return Object.entries(fieldMappings)
    .map(([feishuField, excelField]) => {
      const sourceName = normalizeFieldName(excelField);
      const targetName = normalizeFieldName(feishuField);
      if (!sourceName || !targetName) return null;
      const source = makeFieldNodeId(FIELD_NODE_SIDE.excel, sourceName);
      const target = makeFieldNodeId(FIELD_NODE_SIDE.feishu, targetName);
      return {
        id: `mapping:${source}->${target}`,
        type: "mapping",
        source,
        target,
        sourceHandle: "excel-output",
        targetHandle: "feishu-input",
        animated: false,
        data: {
          sourceName,
          targetName,
        },
      };
    })
    .filter(Boolean);
}

export function edgesToFieldMappings(edges = [], bitableFields = []) {
  const next = Object.fromEntries((bitableFields || []).map((field) => [field, ""]));
  for (const edge of edges || []) {
    const source = parseFieldNodeId(edge.source);
    const target = parseFieldNodeId(edge.target);
    if (source.side !== FIELD_NODE_SIDE.excel || target.side !== FIELD_NODE_SIDE.feishu) continue;
    if (!next.hasOwnProperty(target.name)) continue;
    next[target.name] = source.name;
  }
  return next;
}

export function buildMappingNodes({
  bitableFields = [],
  fieldMappings = {},
  customExcelFields = [],
  existingPositions = new Map(),
}) {
  const excelNames = buildExcelFieldNames(bitableFields, fieldMappings, customExcelFields);
  const mappedExcelNames = new Set(Object.values(fieldMappings || {}).map(normalizeFieldName).filter(Boolean));

  const excelNodes = excelNames.map((name, index) => {
    const id = makeFieldNodeId(FIELD_NODE_SIDE.excel, name);
    return {
      id,
      type: "excelField",
      position: existingPositions.get(id) || { x: 0, y: index * 92 },
      data: {
        name,
        typeLabel: "接口未提供",
        sourceLabel: customExcelFields.includes(name) ? "手动添加" : "Excel",
        mapped: mappedExcelNames.has(name),
      },
    };
  });

  const feishuNodes = (bitableFields || []).map((name, index) => {
    const id = makeFieldNodeId(FIELD_NODE_SIDE.feishu, name);
    const mappedFrom = normalizeFieldName(fieldMappings?.[name]);
    return {
      id,
      type: "feishuField",
      position: existingPositions.get(id) || { x: 760, y: index * 92 },
      data: {
        name,
        typeLabel: "接口未提供",
        sourceLabel: "飞书",
        mapped: Boolean(mappedFrom),
        mappedFrom,
      },
    };
  });

  return [...excelNodes, ...feishuNodes];
}

export function findOrphanBackendMappings(backendFieldMap = {}, bitableFields = []) {
  const targetFields = new Set(bitableFields || []);
  return Object.entries(backendFieldMap || {})
    .filter(([, feishuField]) => !targetFields.has(feishuField))
    .map(([excelField, feishuField]) => ({ excelField, feishuField }));
}
