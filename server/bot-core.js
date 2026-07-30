import { assertNoDuplicateMaterialCodesBeforeCreate } from "./drawing-record-utils.js";
import { createRecordImportService } from "./record-import-service.js";

export {
  ensureConfig,
  getBitableConfig,
  getConfigStatus,
} from "./runtime-config.js";
export {
  calculateTenantTokenTtlMs,
  extractTextFromFeishuEvent,
  feishuRequestTimeoutMs,
  fetchFeishuJson,
  fetchFeishuJsonWithTimeout,
  getTenantAccessToken,
  invalidateTenantAccessTokenCache,
} from "./feishu-client.js";
export {
  getActiveLegacyWorksheetName,
  parseLegacySpreadsheetBuffer,
  parseSpreadsheetBuffer,
  spreadsheetLimits,
} from "./spreadsheet-parser.js";
export {
  buildBitableRecordSearchBody,
  getBitableFieldMap,
  getFeishuCacheStatus,
  invalidateAllFeishuCaches,
  invalidateBitableRecordCache,
} from "./bitable-client.js";
export {
  calculateDurationMinutes,
} from "./drawing-domain-utils.js";
export {
  createDrawingStatusService,
  getDrawingStatusFingerprint,
  recalculateDrawingDurations,
  syncDrawingStatuses,
} from "./drawing-status-service.js";
export {
  createDrawingStatisticsService,
  queryDrawingAnalytics,
  queryHomeDashboardTable,
  queryUnclaimedDrawings,
} from "./drawing-statistics-service.js";
export {
  createDrawingPersonnelService,
  queryDrawingOwnerStats,
  refreshDrawingOwnerRoster,
} from "./drawing-personnel-service.js";
export {
  claimDrawingOwners,
  completeDrawings,
  createDrawingClaimService,
  extractMaterialCodes,
  isDrawClaimCommand,
  queryDrawingClaimStatus,
} from "./drawing-claim-service.js";
export {
  confirmDrawingOrders,
  createDrawingOrderService,
} from "./drawing-order-service.js";

const recordImportService = createRecordImportService({
  assertNoDuplicateMaterialCodesBeforeCreate,
});

export const createBitableRecords = recordImportService.createBitableRecords;
export const writeFromText = recordImportService.writeFromText;
