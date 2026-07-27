import {
  parseDateBoundary,
} from "./bitable-values.js";
import { drawingDateField } from "./drawing-fields.js";
import { feishuCache, feishuCacheTtl } from "./feishu-cache.js";
import {
  feishuRequestTimeoutMs,
  fetchFeishuJson,
} from "./feishu-client.js";
import {
  getBitableConfig,
  resolveTableKey,
} from "./runtime-config.js";

export async function getBitableFieldMap(token, tableConfig = getBitableConfig()) {
  const cacheKey = `fields:${tableConfig.key}:${tableConfig.appToken}:${tableConfig.tableId}`;
  return feishuCache.get(cacheKey, {
    ttlMs: feishuCacheTtl.fields,
    loader: async () => {
      const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/fields?page_size=100`;
      const { response, data } = await fetchFeishuJson(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok || data.code !== 0) {
        throw new Error("读取飞书多维表字段失败，请稍后重试。");
      }
      return new Map((data.data?.items || []).map((field) => [field.field_name, field.type]));
    },
  });
}

export function buildBitableRecordSearchBody({
  startDate,
  endDate,
  dateFieldName = drawingDateField,
  fieldNames,
  filterConditions,
  filterConjunction = "and",
} = {}) {
  const body = {};
  if (Array.isArray(fieldNames) && fieldNames.length > 0) body.field_names = fieldNames;
  const conditions = Array.isArray(filterConditions)
    ? filterConditions
        .filter((condition) => condition?.field_name && condition?.operator)
        .map((condition) => ({ ...condition }))
    : [];
  const startTime = parseDateBoundary(startDate);
  const endTime = parseDateBoundary(endDate, true);
  if (startTime) {
    conditions.push({
      field_name: dateFieldName,
      operator: "isGreater",
      value: ["ExactDate", String(startTime - 1)],
    });
  }
  if (endTime) {
    conditions.push({
      field_name: dateFieldName,
      operator: "isLess",
      value: ["ExactDate", String(endTime + 1)],
    });
  }
  if (conditions.length > 0) {
    body.filter = {
      conjunction: filterConjunction === "or" ? "or" : "and",
      conditions,
    };
  }
  return body;
}

export async function listBitableRecords(token, tableConfig = getBitableConfig(), options = {}) {
  const records = [];
  let pageToken = "";
  const requestBody = buildBitableRecordSearchBody(options);

  do {
    const searchParams = new URLSearchParams({ page_size: "500" });
    if (pageToken) searchParams.set("page_token", pageToken);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/search?${searchParams.toString()}`;
    const { response, data } = await fetchFeishuJson(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok || data.code !== 0) {
      throw new Error("查询飞书多维表记录失败，请稍后重试。");
    }
    records.push(...(data.data?.items || []));
    pageToken = data.data?.has_more ? data.data?.page_token || "" : "";
  } while (pageToken);

  return records;
}

export async function listRecentBitableRecords(
  token,
  tableConfig = getBitableConfig(),
  fieldTypes = new Map(),
  { limit = 500, fieldNames } = {},
) {
  const searchParams = new URLSearchParams({ page_size: String(limit) });
  const requestBody = {};
  const selectedFields = Array.isArray(fieldNames)
    ? fieldNames.filter((fieldName) => fieldTypes.has(fieldName))
    : [];
  if (selectedFields.length > 0) requestBody.field_names = selectedFields;
  if (fieldTypes.has(drawingDateField)) {
    requestBody.sort = [{ field_name: drawingDateField, desc: true }];
  }
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/search?${searchParams.toString()}`;
  const { response, data } = await fetchFeishuJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("查询飞书多维表最近记录失败，请稍后重试。");
  }
  return data.data?.items || [];
}

export async function listCachedRecentBitableRecords(
  token,
  tableConfig,
  fieldTypes,
  options = {},
) {
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 500);
  const fieldKey = Array.isArray(options.fieldNames) ? options.fieldNames.join(",") : "";
  const cacheKey = `records:${tableConfig.key}:recent:${tableConfig.appToken}:${tableConfig.tableId}:${limit}:${fieldKey}`;
  return feishuCache.get(cacheKey, {
    ttlMs: feishuCacheTtl.records,
    loader: () => listRecentBitableRecords(token, tableConfig, fieldTypes, {
      ...options,
      limit,
    }),
  });
}

export async function listCachedBitableRecords(token, tableConfig = getBitableConfig(), options = {}) {
  const rangeKey = `${options.startDate || ""}:${options.endDate || ""}`;
  const dateFieldKey = options.dateFieldName || "";
  const fieldKey = Array.isArray(options.fieldNames) ? options.fieldNames.join(",") : "";
  const filterKey = Array.isArray(options.filterConditions)
    ? JSON.stringify(options.filterConditions)
    : "";
  const cacheKey = `records:${tableConfig.key}:${tableConfig.appToken}:${tableConfig.tableId}:${rangeKey}:${dateFieldKey}:${fieldKey}:${options.filterConjunction || "and"}:${filterKey}`;
  return feishuCache.get(cacheKey, {
    ttlMs: feishuCacheTtl.records,
    loader: () => listBitableRecords(token, tableConfig, options),
  });
}

export function invalidateBitableRecordCache(tableKey) {
  if (!tableKey) {
    return feishuCache.invalidatePrefix("records:");
  }
  const resolvedKey = resolveTableKey(tableKey);
  return feishuCache.invalidatePrefix(`records:${resolvedKey}:`);
}

export function invalidateAllFeishuCaches() {
  return feishuCache.clear();
}

export function getFeishuCacheStatus() {
  return {
    ...feishuCache.snapshot(),
    ttlMs: { ...feishuCacheTtl },
  };
}

export async function updateBitableRecord(token, tableConfig, recordId, fields) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/${recordId}`;
  const { response, data } = await fetchFeishuJson(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("更新飞书多维表记录失败，请稍后重试。");
  }
  invalidateBitableRecordCache(tableConfig.key);
  return data.data?.record;
}

export async function getBitableRecord(token, tableConfig, recordId) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/${recordId}`;
  const { response, data } = await fetchFeishuJson(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("读取飞书多维表记录失败，请稍后重试。");
  }
  return data.data?.record;
}

export async function updateBitableRecordBatch(token, tableConfig, plans) {
  if (plans.length === 1) {
    await updateBitableRecord(token, tableConfig, plans[0].recordId, plans[0].fields);
    return;
  }
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.appToken}/tables/${tableConfig.tableId}/records/batch_update`;
  const { response, data } = await fetchFeishuJson(url, {
    method: "POST",
    timeoutMs: feishuRequestTimeoutMs.batchWrite,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      records: plans.map((plan) => ({
        record_id: plan.recordId,
        fields: plan.fields,
      })),
    }),
  });
  if (!response.ok || data.code !== 0) {
    throw new Error("批量更新飞书多维表记录失败，请稍后重试。");
  }
  invalidateBitableRecordCache(tableConfig.key);
}

