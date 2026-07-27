import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const violations = [];
const notices = [];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

const sourceFiles = (await listFiles(path.join(root, "src"))).filter((file) =>
  /\.(js|jsx)$/.test(file),
);

for (const file of sourceFiles) {
  const relativePath = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/).length;

  if (relativePath !== "src/shared/api/client.js" && /\bfetch\s*\(/.test(source)) {
    violations.push(`${relativePath}: 页面和功能模块必须通过 shared API client 请求数据`);
  }
  if (relativePath === "src/main.jsx" && lines > 150) {
    violations.push(`${relativePath}: 应用入口超过 150 行，请把页面逻辑迁出入口`);
  }
  if (/components\/.+Center\.jsx$/.test(relativePath) && lines > 300) {
    notices.push(`${relativePath}: 页面超过 300 行，建议检查是否混合控制逻辑和展示`);
  }
}

const mainSource = await readFile(path.join(root, "src/main.jsx"), "utf8");
if (
  /const\s+pageController\s*=/.test(mainSource) ||
  /\.\.\.(?:config|drawing|import|monitoring)Controller/.test(mainSource)
) {
  violations.push(
    "src/main.jsx: 控制器必须按领域分组传递，禁止重新合并成扁平 pageController",
  );
}

const routeSource = await readFile(path.join(root, "src/app/routes.jsx"), "utf8");
if (/import\(\s*["']\.\.\/components\//.test(routeSource)) {
  violations.push(
    "src/app/routes.jsx: 页面路由必须指向 features/*/*Page.jsx，components 只保留展示组件",
  );
}
if (!routeSource.includes("adminOnly")) {
  violations.push("src/app/routes.jsx: 路由配置必须保留权限元数据");
}

const serverLineBudgets = new Map([
  ["server/bot-core.js", 120],
  ["server/drawing-status-service.js", 400],
  ["server/drawing-statistics-service.js", 400],
  ["server/drawing-claim-service.js", 400],
  ["server/drawing-order-service.js", 250],
  ["server/drawing-personnel-service.js", 350],
]);

for (const [relativePath, maximumLines] of serverLineBudgets) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  const lines = source.split(/\r?\n/).length;
  if (lines > maximumLines) {
    violations.push(
      `${relativePath}: ${lines} 行超过架构预算 ${maximumLines} 行，请继续按完整业务用例拆分`,
    );
  }
}

for (const notice of notices) console.warn(`NOTICE ${notice}`);
if (violations.length > 0) {
  for (const violation of violations) console.error(`ERROR ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture check passed (${sourceFiles.length} source files).`);
}
