import { formatShanghaiDate } from "./date-range.js";
import { bitableValueToText } from "./bitable-values.js";
import {
  drawingClaimTimeField,
  drawingCompleteTimeField,
  drawingMaterialField,
  drawingMaterialFields,
  drawingOwnerAliases,
  drawingOwnerField,
  drawingStatuses,
  drawingStatusField,
} from "./drawing-fields.js";
import {
  drawingTableKeys,
  getBitableConfig,
  resolveMappedOwnerName,
  resolveTableKey,
} from "./runtime-config.js";
import { getTenantAccessToken } from "./feishu-client.js";
import { getBitableFieldMap, listBitableRecords, listCachedBitableRecords } from "./bitable-client.js";
import { getDrawingMaterialCode } from "./drawing-record-utils.js";
import { detectDrawingStatus, isBitableDateOnShanghaiDay } from "./drawing-domain-utils.js";

const drawingOwnerRosterByTable = new Map();
const drawingOwnerRosterLoads = new Map();
const defaultDependencies = Object.freeze({
  drawingTableKeys,
  getBitableConfig,
  resolveMappedOwnerName,
  resolveTableKey,
  getTenantAccessToken,
  getBitableFieldMap,
  listBitableRecords,
  listCachedBitableRecords,
});

export function createDrawingPersonnelService(overrides = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return {
    addDrawingOwnerToRoster,
    replaceDrawingOwnerRosterFromRecords: (tableConfig, records) =>
      replaceDrawingOwnerRosterFromRecords(tableConfig, records, dependencies),
    ensureDrawingOwnerRosterTable: (token, tableConfig, force) =>
      ensureDrawingOwnerRosterTable(token, tableConfig, force, dependencies),
    refreshDrawingOwnerRoster: (options) => refreshDrawingOwnerRoster(options, dependencies),
    queryDrawingOwnerStats: (options) => queryDrawingOwnerStats(options, dependencies),
  };
}

export function addDrawingOwnerToRoster(tableKey, owner, incrementOwned = false) {
  const normalizedOwner = String(owner || "").trim();
  const roster = drawingOwnerRosterByTable.get(tableKey);
  if (!normalizedOwner || !roster) return;
  const currentCount = roster.owners.get(normalizedOwner) || 0;
  roster.owners.set(normalizedOwner, currentCount + (incrementOwned ? 1 : 0));
}

export function replaceDrawingOwnerRosterFromRecords(
  tableConfig,
  records,
  dependencies = defaultDependencies,
) {
  const { resolveMappedOwnerName } = dependencies;
  const owners = new Map();
  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  for (const record of taskRecords) {
    const currentOwner = bitableValueToText(record.fields?.[drawingOwnerField]);
    const owner =
      resolveMappedOwnerName(currentOwner) ||
      drawingOwnerAliases[currentOwner] ||
      currentOwner;
    if (!owner) continue;
    owners.set(owner, (owners.get(owner) || 0) + 1);
  }
  const roster = {
    owners,
    totalRecords: taskRecords.length,
    refreshedAt: new Date().toISOString(),
  };
  drawingOwnerRosterByTable.set(tableConfig.key, roster);
  return roster;
}

async function loadDrawingOwnerRosterTable(token, tableConfig, dependencies = defaultDependencies) {
  const { getBitableFieldMap, listBitableRecords } = dependencies;
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  if (!fieldTypes.has(drawingMaterialField)) {
    throw new Error(`数据表缺少字段：${drawingMaterialField}`);
  }
  if (!fieldTypes.has(drawingOwnerField)) {
    throw new Error(`数据表缺少字段：${drawingOwnerField}`);
  }
  const records = await listBitableRecords(token, tableConfig, {
    fieldNames: [drawingOwnerField, ...drawingMaterialFields].filter((fieldName) =>
      fieldTypes.has(fieldName),
    ),
  });
  return replaceDrawingOwnerRosterFromRecords(tableConfig, records, dependencies);
}

export async function ensureDrawingOwnerRosterTable(
  token,
  tableConfig,
  force = false,
  dependencies = defaultDependencies,
) {
  if (!force && drawingOwnerRosterByTable.has(tableConfig.key)) {
    return drawingOwnerRosterByTable.get(tableConfig.key);
  }
  if (drawingOwnerRosterLoads.has(tableConfig.key)) {
    return drawingOwnerRosterLoads.get(tableConfig.key);
  }
  const load = loadDrawingOwnerRosterTable(token, tableConfig, dependencies).finally(() => {
    drawingOwnerRosterLoads.delete(tableConfig.key);
  });
  drawingOwnerRosterLoads.set(tableConfig.key, load);
  return load;
}

