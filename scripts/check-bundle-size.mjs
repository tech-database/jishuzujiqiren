import fs from "node:fs";
import path from "node:path";

const assetsDir = path.join(process.cwd(), "dist", "assets");
if (!fs.existsSync(assetsDir)) throw new Error("dist/assets 不存在，请先运行 npm run build");

const budgets = {
  css: 260 * 1024,
  js: 420 * 1024,
};
const assets = fs.readdirSync(assetsDir).map((name) => ({
  name,
  bytes: fs.statSync(path.join(assetsDir, name)).size,
}));
const oversized = assets.filter((asset) => {
  if (asset.name.endsWith(".css")) return asset.bytes > budgets.css;
  if (asset.name.endsWith(".js")) return asset.bytes > budgets.js;
  return false;
});

if (oversized.length > 0) {
  for (const asset of oversized) {
    console.error(`${asset.name} 超过单文件预算：${(asset.bytes / 1024).toFixed(2)} kB`);
  }
  process.exitCode = 1;
} else {
  const largest = [...assets].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  console.log(
    `包体预算通过：${largest.map((asset) => `${asset.name} ${(asset.bytes / 1024).toFixed(2)} kB`).join("，")}`,
  );
}
