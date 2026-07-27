import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const root = process.cwd();
const stylesRoot = path.join(root, "src");
const cssFiles = [];
const parsedFiles = new Map();
const fix = process.argv.includes("--fix");

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith(".css")) cssFiles.push(fullPath);
  }
}

function atRuleContext(rule) {
  const parents = [];
  let current = rule.parent;
  while (current) {
    if (current.type === "atrule") parents.unshift(`@${current.name} ${current.params}`.trim());
    current = current.parent;
  }
  return parents.join(" > ");
}

walk(stylesRoot);
const occurrences = new Map();
for (const file of cssFiles) {
  const css = fs.readFileSync(file, "utf8");
  const parsed = postcss.parse(css, { from: file });
  parsedFiles.set(file, parsed);
  parsed.walkRules((rule) => {
    const declarations = rule.nodes
      .filter((node) => node.type === "decl")
      .map((node) => `${node.prop.trim()}:${node.value.trim()}${node.important ? "!important" : ""}`)
      .join(";");
    if (!declarations) return;
    const key = `${atRuleContext(rule)}\n${rule.selector.trim()}\n${declarations}`;
    const list = occurrences.get(key) || [];
    list.push({
      file,
      location: `${path.relative(root, file)}:${rule.source.start.line}`,
      rule,
    });
    occurrences.set(key, list);
  });
}

const duplicates = [...occurrences.entries()].filter(([, locations]) => locations.length > 1);
if (duplicates.length > 0) {
  console.error(`发现 ${duplicates.length} 组完全重复的 CSS 规则：`);
  for (const [key, locations] of duplicates) {
    console.error(`- ${key.split("\n")[1]} -> ${locations.map((item) => item.location).join(", ")}`);
    if (fix) locations.slice(0, -1).forEach((item) => item.rule.remove());
  }
  if (fix) {
    for (const [file, parsed] of parsedFiles) fs.writeFileSync(file, parsed.toString(), "utf8");
    console.log("已保留每组最后一条规则并移除更早的完全重复项。");
  } else {
    process.exitCode = 1;
  }
} else {
  console.log(`CSS 重复检查通过：${cssFiles.length} 个文件中没有完全重复规则。`);
}
