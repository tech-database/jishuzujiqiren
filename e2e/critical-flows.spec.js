import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error(`Browser page error: ${error.stack || error.message}`));
  page.on("requestfailed", (request) => {
    console.error(`Browser request failed: ${request.url()} ${request.failure()?.errorText || ""}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`Browser console error: ${message.text()}`);
  });
});

const homeDashboard = {
  ok: true,
  checkedAt: "2026-07-27T08:00:00.000Z",
  today: {
    board: { summary: { total: 12, unclaimed: 3, drawing: 4, done: 5 } },
    paint: { summary: { total: 8, unclaimed: 2, drawing: 2, done: 4 } },
  },
  personnel: {
    summary: { total: 2, drawing: 1, idle: 1 },
    items: [
      { owner: "测试甲", status: "drawing", todayClaimed: 3, todayCompleted: 2, activeItems: [{ materialCode: "A-001" }] },
      { owner: "测试乙", status: "idle", todayClaimed: 2, todayCompleted: 2, activeItems: [] },
    ],
  },
  realtimeLogs: [],
  performance: {
    board: { summary: { total: 12, totalScore: 36, averageDuration: 18, owners: 2 }, owners: [], regions: [] },
    paint: { summary: { total: 8, totalScore: 24, averageDuration: 15, owners: 2 }, owners: [], regions: [] },
  },
};

async function mockApi(page, { authenticated = false, handlers = {} } = {}) {
  await page.route("http://127.0.0.1:4173/api/**", async (route) => {
    const url = new URL(route.request().url());
    const customHandler = handlers[url.pathname];
    if (customHandler) {
      const result = await customHandler(route.request());
      await route.fulfill({
        status: result.status || 200,
        contentType: "application/json",
        body: JSON.stringify(result.body ?? result),
      });
      return;
    }
    let body = { ok: true };
    if (url.pathname === "/api/admin/session") body = { authenticated };
    if (url.pathname === "/api/config") {
      body = {
        ok: true,
        config: {},
        status: { ready: true, fieldMap: {}, nameIdMap: {} },
      };
    }
    if (url.pathname === "/api/health") body = { ok: true, websocket: { connected: true } };
    if (url.pathname === "/api/home-dashboard") body = homeDashboard;
    if (url.pathname === "/api/drawing-analytics") {
      body = {
        ok: true,
        summary: { total: 20, totalScore: 60, averageDuration: 17, owners: 2 },
        owners: [],
        regions: [],
      };
    }
    if (url.pathname === "/api/drawing-owner-stats") {
      body = {
        ok: true,
        summary: { total: 2, drawing: 1, idle: 1 },
        items: [
          {
            owner: "测试用户",
            status: "drawing",
            todayClaimed: 1,
            todayCompleted: 0,
            activeItems: [{ materialCode: "A-001" }],
          },
        ],
      };
    }
    if (url.pathname === "/api/background-status-sync") {
      body = {
        ok: true,
        running: false,
        lastRunAt: "2026-07-27T08:00:00.000Z",
        lastResult: null,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("首页加载核心数据并可切换到命令页", async ({ page }) => {
  await mockApi(page);
  const response = await page.goto("/home");
  expect(response?.status()).toBe(200);
  expect(await page.locator("#root").count()).toBe(1);

  await expect(page.locator(".home-dashboard")).toBeVisible();
  await expect(page.getByText("测试甲")).toBeVisible();

  await page.locator('.tab-button[title="飞书口令"]').click();
  await expect(page).toHaveURL(/\/commands$/);
  await expect(page.locator(".command-center")).toBeVisible();
  await expect(page.locator(".robot-command-card")).toHaveCount(9);
});

test("数据看板会请求统计接口并显示服务端结果", async ({ page }) => {
  await mockApi(page);
  await page.goto("/analytics");

  await expect(page.locator(".analytics-center")).toBeVisible();
  await expect(page.locator(".analytics-summary-metric").first()).toContainText("20");
});

test("管理员页面在未登录时被访问门保护", async ({ page }) => {
  await mockApi(page, { authenticated: false });
  await page.goto("/connection");

  await expect(page.locator(".admin-access-dialog")).toBeVisible();
  await expect(page.locator(".connection-center")).toHaveCount(0);
});

test("领图写入流程会提交标准请求并显示成功结果", async ({ page }) => {
  let submitted;
  await mockApi(page, {
    handlers: {
      "/api/claim-drawing": async (request) => {
        submitted = request.postDataJSON();
        return {
          ok: true,
          code: "OK",
          data: { count: 1, materialCodes: ["A-001"] },
          count: 1,
          materialCodes: ["A-001"],
        };
      },
    },
  });
  await page.goto("/drawing");
  await page.getByTestId("material-code-input").fill("A-001");
  await page.getByTestId("assignee-input").fill("测试用户");
  await page.getByTestId("claim-submit").click();

  await expect(page.locator(".assignment-result-panel")).toBeVisible();
  expect(submitted).toEqual({
    materialCodes: ["A-001"],
    senderName: "测试用户",
    tableKey: "board",
  });
});

test("下单确认写入流程会去重料号并展示服务端统计", async ({ page }) => {
  let submitted;
  await mockApi(page, {
    handlers: {
      "/api/confirm-orders": async (request) => {
        submitted = request.postDataJSON();
        return {
          ok: true,
          count: 1,
          matchedCount: 1,
          alreadyConfirmedCount: 0,
          materialCodes: ["A-001"],
          missing: [],
        };
      },
    },
  });
  await page.goto("/orders");
  await page.getByTestId("material-code-input").fill("A-001\nA-001");
  await page.getByTestId("order-submit").click();

  await expect(page.locator(".assignment-result-panel")).toBeVisible();
  expect(submitted).toEqual({ materialCodes: ["A-001"], tableKey: "board" });
});

test("表格导入写入流程会发送文件内容并展示写入结果", async ({ page }) => {
  let uploadedBytes = 0;
  await mockApi(page, {
    handlers: {
      "/api/upload-spreadsheet": async (request) => {
        uploadedBytes = request.postDataBuffer()?.length || 0;
        return {
          ok: true,
          count: 1,
          parsedCount: 1,
          resultCount: 1,
          warnings: [],
        };
      },
    },
  });
  await page.goto("/upload");
  await page.getByTestId("import-file-input").setInputFiles({
    name: "drawing.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("料号\nA-001\n"),
  });
  await page.getByTestId("import-submit").click();

  await expect(page.locator(".import-result-panel")).toBeVisible();
  expect(uploadedBytes).toBeGreaterThan(0);
});

test("管理员登录后可以进入受保护的连接配置页", async ({ page }) => {
  let loginPayload;
  await mockApi(page, {
    authenticated: false,
    handlers: {
      "/api/admin/login": async (request) => {
        loginPayload = request.postDataJSON();
        return { ok: true, authenticated: true };
      },
    },
  });
  await page.goto("/connection");
  await page.locator("#admin-access-password").fill("test-password");
  await page.locator(".admin-access-submit").click();

  await expect(page.locator(".connection-management-center")).toBeVisible();
  expect(loginPayload).toEqual({ password: "test-password" });
});

test("全部页面入口均可渲染且没有页面脚本错误", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockApi(page, { authenticated: true });

  const pages = [
    ["/home", ".home-dashboard"],
    ["/connection", ".connection-management-center"],
    ["/mapping", ".mapping-studio"],
    ["/commands", ".command-center"],
    ["/people", ".people-center"],
    ["/status", ".monitoring-command-center"],
    ["/owners", ".drawing-center"],
    ["/analytics", ".analytics-center"],
    ["/upload", ".import-center"],
    ["/drawing", ".assignment-center"],
    ["/orders", ".order-confirmation-center"],
  ];

  for (const [path, selector] of pages) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator(selector), path).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
});
