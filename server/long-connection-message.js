import { isTableCreateCommand } from "./bot-command-parser.js";

export function hasFileResource(message) {
  return message.resources?.some((resource) => resource.type === "file");
}

export function isMentionedMessage(message) {
  return Boolean(message.mentionedBot) || /<at\b|@\S+/.test(String(message.content || ""));
}

export function chatKey(message) {
  return message.chatId || message.senderId || "default";
}

function mentionedTextCommand(message, pattern) {
  const content = String(message.content || "").trim();
  return isMentionedMessage(message) && !hasFileResource(message) && pattern.test(content);
}

export function isActivationMessage(message) {
  const content = String(message.content || "").trim();
  return (
    isMentionedMessage(message) &&
    !hasFileResource(message) &&
    isTableCreateCommand(content)
  );
}

export function isCreateCommandAttempt(message) {
  return mentionedTextCommand(message, /新增/);
}

export function isCompletionMessage(message) {
  return mentionedTextCommand(message, /完成/);
}

export function isHelpCommand(message) {
  return mentionedTextCommand(message, /口令|帮助|help/i);
}

export function isGetIdCommand(message) {
  return mentionedTextCommand(message, /获取\s*ID|我的\s*ID/i);
}

export function isDrawingCompleteCommand(message) {
  return mentionedTextCommand(message, /绘图完成|完成图|图纸完成/);
}

export function isOrderConfirmationCommand(message) {
  return mentionedTextCommand(message, /下单确认|确认下单/);
}

export function isUnclaimedQueryCommand(message) {
  const content = String(message.content || "").trim();
  return (
    isMentionedMessage(message) &&
    !hasFileResource(message) &&
    /未领取/.test(content) &&
    /查询|统计|多少|全部/.test(content)
  );
}

export function isStatusSyncCommand(message) {
  return mentionedTextCommand(message, /状态检测|检测状态|同步状态/);
}
