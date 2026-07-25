export function spreadsheetSessionKey(message = {}) {
  const senderId = String(message.senderId || "").trim();
  const conversationId = String(message.chatId || senderId || "default").trim();
  return JSON.stringify([conversationId, senderId || "anonymous"]);
}
