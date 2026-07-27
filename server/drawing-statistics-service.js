import { bitableValueToText, parseBitableDateValue } from "./bitable-values.js";
import {
  drawingClaimTimeField,
  drawingCompleteTimeField,
  drawingDateField,
  drawingMaterialFields,
  drawingOwnerField,
  drawingRegionField,
  drawingScoreField,
  drawingStatuses,
  drawingStatusField,
} from "./drawing-fields.js";
import { drawingTableKeys, getBitableConfig, resolveTableKey } from "./runtime-config.js";
import { getTenantAccessToken } from "./feishu-client.js";
import {
  getBitableFieldMap,
  listCachedBitableRecords,
  listCachedRecentBitableRecords,
} from "./bitable-client.js";
import { getDrawingMaterialCode } from "./drawing-record-utils.js";
import {
  bitableValueToNumber,
  detectDrawingStatus,
  filterRecordsByDateRange,
  isBitableDateInRange,
  resolveDrawingDurationField,
} from "./drawing-domain-utils.js";

const defaultDependencies = Object.freeze({
  drawingTableKeys,
  getBitableConfig,
  resolveTableKey,
  getTenantAccessToken,
  getBitableFieldMap,
  listCachedBitableRecords,
  listCachedRecentBitableRecords,
});

export function createDrawingStatisticsService(overrides = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return {
    queryUnclaimedDrawings: (options) => queryUnclaimedDrawings(options, dependencies),
    queryHomeDashboardTable: (options) => queryHomeDashboardTable(options, dependencies),
    queryDrawingAnalytics: (options) => queryDrawingAnalytics(options, dependencies),
  };
}

export async function queryUnclaimedDrawings(
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
  const items = [];
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
    const records = await listCachedBitableRecords(token, tableConfig, {
      fieldNames: [drawingOwnerField, ...drawingMaterialFields].filter((fieldName) =>
        fieldTypes.has(fieldName),
      ),
      filterConditions: [{
        field_name: drawingOwnerField,
        operator: "isEmpty",
        value: [],
      }],
    });
    items.push(
      ...records
        .filter(
          (record) =>
            getDrawingMaterialCode(record.fields || {}) &&
            !bitableValueToText(record.fields?.[drawingOwnerField]),
        )
        .map((record) => ({
          table: tableConfig.key,
          recordId: record.record_id,
          materialCode: getDrawingMaterialCode(record.fields) || "\u672a\u586b\u6599\u53f7",
          claimed: false,
          owner: "",
          message: `${getDrawingMaterialCode(record.fields) || "\u672a\u586b\u6599\u53f7"}\u672a\u88ab\u9886\u53d6`,
        })),
    );
  }

  return {
    table: tableKey ? resolveTableKey(tableKey) : "all",
    items,
    count: items.length,
  };
}

