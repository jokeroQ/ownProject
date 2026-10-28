# 页面与收藏功能更新

现有环境在 `noIdea_Serve` 执行 `npm run migrate:features` 后重启后端。迁移可重复执行，保留用户、主题、书签和已保存顺序；本次本地环境已执行。

- 聊天社区统一标题、返回图标、会话列表、消息气泡和输入区，保留实时私聊与手机会话切换。
- 签名板统一画布容器、操作区和预览；调整窗口仍保留笔迹。
- 首页“有趣功能点尝试”增加“今晚吃什么”，路由 `/dinner`。默认8项；可设置2–16个不同选项，每项1–12个字。点击“保存选项”后按账号存入数据库。旋转中不能修改选项，每项概率相同，指针与结果一致，支持减少动态效果的系统偏好。
- 颜色变量测试支持编辑内置色卡、新增和删除自定义色卡。名称1–24字，自定义变量为 `--custom-` 开头的小写字母、数字和连字符，例如 `--custom-brand`，支持6位或8位十六进制颜色。内置变量名保持固定，自定义变量名可修改。深浅色分别保存，点击保存才生效。自定义变量可通过 `var(--custom-brand)` 在组件中使用；内置色卡的页面背景、文字、顶部和侧栏颜色应用到对应主题区域。恢复默认可清除覆盖。
- 首页点击左下角“编辑书签”，可在内容空白处按住鼠标拉框选择，或点击卡片逐项选择；按住 Ctrl / Command / Shift 框选可追加。选中状态只高亮卡片边框，顶部“全选”可选中全部可编辑书签。拖动任意已选卡片可整组移动到分类末尾或目标卡片前，组内保持原来的显示顺序。批量移动和删除仍可用，单项、批量删除均先弹窗确认。普通用户继续只能修改自己的可编辑项目，手机可点击卡片和“全选”选择。
- 左侧工具栏“调整分类顺序”可拖动排序，也可用上下箭头排序，点击“保存顺序”后同步左侧列表并按账号保存。分类排序不改变编辑权限。

新增数据：`menus.sort_order`、`user_themes.color_cards`、`user_preferences`（晚餐选项）。新接口均要求登录：`GET/PUT /api/dinner`、`PUT /api/menu/order`、`POST /api/menu/subMenus/batch`。批量接口先验证全部记录归属和权限，再在事务中统一执行。

## 检查

前端执行 `npm run typecheck`、`npm run lint` 和 `npm run build`。后端 `node --test tests/workspace-features.test.js tests/user-data.test.js` 验证校验及现有数据回归。

设置 `PLAYWRIGHT_MODULE` 与 `CHROMIUM_PATH` 后可运行 `npm run test:features-browser`。它使用隔离测试库；可设置 `THEME_FRONTEND_URL=http://localhost:5173` 检查正在运行的前端，同时将 HTTP 和聊天 WebSocket 转发到测试后端。截图目录通过 `THEME_SETTINGS_ARTIFACT_DIR` 指定。

同样的环境变量下运行 `node tests/home-selection-browser.smoke.cjs`，可单独验证首页鼠标框选、追加选择、自动滚动、整组拖动排序、只读权限、全选和手机布局。本次选择与拖动更新无需新增数据库迁移，更新后重启后端即可。
