# 站内一对一私聊

登录后从收藏中的聊天入口（`/chat`）进入。搜索另一个已注册用户的用户名，点击“发消息”开始私聊；同一对用户始终使用同一个会话。

支持文字消息、双向实时收发、历史分页、未读数、已读状态、发送失败重试，以及断线重连后的消息补取。Enter 发送，Shift + Enter 换行，兼容中文输入法。聊天页沿用已保存主题，手机上可在会话列表与聊天内容之间切换；返回收藏会恢复原分类。

## 更新已有环境

使用 Node.js 20.12+，先停止旧后端。首次运行时，按[数据库连接配置](noIdea_Serve/USER_DATA_SETUP.md#数据库连接配置)将 `noIdea_Serve/.env.example` 复制为 `.env` 并填写本地连接信息；配置一次后，新开的终端和重启都会自动读取。在 `noIdea_Serve` 目录的 PowerShell 中执行：

```powershell
npm ci --include=optional
npm run migrate:chat
npm start
```

迁移仅创建 `chat_conversations`、`chat_members`、`chat_messages` 三张表，可重复执行，不修改原分类、书签、主题或流程图。新环境仍需先按现有文档完成用户数据、主题和流程图迁移。后端启动会检查聊天表，缺失时提示执行迁移。已有环境若只补充 `.env` 配置且聊天表已就绪，直接运行 `npm start`，无需重做历史迁移。

后端、迁移和 MySQL 测试都会读取 `noIdea_Serve/.env` 中的 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`；已有系统或终端环境变量优先。`.env` 已忽略提交，真实密码只保存在本机。

前端在 `noIdea_Front` 目录执行：

```powershell
npm ci
npm run dev
```

也可以继续使用 pnpm；两个锁文件均已更新，请选择一种方式管理 `node_modules`。`VITE_API_BASE_URL` 继续指向后端 API，默认 `http://localhost:3000/api`。Socket.IO 使用相同源的 `/socket.io/`，与 API 共用后端端口；部署反向代理时，应同时转发 API 和 Socket.IO，并支持 WebSocket 升级。

## 数据与接口

- `chat_conversations`：双方用户 ID 排序形成唯一键，避免重复私聊。
- `chat_members`：会话成员与每个成员的已读消息位置。
- `chat_messages`：正文、发送者、时间及客户端消息 UUID。

所有聊天接口要求现有 Bearer 会话认证：

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/chat/users?keyword=` | 搜索其他用户，仅返回 ID、用户名，最多20条 |
| `GET /api/chat/conversations` | 当前用户的会话、最后消息与未读数 |
| `POST /api/chat/conversations` | `{ userId }` 创建或取得双方私聊 |
| `GET /api/chat/conversations/:id/messages` | 最新50条；`beforeId` 查询更早消息，`afterId` 补取新消息 |
| `POST /api/chat/conversations/:id/messages` | `{ clientMessageId, content }` 保存文字消息 |
| `PUT /api/chat/conversations/:id/read` | `{ messageId }` 更新已读位置 |

消息分页始终按 ID 升序返回，`limit` 最大100，响应含 `hasMore`；`afterId=0` 可从第一条补取。消息上限2000字符，每个用户每分钟最多60次发送请求，限流返回429和 `Retry-After`。

后端按登录身份确定发送者，并在读取、发送和标记已读时检查成员身份；管理员也不能跨会话查看他人私聊。Socket.IO 握手验证同一会话，房间由服务端指定，退出会立即断开该登录会话的全部聊天连接，过期连接不能继续接收通知。

消息在数据库事务提交后通知双方；相同发送者和客户端 UUID 只能保存一条消息，同编号重试相同正文返回原消息，复用编号发送其他内容返回409。前端合并 HTTP 响应与实时通知，重连通过接口补取历史。已读位置只前进，不会回退。

当前版本为一对一纯文本私聊，不包含好友申请、群聊或文件上传。发送中与失败状态保留在当前页面，离开页面后可通过历史确认服务器已保存的消息。

## 验证

在后端目录运行 `npm test`；测试从 `.env` 或优先级更高的外部环境变量读取 MySQL 连接，连接账号需有创建、删除测试库的权限。测试使用随机名称覆盖业务库的 `DB_NAME`，只创建并清理独立测试数据库，覆盖原有功能、聊天迁移、会话唯一性、越权、并发幂等、分页、已读、限流和真实 Socket.IO 通知。

真实浏览器验证：

```powershell
$env:PLAYWRIGHT_MODULE = '本地 Playwright 模块的绝对路径'
$env:CHROMIUM_PATH = '本地 Chrome 或 Chromium 可执行文件的绝对路径'
npm run test:chat-browser
```

浏览器脚本使用独立测试库并自行启动后端和 Vite，验证双账号收发、历史恢复、未读已读、断线补取、失败重试、分页与手机布局，结束时清理测试数据和进程。支持 `CHAT_FRONTEND_ROOT` 指定前端目录，`CHAT_FRONTEND_PORT` 指定测试端口。

前端检查：`npm run typecheck`、`npm run lint`、`npm run build`；新增聊天文件也使用仓库 Prettier 配置检查。
