import { spawnSync } from "node:child_process";

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    stdio: capture ? "pipe" : "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  return capture ? String(result.stdout || "").trim() : "";
}

function git(...args) {
  return run("git", args);
}

function gitOutput(...args) {
  return run("git", args, { capture: true });
}

const commitMessage = process.argv.slice(2).join(" ").trim()
  || `更新技术组机器人 ${new Date().toISOString().slice(0, 10)}`;
const branch = gitOutput("branch", "--show-current");

if (!branch) {
  throw new Error("当前不在 Git 分支上，已停止发布。");
}

const changes = gitOutput("status", "--porcelain");
if (changes) {
  console.log(`\n提交全部工作区改动：${commitMessage}\n`);
  git("add", "-A");
  git("commit", "-m", commitMessage);
} else {
  console.log("\n工作区没有未提交改动，将推送当前提交。\n");
}

console.log(`\n推送当前分支：${branch}\n`);
git("push", "-u", "origin", branch);

if (branch !== "main") {
  console.log("\n同步同一提交到部署分支：main\n");
  git("push", "origin", "HEAD:main");
}

console.log("\n发布完成。服务器可继续使用 git pull origin main 更新。\n");
