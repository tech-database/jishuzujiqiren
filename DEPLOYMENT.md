# 技术组机器人发布与部署流程

本项目固定使用以下流程发布代码和更新服务器。

## 一、本地推送到 Git

在项目根目录执行：

```bash
npm run git:publish -- "本次修改说明"
```

该命令会：

1. 运行项目完整验证；
2. 提交工作区代码；
3. 推送当前开发分支；
4. 将同一提交同步到远程 `main` 分支。

`outputs/` 是本地生成文件目录，不进入 Git。

## 二、服务器更新

服务器项目目录固定为：

```text
/home/ubuntu/apps/jishuzujiqiren
```

连接服务器后执行：

```bash
cd /home/ubuntu/apps/jishuzujiqiren
git pull --ff-only origin main
bash scripts/deploy-server.sh
```

首次拉取到部署脚本后，以后可以直接执行：

```bash
cd /home/ubuntu/apps/jishuzujiqiren
bash scripts/deploy-server.sh
```

部署脚本会自动：

1. 拉取并核对 `origin/main`；
2. 执行 `npm install`；
3. 执行 `npm run build`；
4. 根据 `ecosystem.config.cjs` 启动或重载 PM2；
5. 执行 `pm2 save`；
6. 检查 PM2 状态；
7. 请求 `http://127.0.0.1:8787/api/health`。

## 三、PM2 服务名称

只使用项目配置中的真实名称：

```text
tech-bot-web
tech-bot-feishu-ws
```

不要使用旧名称 `tech-bot-api` 或 `tech-bot-ws`。

## 四、验证服务器是否为最新代码

```bash
cd /home/ubuntu/apps/jishuzujiqiren
git fetch origin

echo "服务器代码：$(git rev-parse HEAD)"
echo "远程 main：$(git rev-parse origin/main)"

if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  echo "✅ 服务器代码已是最新版本"
else
  echo "❌ 服务器代码不是最新版本"
fi

pm2 status
curl --fail http://127.0.0.1:8787/api/health
```

部署成功必须同时满足：

- 服务器 `HEAD` 与 `origin/main` 完整提交哈希一致；
- `tech-bot-web` 和 `tech-bot-feishu-ws` 均为 `online`；
- 健康接口请求成功。
