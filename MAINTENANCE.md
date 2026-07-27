# 维护契约

## API 返回

- HTTP 接口通过 `server/api-response.js` 返回统一信封。
- 成功固定包含 `ok: true`、`code`、`message` 和 `data`。
- 失败固定包含 `ok: false`、稳定错误码 `code`、用户可读 `message`、兼容字段 `error` 和 `data: null`。
- 迁移期间业务字段同时保留在顶层和 `data` 中；新前端代码优先读取 `data`。
- 新错误码加入 `apiErrorCodes`，不要在路由里临时拼接错误码。

## 可替换业务依赖

绘图状态、统计、人员、领图完成和下单服务均提供 `createDrawing*Service` 工厂。生产环境使用默认飞书依赖；单元测试通过工厂参数替换令牌、数据表读取和批量写入函数，不修改模块全局状态。

## 长连接边界

- `server/long-connection.js`：配置、依赖装配、事件注册和启动。
- `server/long-connection-command-handlers.js`：文本命令用例。
- `server/long-connection-spreadsheet-handler.js`：表格会话、完成和轮询。
- `server/feishu-resource-downloader.js`：飞书文件流下载。
- `server/long-connection-lifecycle.js`：连接、重连、心跳和运行状态。

## CSS 维护

`npm run check:css-unused` 会拦截源码中没有引用的高置信度选择器；动态状态类统一加入脚本白名单。删除或重命名组件类名后运行该检查和浏览器测试，避免旧规则重新堆积。
