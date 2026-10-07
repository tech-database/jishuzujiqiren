import { bitableValueToText } from "./bitable-values.js";
import { readBusinessRegionMap, regionForBusinessName } from "./runtime-config.js";

export const businessFieldName = "业务";
export const regionFieldName = "区域";

export function resolveBusinessRegion(
  fields = {},
  fallback = "",
  businessRegionMap = readBusinessRegionMap(),
) {
  const business = bitableValueToText(fields[businessFieldName]);
  return regionForBusinessName(business, businessRegionMap) || fallback;
}

export function applyBusinessRegion(fields = {}, businessRegionMap = readBusinessRegionMap()) {
  const business = bitableValueToText(fields[businessFieldName]);
  if (!business) {
    throw new Error("上传数据缺少“业务”，无法从人员区域匹配所属区域");
  }
  const mappedRegion = regionForBusinessName(business, businessRegionMap);
  if (!mappedRegion) {
    throw new Error(`人员区域中未找到业务“${business}”，请先新增人员区域后再上传`);
  }
  return { ...fields, [regionFieldName]: mappedRegion };
}
