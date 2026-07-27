import { commandHelpText, requireCreateCommandTableKey } from "./bot-command-parser.js";
import { chineseBotErrorMessage } from "./bot-reply-language.js";
import { isDrawClaimCommand } from "./bot-core.js";
import {
  chatKey,
  hasFileResource,
  isCompletionMessage,
  isCreateCommandAttempt,
  isDrawingCompleteCommand,
  isGetIdCommand,
  isHelpCommand,
  isMentionedMessage,
  isOrderConfirmationCommand,
  isStatusSyncCommand,
  isUnclaimedQueryCommand,
} from "./long-connection-message.js";

export function createLongConnectionDispatcher({
  activationReply,
  getWebsocketStatus,
  handlers,
  logger,
  messageHistory,
  persistWebsocketStatus,
  sendReply,
  spreadsheetSessions,
}) {
  return async function dispatchLongConnectionMessage(message) {
    try {
      if (!getWebsocketStatus().connected) {
        persistWebsocketStatus({
          connected: true,
          state: "connected",
          message: "\u98de\u4e66\u957f\u8fde\u63a5\u5df2\u8fde\u63a5",
        }).catch((error) => logger.error("websocket_status_restore_failed", { error }));
      }
      logger.info("message_received", {
        messageType: message.messageType || message.type || "",
        chatId: message.chatId,
        senderId: message.senderId,
        messageId: message.messageId,
        resourceCount: message.resources?.length || 0,
        mentionedBot: Boolean(message.mentionedBot),
      });

      if (isHelpCommand(message)) return sendReply(message.chatId, commandHelpText());
      if (isGetIdCommand(message)) return handlers.getId(message);
      if (isCreateCommandAttempt(message)) {
        const tableKey = requireCreateCommandTableKey(message.content);
        spreadsheetSessions.activate(message, tableKey);
        logger.info("spreadsheet_session_started", {
          chatId: message.chatId,
          senderId: message.senderId,
          tableKey,
        });
        return sendReply(message.chatId, activationReply);
      }
      if (isMentionedMessage(message) && isDrawingCompleteCommand(message)) {
        return handlers.runOnce(message, "drawing-complete", () => handlers.drawingComplete(message));
      }
      if (isOrderConfirmationCommand(message)) {
        return handlers.runOnce(message, "order-confirmation", () => handlers.orderConfirmation(message));
      }
      if (isMentionedMessage(message) && isUnclaimedQueryCommand(message)) {
        return handlers.unclaimedQuery(message);
      }
      if (isMentionedMessage(message) && isStatusSyncCommand(message)) {
        return handlers.runOnce(message, "status-sync", () => handlers.statusSync(message));
      }
      if (isMentionedMessage(message) && isDrawClaimCommand(message.content)) {
        return handlers.runOnce(message, "draw-claim", () => handlers.drawClaim(message));
      }

      const pending = spreadsheetSessions.get(message);
      if (!pending) {
        if (isCompletionMessage(message)) {
          logger.info("spreadsheet_session_recovering", {
            chatId: message.chatId,
            senderId: message.senderId,
          });
          return handlers.spreadsheetCompletion(message, await messageHistory.recoverSession(message));
        }
        logger.info("message_ignored_without_spreadsheet_session", {
          chatId: message.chatId,
          senderId: message.senderId,
        });
        return;
      }
      if (isCompletionMessage(message)) {
        return handlers.spreadsheetCompletion(message, pending);
      }
      if (hasFileResource(message)) {
        spreadsheetSessions.queueFile(message, pending);
        logger.info("spreadsheet_file_queued", {
          chatId: message.chatId,
          senderId: message.senderId,
          fileCount: pending.files.length,
        });
        return;
      }
      logger.info("spreadsheet_session_message_ignored", {
        sessionKey: chatKey(message),
      });
    } catch (error) {
      logger.error("message_handling_failed", {
        chatId: message.chatId,
        senderId: message.senderId,
        messageId: message.messageId,
        error,
      });
      const prefix = isDrawClaimCommand(message.content) ? "领图失败：" : "操作失败：";
      await sendReply(message.chatId, `${prefix}${chineseBotErrorMessage(error)}`);
    }
  };
}
