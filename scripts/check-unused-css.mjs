import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postcss from "postcss";

const root = process.cwd();
const fix = process.argv.includes("--fix");
const sourceRoot = path.join(root, "src");
const styleRoot = path.join(sourceRoot, "styles");
const dynamicClassPrefixes = [
  "active",
  "collapsed",
  "connected",
  "danger",
  "done",
  "dragging",
  "error",
  "expanded",
  "failed",
  "has-",
  "idle",
  "is-",
  "loading",
  "neutral",
  "offline",
  "online",
  "ready",
  "selected",
  "standby",
  "status-",
  "success",
  "tone-",
  "warning",
];

function listFiles(directory, extensionPattern) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolute, extensionPattern);
    return extensionPattern.test(entry.name) ? [absolute] : [];
  });
}

const sourceText = [
  fs.readFileSync(path.join(root, "index.html"), "utf8"),
  ...listFiles(sourceRoot, /\.(?:js|jsx)$/).map((file) => fs.readFileSync(file, "utf8")),
].join("\n");

const candidates = [];
const changedFiles = new Set();
for (const file of listFiles(styleRoot, /\.css$/)) {
  const css = fs.readFileSync(file, "utf8");
  const ast = postcss.parse(css, { from: file });
  ast.walkRules((rule) => {
    const classes = [...rule.selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)]
      .map((match) => match[1]);
    if (classes.length === 0) return;
    const unused = [...new Set(classes)].filter((className) => {
      if (sourceText.includes(className)) return false;
      return !dynamicClassPrefixes.some(
        (prefix) =>
          className === prefix ||
          (prefix.endsWith("-") && className.startsWith(prefix)),
      );
    });
    if (unused.length === classes.length) {
      candidates.push({
        file: path.relative(root, file).replaceAll("\\", "/"),
        line: rule.source.start.line,
        selector: rule.selector,
      });
      if (fix) {
        rule.remove();
        changedFiles.add(file);
      }
    }
  });
  if (fix && changedFiles.has(file)) {
    ast.walkAtRules((atRule) => {
      if (atRule.nodes?.length === 0) atRule.remove();
    });
    fs.writeFileSync(file, ast.toString());
  }
}

if (fix) {
  console.log(
    `CSS cleanup removed ${candidates.length} unused rules from ${changedFiles.size} files.`,
  );
  process.exit(0);
}

if (candidates.length === 0) {
  console.log("CSS unused-selector check passed: no high-confidence candidates.");
  process.exit(0);
}

console.log(`CSS unused-selector candidates: ${candidates.length}`);
for (const candidate of candidates) {
  console.log(`${candidate.file}:${candidate.line} ${candidate.selector}`);
}
process.exitCode = 1;
