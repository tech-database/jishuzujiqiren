import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createConfigRoutes, serializeEnv } from "./config-routes.js";

const runtimeConfigKeys = [
  "PORT",
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_BITABLE_APP_TOKEN",
  "FEISHU_BITABLE_TABLE_ID",
  "FEISHU_PAINT_BITABLE_APP_TOKEN",
  "FEISHU_PAINT_BITABLE_TABLE_ID",
  "FEISHU_QUOTE_BITABLE_APP_TOKEN",
  "FEISHU_QUOTE_BITABLE_TABLE_ID",
  "FIELD_MAP_JSON",
  "NAME_ID_MAP_JSON",
  "FEISHU_REPLY_ENABLED",
];

function snapshotEnvironment(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function createRouteHarness() {
  const routes = new Map();
  const app = {
    get(routePath, ...handlers) {
      routes.set(`GET ${routePath}`, handlers);
    },
    post(routePath, ...handlers) {
      routes.set(`POST ${routePath}`, handlers);
    },
  };

  async function request(method, routePath, { body = {}, headers = {} } = {}) {
    const handlers = routes.get(`${method} ${routePath}`);
    assert.ok(handlers, `missing route: ${method} ${routePath}`);
    const response = {
      body: null,
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    await handlers.at(-1)({ body, headers }, response);
    return response;
  }

  return { app, request, routes };
}

function createRoutes(overrides = {}) {
  const requireAdminAccess = () => {};
  const harness = createRouteHarness();
  createConfigRoutes({
    envPath: overrides.envPath || path.join(os.tmpdir(), "unused-config.env"),
    port: 8787,
    configWritePassword: "write-password",
    readAdminSession: overrides.readAdminSession || (() => null),
    requireAdminAccess,
    services: {
      getConfigStatus: () => ({ ready: true, nameIdMap: { 张三: "user-1" } }),
      invalidateAllFeishuCaches: () => {},
      ...overrides.services,
    },
  }).registerRoutes(harness.app);
  return { ...harness, requireAdminAccess };
}

test("config GET redacts secrets unless an admin session exists", async () => {
  const previousEnvironment = snapshotEnvironment(["FEISHU_APP_ID", "FEISHU_APP_SECRET"]);
  process.env.FEISHU_APP_ID = "visible-only-to-admin";
  process.env.FEISHU_APP_SECRET = "hidden-secret";

  try {
    const anonymous = createRoutes();
    const anonymousResponse = await anonymous.request("GET", "/api/config");
    assert.equal(anonymousResponse.body.adminAuthenticated, false);
    assert.equal(anonymousResponse.body.config.appId, "");
    assert.equal(anonymousResponse.body.config.appSecretSet, true);
    assert.deepEqual(anonymousResponse.body.config.nameIdMap, {});

    const admin = createRoutes({ readAdminSession: () => ({ expiresAt: Date.now() + 1000 }) });
    const adminResponse = await admin.request("GET", "/api/config");
    assert.equal(adminResponse.body.adminAuthenticated, true);
    assert.equal(adminResponse.body.config.appId, "visible-only-to-admin");
    assert.deepEqual(adminResponse.body.config.nameIdMap, { 张三: "user-1" });

    const postHandlers = admin.routes.get("POST /api/config");
    assert.equal(postHandlers[0], admin.requireAdminAccess);
  } finally {
    restoreEnvironment(previousEnvironment);
  }
});

test("config POST merges the existing env file and refreshes runtime config", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tech-bot-config-"));
  const envPath = path.join(tempDir, ".env");
  const previousEnvironment = snapshotEnvironment(runtimeConfigKeys);
  let invalidations = 0;
  await writeFile(envPath, "KEEP_ME='yes'\nFEISHU_APP_ID='old'\n", "utf8");

  try {
    const routes = createRoutes({
      envPath,
      services: {
        invalidateAllFeishuCaches: () => {
          invalidations += 1;
        },
      },
    });
    const response = await routes.request("POST", "/api/config", {
      body: {
        adminPassword: "write-password",
        appId: "new-app",
        appSecret: "new-secret",
        bitableAppToken: "board-app",
        bitableTableId: "board-table",
        quoteBitableAppToken: "quote-app",
        quoteBitableTableId: "quote-table",
        fieldMap: { materialCode: "料号" },
        nameIdMap: { 张三: "user-1" },
        replyEnabled: true,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(invalidations, 1);
    assert.equal(process.env.FEISHU_APP_ID, "new-app");
    const saved = await readFile(envPath, "utf8");
    assert.match(saved, /KEEP_ME='yes'/);
    assert.match(saved, /FEISHU_APP_ID='new-app'/);
    assert.match(saved, /FEISHU_QUOTE_BITABLE_APP_TOKEN='quote-app'/);
    assert.match(saved, /FEISHU_QUOTE_BITABLE_TABLE_ID='quote-table'/);
    assert.match(saved, /FEISHU_REPLY_ENABLED='true'/);
  } finally {
    restoreEnvironment(previousEnvironment);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("connection check uses injected Feishu services and returns field names", async () => {
  let requestedUrl = "";
  let requestedOptions = null;
  const routes = createRoutes({
    services: {
      getTenantAccessToken: async () => "tenant-token",
      getBitableConfig: () => ({
        key: "paint",
        appToken: "paint-app",
        tableId: "paint-table",
      }),
      fetchFeishuJson: async (url, options) => {
        requestedUrl = url;
        requestedOptions = options;
        return {
          response: { ok: true },
          data: {
            code: 0,
            data: { items: [{ field_name: "料号" }, { field_name: "状态" }] },
          },
        };
      },
    },
  });

  const response = await routes.request("POST", "/api/check-connection", {
    body: { tableKey: "paint" },
  });

  assert.equal(response.body.ok, true);
  assert.equal(response.body.table, "paint");
  assert.deepEqual(response.body.fields, ["料号", "状态"]);
  assert.match(requestedUrl, /apps\/paint-app\/tables\/paint-table\/fields/);
  assert.equal(requestedOptions.headers.Authorization, "Bearer tenant-token");
});

test("env serialization preserves quoting and escaped newlines", () => {
  assert.equal(serializeEnv({ VALUE: "line 1\nline '2'" }), "VALUE='line 1\\nline \\'2\\''\n");
});
