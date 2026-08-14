# 项目操作约定

## Git 推送

- 用户要求推送全部代码时，使用 `npm run git:publish -- "提交说明"`。
- 该流程推送当前分支，并同步同一提交到 `main`。
- 不提交 `outputs/` 下的本地生成文件。

## 服务器部署

- 服务器目录固定为 `/home/ubuntu/apps/jishuzujiqiren`。
- 部署使用 `bash scripts/deploy-server.sh`。
- PM2 服务真实名称是 `tech-bot-web` 和 `tech-bot-feishu-ws`。
- 不使用旧名称 `tech-bot-api` 或 `tech-bot-ws`。
- 部署后必须验证服务器 `HEAD` 等于 `origin/main`、两个 PM2 服务为 `online`，并检查 `http://127.0.0.1:8787/api/health`。
- 完整说明见 `DEPLOYMENT.md`。
