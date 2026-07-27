import { bitableValueToText, parseBitableDateValue } from "./bitable-values.js";
import {
  drawingClaimTimeField,
  drawingCompleteTimeField,
  drawingOwnerAliases,
  drawingOwnerField,
  drawingStatuses,
  drawingStatusField,
} from "./drawing-fields.js";
import {
  drawingTableKeys,
  getBitableConfig,
  readNameIdMap,
  resolveDrawingOwnerValue,
  resolveMappedOwnerName,
} from "./runtime-config.js";
import { getTenantAccessToken } from "./feishu-client.js";
import {
  assertAllUpdatePlansApplied,
  executeVerifiedUpdatePlans,
  getBitableFieldMap,
  listRecentBitableRecords,
} from "./bitable-client.js";
import {
  assertSingleMatchedRecordPerCode,
  assertUniqueMatchedItemsAcrossTables,
  matchDrawingRecordsByMaterialCodes,
  normalizeMaterialCodes,
} from "./drawing-record-utils.js";
import {
  bitableDateTimeValue,
  durationValue,
  resolveDrawingDurationField,
} from "./drawing-domain-utils.js";
import { addDrawingOwnerToRoster } from "./drawing-personnel-service.js";

const defaultDependencies = Object.freeze({
  drawingTableKeys,
  getBitableConfig,
  readNameIdMap,
  resolveDrawingOwnerValue,
  resolveMappedOwnerName,
  getTenantAccessToken,
  getBitableFieldMap,
  listRecentBitableRecords,
  executeVerifiedUpdatePlans,
  addDrawingOwnerToRoster,
});

export function createDrawingClaimService(overrides = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return {
    queryDrawingClaimStatus: (options) => queryDrawingClaimStatus(options, dependencies),
    claimDrawingOwners: (options) => claimDrawingOwners(options, dependencies),
    completeDrawings: (options) => completeDrawings(options, dependencies),
  };
}

export function isDrawClaimCommand(text) {
  return String(text || "").includes("\u9886\u56fe");
}

function cleanDrawingCommandText(text) {
  return String(text || "")
    .replace(/<at\b[^>]*>.*?<\/at>/g, " ")
    .replace(/@\S+/g, " ")
    .replace(/\u9886\u56fe/g, " ")
    .replace(/\u7ed8\u56fe\u5b8c\u6210|\u5b8c\u6210\u56fe|\u56fe\u7eb8\u5b8c\u6210/g, " ")
    .replace(/\u4e0b\u5355\u786e\u8ba4|\u786e\u8ba4\u4e0b\u5355/g, " ")
    .trim();
}

