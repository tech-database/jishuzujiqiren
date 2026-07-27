import {
  extractTextFromFeishuEvent,
  fetchFeishuJson,
  getTenantAccessToken,
} from "./feishu-client.js";
import { writeFromText } from "./bot-core.js";
import { ApiError, apiErrorCodes, sendError, successResponse } from "./api-response.js";

export function createFeishuWebhookRoutes({
  enabled,
  services = {},
} = {}) {
  const extractEventText =
    services.extractTextFromFeishuEvent || extractTextFromFeishuEvent;
  const requestFeishuJson = services.fetchFeishuJson || fetchFeishuJson;
  const loadTenantAccessToken =
    services.getTenantAccessToken || getTenantAccessToken;
  const writeMessageText = services.writeFromText || writeFromText;

  async function replyToMessage(messageId, text) {
    if (process.env.FEISHU_REPLY_ENABLED !== "true" || !messageId) return;
    const token = await loadTenantAccessToken();
    await requestFeishuJson(
      `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          msg_type: "text",
          content: JSON.stringify({ text }),
        }),
      },
    );
  }

  function registerRoutes(app) {
    app.post("/webhook/feishu", async (req, res) => {
      if (!enabled) {
        return sendError(
          res,
          new ApiError(apiErrorCodes.WEBHOOK_DISABLED, "接口未启用", { statusCode: 404 }),
          apiErrorCodes.WEBHOOK_DISABLED,
          404,
        );
      }

      const body = req.body || {};
      if (body.type === "url_verification" && body.challenge) {
        return res.json({ challenge: body.challenge });
      }

      const expectedToken = process.env.FEISHU_VERIFICATION_TOKEN;
      const incomingToken = body.token || body.header?.token;
      if (expectedToken && expectedToken !== incomingToken) {
        return sendError(
          res,
          new ApiError(apiErrorCodes.WEBHOOK_TOKEN_INVALID, "invalid verification token", {
            statusCode: 401,
          }),
          apiErrorCodes.WEBHOOK_TOKEN_INVALID,
          401,
        );
      }

      try {
        const text = extractEventText(body);
        const result = await writeMessageText(text);
        const messageId = body?.event?.message?.message_id;
        await replyToMessage(
          messageId,
          result.dryRun
            ? `已解析 ${result.count} 条记录，但系统配置不完整，未执行写入。`
            : `已成功写入 ${result.count} 条多维表记录。`,
        );
        res.json(successResponse(result));
      } catch (error) {
        const messageId = body?.event?.message?.message_id;
        await replyToMessage(messageId, `写入失败：${error.message}`);
        sendError(res, error, apiErrorCodes.WEBHOOK_PROCESSING_FAILED);
      }
    });
  }

  return { registerRoutes };
}