export async function refreshDrawingOwnerRoster(
  { tableKey } = {},
  dependencies = defaultDependencies,
) {
  const { drawingTableKeys, getBitableConfig, getTenantAccessToken } = dependencies;
  const token = await getTenantAccessToken();
  const items = [];
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const roster = await ensureDrawingOwnerRosterTable(token, tableConfig, true, dependencies);
    items.push({
      table: tableConfig.key,
      owners: roster.owners.size,
      totalRecords: roster.totalRecords,
      refreshedAt: roster.refreshedAt,
    });
  }
  return { items };
}

export async function queryDrawingOwnerStats(
  { tableKey } = {},
  dependencies = defaultDependencies,
) {
  const {
    drawingTableKeys,
    getBitableConfig,
    resolveTableKey,
    getTenantAccessToken,
    getBitableFieldMap,
    listCachedBitableRecords,
  } = dependencies;
  const token = await getTenantAccessToken();
  const owners = new Map();
  const today = formatShanghaiDate();
  let totalRecords = 0;

  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
    if (!fieldTypes.has(drawingStatusField)) throw new Error(`数据表缺少字段：${drawingStatusField}`);

    const roster = await ensureDrawingOwnerRosterTable(token, tableConfig, false, dependencies);
    totalRecords += roster.totalRecords;
    for (const [owner, totalOwned] of roster.owners) {
      if (!owners.has(owner)) {
        owners.set(owner, {
          owner,
          status: "idle",
          drawingCount: 0,
          todayClaimed: 0,
          todayCompleted: 0,
          totalOwned: 0,
          activeItems: [],
        });
      }
      owners.get(owner).totalOwned += totalOwned;
    }

    const selectedFields = [
      drawingOwnerField,
      drawingStatusField,
      drawingClaimTimeField,
      drawingCompleteTimeField,
      ...drawingMaterialFields,
    ].filter((fieldName) => fieldTypes.has(fieldName));
    const filterConditions = [{
      field_name: drawingStatusField,
      operator: "is",
      value: [drawingStatuses.drawing],
    }];
    if (fieldTypes.has(drawingClaimTimeField)) {
      filterConditions.push({
        field_name: drawingClaimTimeField,
        operator: "contains",
        value: [today],
      });
    }
    if (fieldTypes.has(drawingCompleteTimeField)) {
      filterConditions.push({
        field_name: drawingCompleteTimeField,
        operator: "contains",
        value: [today],
      });
    }
    const liveRecords = await listCachedBitableRecords(token, tableConfig, {
      fieldNames: selectedFields,
      filterConditions,
      filterConjunction: "or",
    });

    const getOwnerItem = (fields) => {
      const owner = bitableValueToText(fields?.[drawingOwnerField]);
      if (!owner) return null;
      if (!owners.has(owner)) {
        owners.set(owner, {
          owner,
          status: "idle",
          drawingCount: 0,
          todayClaimed: 0,
          todayCompleted: 0,
          totalOwned: 0,
          activeItems: [],
        });
      }
      return owners.get(owner);
    };

    for (const record of liveRecords) {
      const fields = record.fields || {};
      if (!getDrawingMaterialCode(fields)) continue;
      const item = getOwnerItem(fields);
      if (!item) continue;
      if (detectDrawingStatus(fields) === drawingStatuses.drawing) {
        const materialCode = getDrawingMaterialCode(fields) || "\u672a\u586b\u6599\u53f7";
        item.drawingCount += 1;
        item.activeItems.push({
          table: tableConfig.key,
          recordId: record.record_id,
          materialCode,
        });
      }
      if (isBitableDateOnShanghaiDay(fields[drawingClaimTimeField], today)) {
        item.todayClaimed += 1;
      }
      if (isBitableDateOnShanghaiDay(fields[drawingCompleteTimeField], today)) {
        item.todayCompleted += 1;
      }
    }
  }

  const items = [...owners.values()]
    .map((item) => ({
      ...item,
      status: item.drawingCount > 0 ? "drawing" : "idle",
    }))
    .sort(
      (left, right) =>
        right.drawingCount - left.drawingCount ||
        right.todayClaimed - left.todayClaimed ||
        right.todayCompleted - left.todayCompleted ||
        left.owner.localeCompare(right.owner, "zh-CN"),
    );

  return {
    table: tableKey ? resolveTableKey(tableKey) : "all",
    checkedAt: new Date().toISOString(),
    totalRecords,
    summary: {
      owners: items.length,
      idle: items.filter((item) => item.status === "idle").length,
      drawing: items.filter((item) => item.status === "drawing").length,
      drawingCount: items.reduce((sum, item) => sum + item.drawingCount, 0),
      todayClaimed: items.reduce((sum, item) => sum + item.todayClaimed, 0),
      todayCompleted: items.reduce((sum, item) => sum + item.todayCompleted, 0),
    },
    items,
  };
}
