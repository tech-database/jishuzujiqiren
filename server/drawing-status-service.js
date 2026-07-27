import { bitableValueToText, parseBitableDateValue, plannedBitableFieldsMatch } from "./bitable-values.js";
import {
  drawingClaimTimeField,
  drawingCompleteTimeField,
  drawingDurationField,
  drawingOwnerAliases,
  drawingOwnerField,
  drawingStatuses,
  drawingStatusField,
} from "./drawing-fields.js";
import { getBitableConfig, resolveMappedOwnerName } from "./runtime-config.js";
import { getTenantAccessToken } from "./feishu-client.js";
import {
  assertAllUpdatePlansApplied,
  executeVerifiedUpdatePlans,
  getBitableFieldMap,
  listBitableRecords,
  listCachedBitableRecords,
} from "./bitable-client.js";
import { getDrawingMaterialCode } from "./drawing-record-utils.js";
import {
  bitableDateTimeValue,
  drawingDurationProjection,
  drawingStatusProjection,
  durationValue,
  filterRecordsByDateRange,
  recordFingerprint,
  resolveDrawingDurationField,
  detectDrawingStatus,
} from "./drawing-domain-utils.js";
import { replaceDrawingOwnerRosterFromRecords } from "./drawing-personnel-service.js";

const defaultDependencies = Object.freeze({
  getBitableConfig,
  resolveMappedOwnerName,
  getTenantAccessToken,
  getBitableFieldMap,
  listBitableRecords,
  listCachedBitableRecords,
  executeVerifiedUpdatePlans,
  replaceDrawingOwnerRosterFromRecords,
});

export function createDrawingStatusService(overrides = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return {
    getDrawingStatusFingerprint: (options) => getDrawingStatusFingerprint(options, dependencies),
    syncDrawingStatuses: (options) => syncDrawingStatuses(options, dependencies),
    recalculateDrawingDurations: (options) =>
      recalculateDrawingDurations(options, dependencies),
  };
}

export async function getDrawingStatusFingerprint(
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
  const records = filterRecordsByDateRange(
    await listCachedBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: drawingStatusProjection(fieldTypes),
    }),
    startDate,
    endDate,
  )
    .map(recordFingerprint)
    .sort((left, right) => left.recordId.localeCompare(right.recordId));
  return JSON.stringify(records);
}

export async function syncDrawingStatuses({
  startDate,
  endDate,
  tableKey,
  fillMissingTimestamps = true,
} = {}, dependencies = defaultDependencies) {
  const {
    getBitableConfig,
    resolveMappedOwnerName,
    getTenantAccessToken,
    getBitableFieldMap,
    listBitableRecords,
    executeVerifiedUpdatePlans,
    replaceDrawingOwnerRosterFromRecords,
  } = dependencies;
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const durationField = resolveDrawingDurationField(fieldTypes);
  const records = filterRecordsByDateRange(
    await listBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: drawingStatusProjection(fieldTypes),
    }),
    startDate,
    endDate,
  );
  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);
  if (!fieldTypes.has(drawingStatusField)) throw new Error(`数据表缺少字段：${drawingStatusField}`);

  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  const summary = {
    total: taskRecords.length,
    unclaimed: 0,
    drawing: 0,
    done: 0,
    updated: 0,
    skippedBlank: records.length - taskRecords.length,
    missingClaimTime: 0,
    missingCompleteTime: 0,
    timestampsBackfilled: 0,
    fillMissingTimestamps,
  };
  const updatePlans = [];

  for (const record of taskRecords) {
    const nextStatus = detectDrawingStatus(record.fields || {});
    const currentStatus = bitableValueToText(record.fields?.[drawingStatusField]);
    const fieldsToUpdate = {};
    if (nextStatus !== currentStatus) fieldsToUpdate[drawingStatusField] = nextStatus;

    const currentOwner = bitableValueToText(record.fields?.[drawingOwnerField]);
    const mappedOwnerName = resolveMappedOwnerName(currentOwner);
    const normalizedOwnerName = mappedOwnerName || drawingOwnerAliases[currentOwner];
    if (normalizedOwnerName) fieldsToUpdate[drawingOwnerField] = normalizedOwnerName;

    const hasOwner = Boolean(currentOwner);
    const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(record.fields?.[drawingCompleteTimeField]);
    const now = Date.now();
    if (hasOwner && !claimTime) {
      summary.missingClaimTime += 1;
      if (fillMissingTimestamps && fieldTypes.has(drawingClaimTimeField)) {
        fieldsToUpdate[drawingClaimTimeField] = bitableDateTimeValue(fieldTypes, drawingClaimTimeField, now);
        summary.timestampsBackfilled += 1;
      }
    }
    if (nextStatus === drawingStatuses.done && !completeTime) {
      summary.missingCompleteTime += 1;
      if (fillMissingTimestamps && fieldTypes.has(drawingCompleteTimeField)) {
        fieldsToUpdate[drawingCompleteTimeField] = bitableDateTimeValue(fieldTypes, drawingCompleteTimeField, now);
        summary.timestampsBackfilled += 1;
      }
    }
    const effectiveCompleteTime = completeTime || parseBitableDateValue(fieldsToUpdate[drawingCompleteTimeField]);
    if (claimTime && effectiveCompleteTime && durationField) {
      const nextDuration = durationValue(fieldTypes, durationField, claimTime, effectiveCompleteTime);
      const currentDuration = bitableValueToText(record.fields?.[durationField]);
      if (currentDuration !== String(nextDuration)) {
        fieldsToUpdate[durationField] = nextDuration;
      }
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      updatePlans.push({
        tableConfig,
        recordId: record.record_id,
        materialCode: getDrawingMaterialCode(record.fields || {}),
        fields: fieldsToUpdate,
        verify: (currentFields) =>
          plannedBitableFieldsMatch(currentFields, fieldsToUpdate, fieldTypes),
      });
    }

    if (nextStatus === drawingStatuses.unclaimed) summary.unclaimed += 1;
    else if (nextStatus === drawingStatuses.drawing) summary.drawing += 1;
    else if (nextStatus === drawingStatuses.done) summary.done += 1;
  }

  const updateOutcome = await executeVerifiedUpdatePlans(token, updatePlans);
  summary.updated = updateOutcome.applied.length;
  assertAllUpdatePlansApplied("状态检测", updateOutcome);

  const rosterRefreshed = !startDate && !endDate;
  if (rosterRefreshed) {
    replaceDrawingOwnerRosterFromRecords(tableConfig, records, dependencies);
  }
  return { table: tableConfig.key, summary, rosterRefreshed };
}