export async function executeVerifiedUpdatePlans(token, plans) {
  if (plans.length === 0) return { applied: [], failed: [], errors: [] };
  const groups = new Map();
  for (const plan of plans) {
    const group = groups.get(plan.tableConfig.key) || [];
    group.push(plan);
    groups.set(plan.tableConfig.key, group);
  }
  const tableBatches = [...groups.values()].map((group) => {
    const chunks = [];
    for (let index = 0; index < group.length; index += 500) {
      chunks.push(group.slice(index, index + 500));
    }
    return chunks;
  });

  const applied = [];
  const failed = [];
  const errors = [];
  const outcomeGroups = await Promise.all(
    tableBatches.map(async (batches) => {
      const tableOutcomes = [];
      for (const group of batches) {
        try {
          await updateBitableRecordBatch(token, group[0].tableConfig, group);
          tableOutcomes.push({ group, error: null });
        } catch (error) {
          invalidateBitableRecordCache(group[0].tableConfig.key);
          tableOutcomes.push({ group, error });
        }
      }
      return tableOutcomes;
    }),
  );
  const outcomes = outcomeGroups.flat();

  for (const outcome of outcomes) {
    if (!outcome.error) {
      applied.push(...outcome.group);
      continue;
    }
    errors.push(outcome.error.message);
    for (const plan of outcome.group) {
      try {
        const current = await getBitableRecord(token, plan.tableConfig, plan.recordId);
        if (plan.verify(current?.fields || {})) applied.push(plan);
        else failed.push(plan);
      } catch (error) {
        errors.push(error.message);
        failed.push(plan);
      }
    }
  }
  return { applied, failed, errors };
}

export function assertAllUpdatePlansApplied(actionName, outcome) {
  if (outcome.failed.length === 0) return;
  const appliedCodes = [...new Set(outcome.applied.map((plan) => plan.materialCode))];
  const failedCodes = [...new Set(outcome.failed.map((plan) => plan.materialCode))];
  const appliedText = appliedCodes.length > 0 ? `已成功：${appliedCodes.join("、")}；` : "";
  const errorText = outcome.errors[0] ? `。原因：${outcome.errors[0]}` : "";
  throw new Error(`${actionName}部分执行，${appliedText}未成功：${failedCodes.join("、")}${errorText}`);
}

