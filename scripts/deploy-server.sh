#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/home/ubuntu/apps/jishuzujiqiren}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8787/api/health}"

handle_error() {
  local exit_code=$?
  echo
  echo "部署失败，已停在出错步骤（退出码：${exit_code}）。"
  echo "SSH 会话仍可继续使用，请根据上方错误信息排查。"
  exit "${exit_code}"
}

trap handle_error ERR

echo "进入项目目录：${PROJECT_ROOT}"
cd "${PROJECT_ROOT}"

echo
echo "拉取 main 最新代码"
git fetch origin main
git pull --ff-only origin main

local_commit="$(git rev-parse HEAD)"
remote_commit="$(git rev-parse origin/main)"

if [[ "${local_commit}" != "${remote_commit}" ]]; then
  echo "服务器提交与 origin/main 不一致，停止部署。"
  echo "服务器：${local_commit}"
  echo "远程：  ${remote_commit}"
  exit 1
fi

echo "当前版本：$(git log -1 --oneline)"

echo
echo "安装依赖"
npm install

echo
echo "构建前端"
npm run build

echo
echo "启动或重载 PM2 服务"
npm run pm2:start
pm2 save

echo
echo "检查 PM2 状态"
pm2 status

echo
echo "检查健康接口：${HEALTH_URL}"
curl \
  --fail \
  --silent \
  --show-error \
  --retry 10 \
  --retry-delay 2 \
  --retry-connrefused \
  "${HEALTH_URL}"
echo

echo
echo "部署完成：${local_commit}"
echo "PM2 服务名称：tech-bot-web、tech-bot-feishu-ws"