export function extractMaterialCodes(text) {
  const tokens = cleanDrawingCommandText(text)
    .split(/[\s,\uFF0C\u3001\u3002;\uFF1B|/\\]+/)
    .map((token) =>
      token
        .replace(/^(?:\u4e0b\u5355\u5efa\u6599\u53f7|\u6599\u53f7|\u5efa\u6599\u53f7|\u56fe\u53f7)[:\uFF1A=]?/u, "")
        .replace(/^[\x5B\x5D()\uFF08\uFF09\u3010\u3011"'“”‘’]+|[\x5B\x5D()\uFF08\uFF09\u3010\u3011"'“”‘’]+$/g, "")
        .trim(),
    )
    .filter((token) => /[A-Za-z0-9]/.test(token));
  return [...new Set(tokens)];
}

export async function queryDrawingClaimStatus(
  { materialCodes, tableKey },
  dependencies = defaultDependencies,
) {
  const {
    getBitableConfig,
    getTenantAccessToken,
    getBitableFieldMap,
    listRecentBitableRecords,
  } = dependencies;
  const codes = normalizeMaterialCodes(materialCodes);
  const token = await getTenantAccessToken();
  const tableConfig = getBitableConfig(tableKey);
  const fieldTypes = await getBitableFieldMap(token, tableConfig);
  const records = await listRecentBitableRecords(token, tableConfig, fieldTypes);
  if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);

  const { matchedRecords, missing } = matchDrawingRecordsByMaterialCodes(records, codes);
  const items = matchedRecords.flatMap((item) =>
    item.records.map((record) => {
      const owner = bitableValueToText(record.fields?.[drawingOwnerField]);
      return {
        materialCode: item.materialCode,
        recordId: record.record_id,
        owner,
        claimed: Boolean(owner),
        message: owner
          ? `${item.materialCode}\u5df2\u88ab${owner}\u9886\u53d6`
          : `${item.materialCode}\u672a\u88ab\u9886\u53d6`,
      };
    }),
  );
  return {
    table: tableConfig.key,
    items,
    missing,
    unclaimed: items.filter((item) => !item.claimed),
    claimed: items.filter((item) => item.claimed),
  };
}

export async function claimDrawingOwners(
  { materialCodes, senderName, senderId, tableKey },
  dependencies = defaultDependencies,
) {
  const {
    drawingTableKeys,
    getBitableConfig,
    resolveDrawingOwnerValue,
    resolveMappedOwnerName,
    getTenantAccessToken,
    getBitableFieldMap,
    listRecentBitableRecords,
    executeVerifiedUpdatePlans,
    addDrawingOwnerToRoster,
  } = dependencies;
  let codes;
  try {
    codes = normalizeMaterialCodes(materialCodes);
  } catch {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u6309\u683c\u5f0f\u53d1\u9001\uff1a@\u673a\u5668\u4eba I-089F-K42 \u9886\u56fe");
  }

  const claimedByCode = new Map();
  const unclaimedItems = [];
  const foundCodes = new Set();
  const token = await getTenantAccessToken();
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    const records = await listRecentBitableRecords(token, tableConfig, fieldTypes);
    if (!fieldTypes.has(drawingOwnerField)) throw new Error(`数据表缺少字段：${drawingOwnerField}`);

    const remainingCodes = codes.filter((code) => !foundCodes.has(code));
    if (remainingCodes.length === 0) break;
    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(records, remainingCodes);
    assertSingleMatchedRecordPerCode(matchedRecords, `${tableConfig.label}领图`);
    for (const item of matchedRecords) {
      if (item.records.length === 0) continue;
      foundCodes.add(item.materialCode);
      const unclaimedRecords = [];
      for (const record of item.records) {
        const currentOwner = bitableValueToText(record.fields?.[drawingOwnerField]);
        if (currentOwner) claimedByCode.set(item.materialCode, currentOwner);
        else unclaimedRecords.push(record);
      }
      if (unclaimedRecords.length > 0) {
        unclaimedItems.push({ materialCode: item.materialCode, records: unclaimedRecords, fieldTypes, tableConfig });
      }
    }
  }
  const missing = codes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) throw new Error(`未找到料号：${missing.join("，")}`);

  if (claimedByCode.size > 0) {
    const details = [...claimedByCode.entries()]
      .map(([materialCode, owner]) => `${materialCode}(\u5df2\u88ab${owner}\u9886\u53d6)`)
      .join("\uFF0C");
    throw new Error(`${details}\uFF0C\u4e0d\u53ef\u91cd\u590d\u9886\u53d6`);
  }

  const now = Date.now();
  const plans = [];
  for (const item of unclaimedItems) {
    const ownerType = item.fieldTypes.get(drawingOwnerField);
    const ownerValue = resolveDrawingOwnerValue(senderName, senderId, ownerType);
    for (const record of item.records) {
      const fields = { [drawingOwnerField]: ownerValue };
      if (item.fieldTypes.has(drawingStatusField)) fields[drawingStatusField] = drawingStatuses.drawing;
      if (item.fieldTypes.has(drawingClaimTimeField)) {
        fields[drawingClaimTimeField] = bitableDateTimeValue(item.fieldTypes, drawingClaimTimeField, now);
      }
      const expectedOwner = normalizedDrawingOwnerIdentity(ownerValue);
      plans.push({
        tableConfig: item.tableConfig,
        recordId: record.record_id,
        materialCode: item.materialCode,
        fields,
        ownerValue,
        verify: (currentFields) =>
          normalizedDrawingOwnerIdentity(currentFields?.[drawingOwnerField]) === expectedOwner,
      });
    }
  }
  const outcome = await executeVerifiedUpdatePlans(token, plans);
  for (const plan of outcome.applied) {
      const ownerText = bitableValueToText(plan.ownerValue);
      addDrawingOwnerToRoster(
        plan.tableConfig.key,
        resolveMappedOwnerName(ownerText) || ownerText,
        true,
      );
  }
  assertAllUpdatePlansApplied("领图", outcome);
  return plans.map((plan) => ({
    table: plan.tableConfig.key,
    recordId: plan.recordId,
    materialCode: plan.materialCode,
  }));
}

function normalizedDrawingOwnerIdentity(value) {
  const text = bitableValueToText(value);
  return resolveMappedOwnerName(text) || drawingOwnerAliases[text] || text;
}

