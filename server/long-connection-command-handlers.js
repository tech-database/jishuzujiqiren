import {
  commandDateRange,
  commandTableKey,
  optionalCommandTableKey,
} from "./bot-command-parser.js";

export function createLongConnectionCommandHandlers({
  claimDrawingOwners,
  completeDrawings,
  confirmDrawingOrders,
  extractMaterialCodes,
  queryUnclaimedDrawings,
  sendReply,
  syncDrawingStatuses,
  logger = console,
}) {
  async function drawClaim(message) {
    const materialCodes = extractMaterialCodes(message.content);
    const result = await claimDrawingOwners({
      materialCodes,
      senderName: message.senderName,
      senderId: message.senderId,
    });
    const codes = [...new Set(result.map((item) => item.materialCode))].join("，");
    logger.info?.("drawing_owner_claimed", { codes, senderId: message.senderId });
    await sendReply(message.chatId, `领图成功：${codes}`);
  }

  async function drawingComplete(message) {
    const materialCodes = extractMaterialCodes(message.content);
    const result = await completeDrawings({
      materialCodes,
      senderName: message.senderName,
      senderId: message.senderId,
    });
    const updatedCount = result.filter((item) => item.changed).length;
    const unchangedCount = result.length - updatedCount;
    const codes = [...new Set(result.map((item) => item.materialCode))].join("，");
    const unchangedText = unchangedCount > 0
      ? `，其中 ${unchangedCount} 条原本已完成，未覆盖完成时间`
      : "";
    await sendReply(
      message.chatId,
      `绘图完成已同步：${codes}，匹配 ${result.length} 条，更新 ${updatedCount} 条${unchangedText}。`,
    );
  }

  async function orderConfirmation(message) {
    const materialCodes = extractMaterialCodes(message.content);
    const { result, missing } = await confirmDrawingOrders({
      materialCodes,
      tableKey: optionalCommandTableKey(message.content),
    });
    const updatedCount = result.filter((item) => item.changed).length;
    const unchangedCount = result.length - updatedCount;
    const codes = [...new Set(result.map((item) => item.materialCode))].join("，");
    const unchangedText = unchangedCount > 0 ? `，其中 ${unchangedCount} 条原本已确认` : "";
    const missingText = missing.length > 0 ? `；未找到：${missing.join("，")}` : "";
    await sendReply(
      message.chatId,
      `下单确认完成：${codes}，匹配 ${result.length} 条，更新 ${updatedCount} 条${unchangedText}${missingText}。`,
    );
  }

  async function unclaimedQuery(message) {
    const tableKey = optionalCommandTableKey(message.content);
    const result = await queryUnclaimedDrawings({ tableKey });
    if (tableKey) {
      const tableLabel = tableKey === "paint" ? "油漆" : "胶板";
      await sendReply(message.chatId, `${tableLabel}查询完成：共有 ${result.count} 条图纸未被领取。`);
      return;
    }
    const boardCount = result.items.filter((item) => item.table === "board").length;
    const paintCount = result.items.filter((item) => item.table === "paint").length;
    await sendReply(
      message.chatId,
      `查询完成：胶板 ${boardCount} 条，油漆 ${paintCount} 条，合计 ${result.count} 条图纸未被领取。`,
    );
  }

  async function statusSync(message) {
    const range = commandDateRange(message.content);
    const tableKey = commandTableKey(message.content);
    const result = await syncDrawingStatuses({ ...range, tableKey });
    await sendReply(
      message.chatId,
      `状态检测完成（${range.startDate} 至 ${range.endDate}）：未领取 ${result.summary.unclaimed} 个，绘图中 ${result.summary.drawing} 个，绘图完成 ${result.summary.done} 个。`,
    );
  }

  async function getId(message) {
    const senderId =
      message.senderId || message.sender?.id || message.sender?.sender_id?.open_id || "";
    await sendReply(
      message.chatId,
      senderId ? `你的飞书用户 ID：${senderId}` : "没有读取到你的飞书用户 ID。",
    );
  }

  return {
    drawClaim,
    drawingComplete,
    getId,
    orderConfirmation,
    statusSync,
    unclaimedQuery,
  };
}
