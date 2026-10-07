import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error(`Browser page error: ${error.stack || error.message}`));
  page.on("requestfailed", (request) => {
    console.error(`Browser request failed: ${request.url()} ${request.failure()?.errorText || ""}`);
  });
});

const homeDashboard = {
  ok: true,
  checkedAt: "2026-10-07T08:00:00.000Z",
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

const quoteDashboard = {
  ok: true,
  today: { quoteCount: 0, quoteTotal: 0 },
  month: { quoteCount: 0, quoteTotal: 0, orderTotal: 0, orderCount: 0 },
  regions: [],
  businesses: [],
  officers: [],
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
    if (url.pathname === "/api/admin/session") body = { ok: true, authenticated };
    if (url.pathname === "/api/config") {
      body = {
        ok: true,
        config: {
          businessRegionMap: { 测试业务: "华南区" },
          nameIdMap: { ou_test: "测试用户" },
        },
        status: {
          ready: true,
          fieldMap: {},
          nameIdMap: { ou_test: "测试用户" },
          businessRegionMap: { 测试业务: "华南区" },
          tables: { quote: { ready: true } },
        },
      };
    }
    if (url.pathname === "/api/health") body = { ok: true, websocket: { connected: true } };
    if (url.pathname === "/api/home-dashboard") body = homeDashboard;
    if (url.pathname === "/api/quote-dashboard") body = quoteDashboard;
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
        summary: { total: 1, drawing: 1, idle: 0 },
        items: [{ owner: "测试用户", status: "drawing", activeItems: [{ materialCode: "A-001" }] }],
      };
    }
    if (url.pathname === "/api/background-status-sync") {
      body = { ok: true, running: false, lastRunAt: "2026-10-07T08:00:00.000Z", lastResult: null };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("首页和飞书口令页只展示当前 8 条口令", async ({ page }) => {
  await mockApi(page);
  await page.goto("/home");
  await expect(page.locator(".home-dashboard")).toBeVisible();
  await expect(page.getByText("测试甲")).toBeVisible();

  await page.locator('.tab-button[title="飞书口令"]').click();
  await expect(page).toHaveURL(/\/commands$/);
  await expect(page.locator(".robot-command-card")).toHaveCount(8);
  await expect(page.getByText("下单确认", { exact: true })).toHaveCount(0);
});

test("人员区域页面读取当前配置", async ({ page }) => {
  await mockApi(page, { authenticated: true });
  await page.goto("/regions");

  await expect(page.locator(".region-directory")).toBeVisible();
  await expect(page.getByText("测试业务", { exact: true })).toBeVisible();
  await expect(page.getByText("华南区", { exact: true })).toBeVisible();
});

test("报价统计页把数据新增放在批量上传之后", async ({ page }) => {
  await mockApi(page);
  await page.goto("/quotes");

  await expect(page.locator(".quote-statistics-page")).toBeVisible();
  await expect(page.getByRole("button", { name: /下单清单/ })).toBeVisible();
  const layoutOrder = await page.locator(".quote-statistics-page").evaluate((root) => {
    const upload = root.querySelector(".quote-upload-section");
    const manual = root.querySelector(".quote-data-entry-card");
    const elements = [...root.querySelectorAll("section")];
    return Boolean(upload && manual && elements.indexOf(upload) < elements.indexOf(manual));
  });
  expect(layoutOrder).toBe(true);
});

test("领图流程提交去重后的料号和人员", async ({ page }) => {
  let submitted;
  await mockApi(page, {
    handlers: {
      "/api/claim-drawing": async (request) => {
        submitted = request.postDataJSON();
        return { ok: true, count: 1, materialCodes: ["A-001"] };
      },
    },
  });
  await page.goto("/drawing");
  await page.getByTestId("material-code-input").fill("A-001\nA-001");
  await page.getByTestId("assignee-input").fill("测试用户");
  await page.getByTestId("claim-submit").click();

  await expect(page.locator(".assignment-result-panel")).toBeVisible();
  expect(submitted).toEqual({ materialCodes: ["A-001"], senderName: "测试用户", tableKey: "board" });
});

test("胶板油漆表格上传会提交文件并展示结果", async ({ page }) => {
  let uploadedBytes = 0;
  await mockApi(page, {
    handlers: {
      "/api/upload-spreadsheet": async (request) => {
        uploadedBytes = request.postDataBuffer()?.length || 0;
        return { ok: true, count: 1, parsedCount: 1, resultCount: 1, warnings: [] };
      },
    },
  });
  await page.goto("/upload");
  await page.getByTestId("import-file-input").setInputFiles({
    name: "drawing.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("业务,料号\n测试业务,A-001\n"),
  });
  await page.getByTestId("import-submit").click();

  await expect(page.locator(".import-result-panel")).toBeVisible();
  expect(uploadedBytes).toBeGreaterThan(0);
});

test("全部现有页面入口均可渲染且没有页面脚本错误", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockApi(page, { authenticated: true });

  const pages = [
    ["/quote-home", ".quote-dashboard-page"],
    ["/home", ".home-dashboard"],
    ["/connection", ".connection-management-center"],
    ["/mapping", ".mapping-studio"],
    ["/commands", ".command-center"],
    ["/people", ".people-center"],
    ["/regions", ".region-directory"],
    ["/status", ".monitoring-command-center"],
    ["/owners", ".drawing-center"],
    ["/analytics", ".analytics-center"],
    ["/quotes", ".quote-statistics-page"],
    ["/upload", ".import-center"],
    ["/drawing", ".assignment-center"],
  ];

  for (const [path, selector] of pages) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator(selector), path).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});