export async function recalculateDrawingDurations(
  { startDate, endDate, tableKey } = {},
  dependencies = defaultDependencies,
) {
  const {
    getBitableConfig,
    getTenantAccessToken,
    getBitableFieldMap,
    listBitableRecords,
    executeVerifiedUpdatePlans,
  } = dependencies;
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const durationField = resolveDrawingDurationField(fieldTypes);
  const records = filterRecordsByDateRange(
    await listBitableRecords(token, tableConfig, {
      startDate,
      endDate,
      fieldNames: drawingDurationProjection(fieldTypes, durationField),
    }),
    startDate,
    endDate,
  );

  if (!fieldTypes.has(drawingClaimTimeField)) throw new Error(`数据表缺少字段：${drawingClaimTimeField}`);
  if (!fieldTypes.has(drawingCompleteTimeField)) throw new Error(`数据表缺少字段：${drawingCompleteTimeField}`);
  if (!durationField) throw new Error(`数据表缺少字段：${drawingDurationField}`);

  const taskRecords = records.filter((record) => getDrawingMaterialCode(record.fields || {}));
  const summary = {
    scanned: taskRecords.length,
    eligible: 0,
    updated: 0,
    missingTime: 0,
    invalidTime: 0,
    skippedBlank: records.length - taskRecords.length,
  };
  const updatePlans = [];

  for (const record of taskRecords) {
    const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
    const completeTime = parseBitableDateValue(record.fields?.[drawingCompleteTimeField]);
    if (!claimTime || !completeTime) {
      summary.missingTime += 1;
      continue;
    }
    if (completeTime < claimTime) {
      summary.invalidTime += 1;
      continue;
    }

    summary.eligible += 1;
    const nextDuration = durationValue(fieldTypes, durationField, claimTime, completeTime);
    const currentDuration = bitableValueToText(record.fields?.[durationField]);
    if (currentDuration === String(nextDuration)) continue;

    const fieldsToUpdate = { [durationField]: nextDuration };
    updatePlans.push({
      tableConfig,
      recordId: record.record_id,
      materialCode: getDrawingMaterialCode(record.fields || {}),
      fields: fieldsToUpdate,
      verify: (currentFields) =>
        plannedBitableFieldsMatch(currentFields, fieldsToUpdate, fieldTypes),
    });
  }

  const updateOutcome = await executeVerifiedUpdatePlans(token, updatePlans);
  summary.updated = updateOutcome.applied.length;
  assertAllUpdatePlansApplied("重算用时", updateOutcome);

  return { table: tableConfig.key, summary };
}
