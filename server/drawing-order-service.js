import { drawingMaterialFields, drawingOrderField } from "./drawing-fields.js";
import { drawingTableKeys, getBitableConfig } from "./runtime-config.js";
import { getTenantAccessToken } from "./feishu-client.js";
import {
  assertAllUpdatePlansApplied,
  executeVerifiedUpdatePlans,
  getBitableFieldMap,
  listBitableRecords,
} from "./bitable-client.js";
import {
  assertUniqueMatchedItemsAcrossTables,
  isOrderConfirmed,
  matchDrawingRecordsByMaterialCodes,
  normalizeMaterialCodes,
  orderConfirmedValue,
} from "./drawing-record-utils.js";

const defaultDependencies = Object.freeze({
  drawingTableKeys,
  getBitableConfig,
  getTenantAccessToken,
  getBitableFieldMap,
  listBitableRecords,
  executeVerifiedUpdatePlans,
});

export function createDrawingOrderService(overrides = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return {
    confirmDrawingOrders: (options) => confirmDrawingOrders(options, dependencies),
  };
}

export async function confirmDrawingOrders(
  { materialCodes, tableKey },
  dependencies = defaultDependencies,
) {
  const {
    drawingTableKeys,
    getBitableConfig,
    getTenantAccessToken,
    getBitableFieldMap,
    listBitableRecords,
    executeVerifiedUpdatePlans,
  } = dependencies;
  let codes;
  try {
    codes = normalizeMaterialCodes(materialCodes);
  } catch {
    throw new Error("缺少料号，请输入需要确认下单的料号");
  }

  const foundCodes = new Set();
  const matchedItems = [];
  const token = await getTenantAccessToken();
  let eligibleTableCount = 0;
  for (const key of drawingTableKeys(tableKey)) {
    let tableConfig;
    try {
      tableConfig = getBitableConfig(key);
    } catch (error) {
      if (tableKey) throw error;
      continue;
    }
    const fieldTypes = await getBitableFieldMap(token, tableConfig);
    if (!fieldTypes.has(drawingOrderField)) {
      if (tableKey) throw new Error(`${tableConfig.label}表缺少“${drawingOrderField}”字段`);
      continue;
    }
    eligibleTableCount += 1;

    const orderProjection = [
      ...drawingMaterialFields,
      drawingOrderField,
    ].filter((fieldName) => fieldTypes.has(fieldName));
    const { matchedRecords } = matchDrawingRecordsByMaterialCodes(
      await listBitableRecords(token, tableConfig, {
        fieldNames: orderProjection,
      }),
      codes,
    );
    for (const item of matchedRecords) {
      if (item.records.length === 0) continue;
      foundCodes.add(item.materialCode);
      matchedItems.push({ ...item, fieldTypes, tableConfig });
    }
  }

  if (eligibleTableCount === 0) {
    throw new Error(`已配置的数据表均缺少“${drawingOrderField}”字段`);
  }

  const missing = codes.filter((code) => !foundCodes.has(code));
  if (matchedItems.length === 0) throw new Error(`未找到料号：${missing.join("，")}`);
  assertUniqueMatchedItemsAcrossTables(matchedItems, "下单确认");

  const result = [];
  const plans = [];
  for (const item of matchedItems) {
    const fieldType = item.fieldTypes.get(drawingOrderField);
    for (const record of item.records) {
      const alreadyConfirmed = isOrderConfirmed(record.fields?.[drawingOrderField]);
      if (!alreadyConfirmed) {
        plans.push({
          tableConfig: item.tableConfig,
          recordId: record.record_id,
          materialCode: item.materialCode,
          fields: { [drawingOrderField]: orderConfirmedValue(fieldType) },
          verify: (currentFields) => isOrderConfirmed(currentFields?.[drawingOrderField]),
        });
      }
      result.push({
        table: item.tableConfig.key,
        recordId: record.record_id,
        materialCode: item.materialCode,
        changed: !alreadyConfirmed,
      });
    }
  }
  const outcome = await executeVerifiedUpdatePlans(token, plans);
  assertAllUpdatePlansApplied("下单确认", outcome);
  return { result, missing };
}
