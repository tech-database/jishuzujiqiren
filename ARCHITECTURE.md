# 项目维护与扩展约定

## 目录职责

- `src/app/`：应用壳、导航、路由和全局 Provider。
- `src/features/<feature>/`：某项业务自己的 API、模型、hooks 和页面逻辑。
- `src/features/<feature>/*Page.jsx`：页面容器，负责把应用控制器适配为页面参数。
- `src/shared/`：至少被两个业务功能使用的通用能力。
- `src/components/`：现有页面及其展示组件；后续修改时逐步迁入对应 `features`。
- `src/styles/features/`：按业务拆分的基础样式，`src/styles.css` 只维护有序导入。
- `src/styles/saas-light/`：浅色产品主题的分区覆盖，导入顺序视为兼容契约。
- `server/index.js`：服务装配、后台任务调度和静态文件入口，不承载完整业务实现。
- `server/*-routes.js`：按领域注册 HTTP 路由，例如管理员认证和运行配置。
- `server/` 其他文件：飞书连接与现有业务核心；新增业务应优先放入独立业务模块。

## 新增页面

1. 在 `src/features/<feature>/` 创建功能目录。
2. 页面组件保持独立，不在 `src/main.jsx` 中实现页面 JSX。
3. 在 `src/app/routes.jsx` 增加一条路由配置。
4. 需要管理员权限时设置 `adminOnly: true`。
5. 页面请求通过功能目录下的 `*.api.js` 调用 `src/shared/api/client.js`。
6. 完成后运行 `npm test` 和 `npm run build`。

提交前优先运行 `npm run verify`，它会执行前后端测试、架构检查和生产构建。

导航、路径、标题和权限必须来自 `src/app/routes.jsx`，不要分别维护多份列表。

## 状态归属

- 只影响一个控件：留在控件内部。
- 只影响一个页面：放在页面或页面 hook。
- 多个页面共享：放在 app Provider 或明确的共享 hook。
- 服务端数据请求：放在对应功能的 API 文件，不在组件中直接调用 `fetch`。

不要为了减少传参而把页面私有状态放入全局。

## 后端边界

新增接口按以下顺序组织：

1. 路由负责读取和校验输入。
2. 业务服务负责业务规则。
3. 飞书或存储访问层负责外部读写。
4. 路由统一返回结果。

路由文件不应直接实现 Excel 解析、字段映射或复杂业务状态变更。
`server/bot-core.js` 只作为兼容导出和服务装配入口；绘图业务分别归属状态、统计、
人员、领图完成和下单确认服务，并保留现有测试作为迁移保护。

需要外部服务的路由应通过工厂参数提供可替换依赖，使单元测试不访问真实飞书、
不修改项目真实配置文件。

长连接日志通过 `server/runtime-logger.js` 输出结构化事件。禁止记录消息正文、
访问令牌、密钥、密码或完整的用户、会话、消息标识。

## 代码规模参考

- 页面建议不超过 400 行。
- 普通组件建议不超过 200 行。
- 超出时先检查是否混合了请求、状态、数据转换和展示。
- `shared` 中的内容必须有两个以上真实使用方，禁止把它当作杂物目录。

这些是拆分提示，不是机械限制；完整、内聚的功能不必为了行数被切碎。

## 完成标准

每次新增或重构至少满足：

- 页面和业务逻辑没有新增直接 `fetch`。
- 没有新增第二份路由或权限清单。
- 错误状态、空状态和加载状态可用。
- `npm test` 通过。
- `npm run build` 通过。

## 自动化质量门禁

- `npm run lint`：检查 JavaScript、JSX 和 React Hooks 依赖，错误会阻断验证。
- `npm run check:css`：阻止完全重复的 CSS 规则重新进入代码库。
- `npm run build && npm run check:bundle`：生产构建并校验单个 JS/CSS 文件预算。
- `npm run test:e2e`：使用本机 Edge 验证首页、数据看板和管理员访问保护。
- `npm run verify`：执行单元测试、Lint、架构检查、CSS 检查、生产构建和包体预算。
- `npm run verify:full`：在 `verify` 基础上追加浏览器级关键流程测试。

长连接的消息识别与路由统一放在 `server/long-connection-dispatcher.js`；入口只负责 SDK
装配、资源下载和生命周期。料号标准化、匹配、跨表唯一性与导入前重复校验统一放在
`server/drawing-record-utils.js`，不要再复制到路由或命令处理函数。
