# 服务器进程守护

本项目使用两个独立进程：

- `tech-bot-web`：网页和 API 服务。
- `tech-bot-feishu-ws`：飞书长连接，只允许运行 1 个实例。

## 首次部署

```bash
npm ci
npm run build
npm install -g pm2
npm run pm2:start
pm2 save
```

`ecosystem.config.cjs` 已将两个进程固定为 `fork` 模式、各 1 个实例，并开启异常自动重启。

## 日常管理

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

正常状态应同时看到：

- `tech-bot-web`：`online`
- `tech-bot-feishu-ws`：`online`

`tech-bot-feishu-ws` 的实例数量必须为 1。启用 PM2 后，不要再手动执行
`npm start` 或 `npm run feishu:ws`，否则可能额外启动一份服务。

## 服务器重启后自动恢复

执行 `pm2 save` 保存当前进程清单。Linux 服务器再执行 `pm2 startup`，并按它输出的命令完成开机启动配置。

Windows 服务器需将 `pm2 resurrect` 配置为系统启动任务或服务。配置完成后重启一次服务器，并通过
`npm run pm2:status` 确认两个进程均为 `online`。
