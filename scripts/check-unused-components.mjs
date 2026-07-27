import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const componentRoot = path.join(sourceRoot, "components");
const supportedExtensions = [".js", ".jsx"];

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute);
    if (!supportedExtensions.includes(path.extname(entry.name))) return [];
    if (/\.test\.[^.]+$/.test(entry.name)) return [];
    return [absolute];
  });
}

function importSpecifiers(source) {
  const specifiers = [];
  const staticPattern =
    /\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(staticPattern)) specifiers.push(match[1]);
  for (const match of source.matchAll(dynamicPattern)) specifiers.push(match[1]);
  return specifiers;
}

function resolveSourceImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    base,
    ...supportedExtensions.map((extension) => `${base}${extension}`),
    ...supportedExtensions.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

const entry = path.join(sourceRoot, "main.jsx");
const reachable = new Set();
const pending = [entry];

while (pending.length > 0) {
  const file = pending.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  const source = fs.readFileSync(file, "utf8");
  for (const specifier of importSpecifiers(source)) {
    const dependency = resolveSourceImport(file, specifier);
    if (dependency && !reachable.has(dependency)) pending.push(dependency);
  }
}

const unused = listSourceFiles(componentRoot)
  .filter((file) => !reachable.has(file))
  .map((file) => path.relative(root, file).replaceAll("\\", "/"))
  .sort();

if (unused.length === 0) {
  console.log("Unused component check passed: every production component is reachable.");
  process.exit(0);
}

console.error(`Unused production components: ${unused.length}`);
for (const file of unused) console.error(file);
process.exitCode = 1;
