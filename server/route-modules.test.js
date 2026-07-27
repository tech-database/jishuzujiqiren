import assert from "node:assert/strict";
import test from "node:test";
import { createDrawingRoutes } from "./drawing-routes.js";
import { createFeishuWebhookRoutes } from "./feishu-webhook-routes.js";
import { createImportRoutes } from "./import-routes.js";

function createHarness(registerRoutes) {
  const routes = new Map();
  const app = {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
  };
  registerRoutes(app);

  async function request(method, path, { body = {}, query = {}, headers = {} } = {}) {
    const handlers = routes.get(`${method} ${path}`);
    assert.ok(handlers, `missing route: ${method} ${path}`);
    const response = {
      body: null,
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    await handlers.at(-1)({ body, query, headers }, response);
    return response;
  }

  return { request, routes };
}

test("drawing routes parse material codes and preserve result counts", async () => {
  let claimInput = null;
  const harness = createHarness(
    createDrawingRoutes({
      readAdminSession: () => ({ expiresAt: Date.now() + 1000 }),
      runStatusSync: async () => ({}),
      refreshBackgroundFingerprint: async () => {},
      services: {
        claimDrawingOwners: async (input) => {
          claimInput = input;
          return [
            { materialCode: "MAT-001" },
            { materialCode: "MAT-001" },
          ];
        },
      },
    }).registerRoutes,
  );

  const response = await harness.request("POST", "/api/claim-drawing", {
    body: { text: "领图 MAT-001", senderName: "张三", tableKey: "paint" },
  });

  assert.deepEqual(claimInput.materialCodes, ["MAT-001"]);
  assert.equal(claimInput.tableKey, "paint");
  assert.equal(response.body.count, 2);
  assert.deepEqual(response.body.materialCodes, ["MAT-001"]);
});

test("drawing completion route rejects requests without an admin session", async () => {
  let completeCalls = 0;
  const harness = createHarness(
    createDrawingRoutes({
      readAdminSession: () => null,
      runStatusSync: async () => ({}),
      refreshBackgroundFingerprint: async () => {},
      services: {
        completeDrawings: async () => {
          completeCalls += 1;
          return [];
        },
      },
    }).registerRoutes,
  );

  const response = await harness.request("POST", "/api/complete-drawing", {
    body: { materialCodes: ["MAT-001"] },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(completeCalls, 0);
});

test("manual drawing sync succeeds even when fingerprint refresh fails", async () => {
  let syncInput = null;
  const harness = createHarness(
    createDrawingRoutes({
      readAdminSession: () => null,
      runStatusSync: async (reason, range) => {
        syncInput = { reason, range };
        return { summary: { updated: 2 } };
      },
      refreshBackgroundFingerprint: async () => {
        throw new Error("fingerprint unavailable");
      },
    }).registerRoutes,
  );

  const response = await harness.request("POST", "/api/sync-drawing-statuses", {
    body: { tableKey: "board", startDate: "2026-07-01" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.summary.updated, 2);
  assert.equal(syncInput.reason, "manual");
  assert.equal(syncInput.range.tableKey, "board");
});

test("spreadsheet upload validates files and reports parser warnings", async () => {
  const harness = createHarness(
    createImportRoutes({
      services: {
        parseSpreadsheetBuffer: async () => [{ 料号: "MAT-001" }],
        createBitableRecords: async () => {
          const result = [{ recordId: "record-1" }];
          result.warnings = ["图片未上传"];
          return result;
        },
      },
    }).registerRoutes,
  );

  const empty = await harness.request("POST", "/api/upload-spreadsheet", {
    body: Buffer.alloc(0),
    query: { fileName: "data.xlsx" },
  });
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.body.error, "上传文件为空");

  const uploaded = await harness.request("POST", "/api/upload-spreadsheet", {
    body: Buffer.from("file"),
    query: { fileName: "data.xlsx", tableKey: "paint" },
  });
  assert.equal(uploaded.body.table, "paint");
  assert.equal(uploaded.body.parsedCount, 1);
  assert.deepEqual(uploaded.body.warnings, ["图片未上传"]);
});

test("Feishu webhook handles verification, token rejection and successful replies", async () => {
  const previousVerificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  const previousReplyEnabled = process.env.FEISHU_REPLY_ENABLED;
  process.env.FEISHU_VERIFICATION_TOKEN = "verification-token";
  process.env.FEISHU_REPLY_ENABLED = "true";
  const replies = [];
  const harness = createHarness(
    createFeishuWebhookRoutes({
      enabled: true,
      services: {
        extractTextFromFeishuEvent: () => "写入测试",
        getTenantAccessToken: async () => "tenant-token",
        writeFromText: async () => ({ dryRun: false, count: 1 }),
        fetchFeishuJson: async (url, options) => {
          replies.push({ url, options });
          return { response: { ok: true }, data: { code: 0 } };
        },
      },
    }).registerRoutes,
  );

  try {
    const verification = await harness.request("POST", "/webhook/feishu", {
      body: { type: "url_verification", challenge: "challenge-value" },
    });
    assert.deepEqual(verification.body, { challenge: "challenge-value" });

    const rejected = await harness.request("POST", "/webhook/feishu", {
      body: { token: "wrong-token" },
    });
    assert.equal(rejected.statusCode, 401);

    const success = await harness.request("POST", "/webhook/feishu", {
      body: {
        token: "verification-token",
        event: { message: { message_id: "message-1" } },
      },
    });
    assert.equal(success.body.ok, true);
    assert.equal(replies.length, 1);
    assert.match(replies[0].url, /message-1\/reply/);
  } finally {
    if (previousVerificationToken === undefined) delete process.env.FEISHU_VERIFICATION_TOKEN;
    else process.env.FEISHU_VERIFICATION_TOKEN = previousVerificationToken;
    if (previousReplyEnabled === undefined) delete process.env.FEISHU_REPLY_ENABLED;
    else process.env.FEISHU_REPLY_ENABLED = previousReplyEnabled;
  }
});
