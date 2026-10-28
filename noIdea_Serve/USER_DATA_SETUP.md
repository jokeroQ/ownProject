# 用户个人书签

每位用户拥有独立分类和书签。注册在一个事务中创建用户并复制数据库中的默认模板；任何一步失败都会回滚。登录返回7天有效的随机会话凭证，数据库仅保存凭证哈希。所有菜单接口校验当前用户，退出会立即撤销当前会话。登录和注册响应不包含密码哈希。

## 数据库连接配置

使用 Node.js 20.12+。首次配置时，在 `noIdea_Serve` 目录的 PowerShell 中执行；已有 `.env` 会保留，直接修改其中的连接信息即可：

```powershell
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
notepad .env
```

将 `DB_NAME`、`DB_USER`、`DB_PASSWORD` 填为本地 MySQL 的实际值，并按需修改 `DB_HOST`、`DB_PORT`。密码含 `#` 或空格时用引号包住。文件中填写 `KEY=value`，不使用 PowerShell 的 `$env:` 或 Bash 的 `export` 语法。云环境可使用 `DB_SOCKET` 连接本地 Unix socket。

保存一次后，启动、迁移和 MySQL 测试都会从固定位置 `noIdea_Serve/.env` 自动加载配置，更换终端、重启后仍有效。已有系统或终端环境变量优先于 `.env`，修改文件后若仍使用旧值，检查是否有外部同名变量覆盖。`.env` 已加入忽略规则，真实密码不提交到仓库，`.env.example` 只提供不含真实凭据的示例。

没有 `.env` 时继续使用外部环境变量或原默认值：`DB_NAME=noIdea`、`DB_USER=root`、`DB_HOST=localhost`、`DB_PORT=3306`，密码默认空。已有环境只需持久保存连接信息时，配置后运行 `npm start` 即可，无需重做历史迁移。

## 从现有数据库升级

1. 先备份实际 MySQL 数据库，并停止旧后端，避免迁移期间继续写入共享分类。
2. 首次迁移确认 `users` 表有且只有一个 `cara` 账号。密码保持原样；脚本不会创建账号或修改密码。迁移已完成后，管理员可在用户管理页修改账号名称，重复迁移不再依赖该名称。
3. 按上面的数据库连接配置填写 `.env`，确认连接到需要升级的数据库。
4. 在 `noIdea_Serve` 目录运行 `npm run migrate:user-data`。
5. 运行 `npm start`；前端在 `noIdea_Front` 运行 `npm run dev`。必要时设置 `VITE_API_BASE_URL` 为后端 API 地址。

```powershell
npm run migrate:user-data
```

迁移会增加 `menus.user_id`、书签简介 `menulists.desc`、`bookmark_templates` 和 `user_sessions` 表。第一次执行时把所有现有分类和书签完整保存为独立模板，再把旧记录归到 cara，旧分类/书签 ID 保留；其他已存在的账号也获得各自的模板副本。分类显示 index 规范化为记录 ID。再次执行不会重建模板、重置个人书签或重新填充已删除的分类。

MySQL DDL 不支持与数据迁移一起事务回滚，因此需要事先备份。数据复制、模板保存和归属更新使用一个事务；脚本可在修复失败原因后重跑。首次缺少 cara 时停止，不会自动创建账号。已有模板时保持分类现有归属；若出现 `user_id` 为 NULL 的分类会明确报错，需要先修复归属再重跑。仓库 noidea.sql 是旧版样例，里面未包含 cara；新库导入后先通过旧版注册 cara，或用自己的已有数据库备份，再执行迁移。

后端启动不会再执行 `sync({alter:true})`，避免反复生成约束及自动改表。旧的 `isLoggedIn` 标记已弃用，需要重新登录；凭证通过 Authorization: Bearer 发送。数据库模板只在首次迁移时创建，cara 以后修改自己的分类不会改变新用户默认内容。

## 验证

在 `noIdea_Serve` 目录运行 `npm test`。测试从 `.env` 或优先级更高的外部环境变量读取 MySQL 连接，账号需有创建、删除测试库的权限；测试在加载模型前将 `DB_NAME` 替换为随机测试库名，导入样例、创建仅限测试的 cara 账号并在结束后清理，只操作独立测试库。

测试覆盖迁移与重复执行、注册回滚、两账号默认副本、分类和书签的读写/排序隔离、伪造用户字段、错误/过期凭证、退出后凭证失效和密码哈希隐藏。