export async function queryHomeDashboardTable(
  { startDate, endDate, tableKey } = {},
  dependencies = defaultDependencies,
) {
  const {
    getBitableConfig,
    getTenantAccessToken,
    getBitableFieldMap,
    listCachedBitableRecords,
    listCachedRecentBitableRecords,
  } = dependencies;
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const selectedFields = [
    drawingDateField,
    drawingOwnerField,
    drawingStatusField,
    drawingClaimTimeField,
    drawingCompleteTimeField,
    ...drawingMaterialFields,
  ].filter((fieldName) => fieldTypes.has(fieldName));
  const [records, recentEventRecords] = await Promise.all([
    listCachedBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: selectedFields,
    }).then((items) => filterRecordsByDateRange(items, startDate, endDate)),
    listCachedRecentBitableRecords(token, tableConfig, fieldTypes, {
      limit: 500,
      fieldNames: selectedFields,
    }),
  ]);
  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  const liveTaskRecords = recentEventRecords.filter((record) =>
    getDrawingMaterialCode(record.fields || {}),
  );
  const summary = { total: taskRecords.length, unclaimed: 0, drawing: 0, done: 0 };
  const events = [];

  for (const record of liveTaskRecords) {
    const fields = record.fields || {};
    const status = detectDrawingStatus(fields);
    const completeTime = parseBitableDateValue(fields[drawingCompleteTimeField]);

    if (status === drawingStatuses.unclaimed) summary.unclaimed += 1;
    else if (status === drawingStatuses.drawing) summary.drawing += 1;
    if (
      status === drawingStatuses.done &&
      completeTime &&
      isBitableDateInRange(completeTime, startDate, endDate)
    ) {
      summary.done += 1;
    }
  }

  for (const record of taskRecords) {
    const fields = record.fields || {};
    const owner = bitableValueToText(fields[drawingOwnerField]);
    const materialCode = getDrawingMaterialCode(fields) || "未填料号";
    const claimTime = parseBitableDateValue(fields[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(fields[drawingCompleteTimeField]);
    const createdTime = parseBitableDateValue(record.created_time);

    if (createdTime) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:created:${createdTime}`,
        time: new Date(createdTime).toISOString(),
        type: "任务",
        source: tableConfig.label,
        content: `${materialCode}进入任务队列`,
        status: "正常",
      });
    }
    if (claimTime && isBitableDateInRange(claimTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:claim:${claimTime}`,
        time: new Date(claimTime).toISOString(),
        type: "接图",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}领取 ${materialCode}`,
        status: "正常",
      });
    }
    if (completeTime && isBitableDateInRange(completeTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:complete:${completeTime}`,
        time: new Date(completeTime).toISOString(),
        type: "完成",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}完成 ${materialCode}`,
        status: "成功",
      });
    }
  }

  const taskRecordIds = new Set(taskRecords.map((record) => record.record_id));
  for (const record of liveTaskRecords) {
    if (taskRecordIds.has(record.record_id)) continue;
    const fields = record.fields || {};
    const owner = bitableValueToText(fields[drawingOwnerField]);
    const materialCode = getDrawingMaterialCode(fields) || "未填料号";
    const claimTime = parseBitableDateValue(fields[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(fields[drawingCompleteTimeField]);

    if (claimTime && isBitableDateInRange(claimTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:claim:${claimTime}`,
        time: new Date(claimTime).toISOString(),
        type: "领图",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}领取 ${materialCode}`,
        status: "正常",
      });
    }
    if (completeTime && isBitableDateInRange(completeTime, startDate, endDate)) {
      events.push({
        id: `${tableConfig.key}:${record.record_id}:complete:${completeTime}`,
        time: new Date(completeTime).toISOString(),
        type: "完成",
        source: tableConfig.label,
        content: `${owner || "绘图人员"}完成 ${materialCode}`,
        status: "成功",
      });
    }
  }

  events.sort((left, right) => Date.parse(right.time) - Date.parse(left.time));
  return {
    table: tableConfig.key,
    tableLabel: tableConfig.label,
    range: { startDate: startDate || "", endDate: endDate || "" },
    summary,
    events: events.slice(0, 12),
  };
}

export async function queryDrawingAnalytics(
  { startDate, endDate, tableKey } = {},
  dependencies = defaultDependencies,
) {
  const {
    getBitableConfig,
    getTenantAccessToken,
    getBitableFieldMap,
    listCachedBitableRecords,
  } = dependencies;
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const durationField = resolveDrawingDurationField(fieldTypes);
  const selectedFields = [
    drawingDateField,
    drawingOwnerField,
    drawingScoreField,
    drawingRegionField,
    durationField,
    ...drawingMaterialFields,
  ].filter((fieldName) => fieldName && fieldTypes.has(fieldName));
  const records = filterRecordsByDateRange(
    await listCachedBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: selectedFields,
    }),
    startDate,
    endDate,
  );

  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));

  const owners = new Map();
  const regions = new Map();
  let totalScore = 0;
  let scoredRecords = 0;
  let totalDuration = 0;
  let durationRecords = 0;

  for (const record of taskRecords) {
    const fields = record.fields || {};
    const owner = bitableValueToText(fields[drawingOwnerField]) || "未分配";
    const region = bitableValueToText(fields[drawingRegionField]) || "未填写";
    const score = bitableValueToNumber(fields[drawingScoreField]);
    const duration = durationField ? bitableValueToNumber(fields[durationField]) : null;

    if (!owners.has(owner)) {
      owners.set(owner, {
        name: owner,
        count: 0,
        score: 0,
        scoredRecords: 0,
        durationTotal: 0,
        durationRecords: 0,
      });
    }
    const ownerItem = owners.get(owner);
    ownerItem.count += 1;
    if (score !== null) {
      ownerItem.score += score;
      ownerItem.scoredRecords += 1;
      totalScore += score;
      scoredRecords += 1;
    }
    if (duration !== null) {
      ownerItem.durationTotal += duration;
      ownerItem.durationRecords += 1;
      totalDuration += duration;
      durationRecords += 1;
    }

    regions.set(region, (regions.get(region) || 0) + 1);
  }

  const ownerItems = [...owners.values()]
    .map((item) => ({
      name: item.name,
      count: item.count,
      score: Math.round(item.score * 10) / 10,
      scoredRecords: item.scoredRecords,
      averageDuration:
        item.durationRecords > 0 ? Math.round((item.durationTotal / item.durationRecords) * 10) / 10 : null,
      durationRecords: item.durationRecords,
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));

  const regionItems = [...regions.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));

  return {
    table: tableConfig.key,
    tableLabel: tableConfig.label,
    range: { startDate: startDate || "", endDate: endDate || "" },
    checkedAt: new Date().toISOString(),
    summary: {
      total: taskRecords.length,
      owners: ownerItems.filter((item) => item.name !== "未分配").length,
      regions: regionItems.filter((item) => item.name !== "未填写").length,
      totalScore: Math.round(totalScore * 10) / 10,
      scoredRecords,
      averageDuration: durationRecords > 0 ? Math.round((totalDuration / durationRecords) * 10) / 10 : null,
      durationRecords,
    },
    owners: ownerItems,
    regions: regionItems,
    fields: {
      score: fieldTypes.has(drawingScoreField),
      region: fieldTypes.has(drawingRegionField),
      duration: Boolean(durationField),
      durationField,
    },
  };
}