export async function completeDrawings({
  materialCodes,
  tableKey,
  senderName,
  senderId,
  allowOwnerOverride = false,
}, dependencies = defaultDependencies) {
  const {
    drawingTableKeys,
    getBitableConfig,
    readNameIdMap,
    getTenantAccessToken,
    getBitableFieldMap,
    listRecentBitableRecords,
    executeVerifiedUpdatePlans,
  } = dependencies;
  let codes;
  try {
    codes = normalizeMaterialCodes(materialCodes);
  } catch {
    throw new Error("\u7f3a\u5c11\u6599\u53f7\uff0c\u8bf7\u8f93\u5165\u9700\u8981\u6807\u8bb0\u5b8c\u6210\u7684\u6599\u53f7");
  }

  const foundCodes = new Set();
  const matchedItems = [];
  const token = await getTenantAccessToken();
  for (const key of drawingTableKeys(tableKey)) {
    const tableConfig = getBitableConfig(key);
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    const durationField = resolveDrawingDurationField(fieldTypes);
    const records = await listRecentBitableRecords(token, tableConfig, fieldTypes);
    if (!fieldTypes.has(drawingStatusField)) throw new Error(`数据表缺少字段：${drawingStatusField}`);

    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(records, codes);
    for (const item of matchedRecords) {
      if (item.records.length === 0) continue;
      foundCodes.add(item.materialCode);
      matchedItems.push({ ...item, fieldTypes, durationField, tableConfig });
    }
  }
  const missing = codes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) throw new Error(`未找到料号：${missing.join("，")}`);
  assertUniqueMatchedItemsAcrossTables(matchedItems, "图纸完成");

  const cleanSenderId = String(senderId || "").trim();
  const actor = normalizedDrawingOwnerIdentity(
    (cleanSenderId && readNameIdMap()[cleanSenderId]) ||
      String(senderName || "").trim() ||
      cleanSenderId,
  );
  const candidates = matchedItems.flatMap((item) =>
    item.records.map((record) => ({ ...item, records: undefined, record })),
  );
  const validationErrors = [];
  for (const item of candidates) {
    if (bitableValueToText(item.record.fields?.[drawingStatusField]) === drawingStatuses.done) {
      continue;
    }
    const owner = normalizedDrawingOwnerIdentity(item.record.fields?.[drawingOwnerField]);
    if (!owner) {
      validationErrors.push(`${item.materialCode}尚未领图，请先领图`);
      continue;
    }
    if (!allowOwnerOverride && (!actor || actor !== owner)) {
      validationErrors.push(`${item.materialCode}由${owner}领取，只有领取人本人可以完成`);
    }
  }
  if (validationErrors.length > 0) throw new Error(validationErrors.join("；"));

  const result = [];
  const plans = [];
  for (const item of matchedItems) {
    for (const record of item.records) {
      if (bitableValueToText(record.fields?.[drawingStatusField]) === drawingStatuses.done) {
        result.push({
          table: item.tableConfig.key,
          recordId: record.record_id,
          materialCode: item.materialCode,
          changed: false,
          alreadyCompleted: true,
          owner: normalizedDrawingOwnerIdentity(record.fields?.[drawingOwnerField]),
          adminOverride: false,
        });
        continue;
      }
      const now = Date.now();
      const fields = {
        [drawingStatusField]: drawingStatuses.done,
      };
      if (item.fieldTypes.has(drawingCompleteTimeField)) {
        fields[drawingCompleteTimeField] = bitableDateTimeValue(item.fieldTypes, drawingCompleteTimeField, now);
      }
      const claimTime = parseBitableDateValue(record.fields?.[drawingClaimTimeField]);
      if (claimTime && item.durationField) {
        fields[item.durationField] = durationValue(
          item.fieldTypes,
          item.durationField,
          claimTime,
          now,
        );
      }
      const plan = {
        tableConfig: item.tableConfig,
        recordId: record.record_id,
        materialCode: item.materialCode,
        fields,
        verify: (currentFields) =>
          bitableValueToText(currentFields?.[drawingStatusField]) === drawingStatuses.done,
        result: {
          table: item.tableConfig.key,
          recordId: record.record_id,
          materialCode: item.materialCode,
          changed: true,
          alreadyCompleted: false,
          owner: normalizedDrawingOwnerIdentity(record.fields?.[drawingOwnerField]),
          adminOverride: allowOwnerOverride,
        },
      };
      plans.push(plan);
      result.push(plan.result);
    }
  }
  const outcome = await executeVerifiedUpdatePlans(token, plans);
  assertAllUpdatePlansApplied("图纸完成", outcome);
  return result;
}
