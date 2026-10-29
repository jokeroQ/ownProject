# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (previously Volar) and disable Vetur

- Use [vue-tsc](https://github.com/vuejs/language-tools/tree/master/packages/tsc) for performing the same type checking from the command line, or for generating d.ts files for SFCs.

## 开发与代码检查

新增页面、弹窗和调整 UI 前，必须阅读并遵循根目录的 [统一 UI 开发规范](../UI_GUIDELINES.md)。全局尺寸与主题在 `global-theme.css`，页面和表单公共类在 `app-ui.css`，弹窗在 `overlays.css`；不要从其他页面复制一套局部控件样式。根目录 `AGENTS.md` 已将此规范列为后续前端开发的必读要求。

在此目录执行 `npm ci` 安装依赖，然后运行 `npm run dev`。也支持使用仓库中的 pnpm 锁文件执行 `pnpm install --frozen-lockfile`；请选择其中一种方式安装，不要混用 node_modules。

- `npm run check`：执行 TypeScript、ESLint 和格式检查。
- `npm run build`：执行类型检查并打包前端。
- `npm run format`：统一前端源码格式。
- `npm run lint:fix`：自动修复可修复的 lint 问题。

VS Code 安装仓库推荐的 Vue - Official、ESLint 和 Prettier 扩展，禁用同一工作区中的 Vetur。仓库已配置保存时格式化、ESLint 工作目录和修复操作。更新代码及依赖后，若编辑器仍显示旧诊断，可执行“TypeScript: Restart TS Server”和“ESLint: Restart ESLint Server”，或“Developer: Reload Window”。

只使用 ESLint 9 的 eslint.config.js；旧 .eslintrc.js 已移除。自动导入变量由 Vite 生成 .eslintrc-auto-import.json 供 ESLint 读取。auto-imports.d.ts、components.d.ts 等生成文件不参与手工格式检查，但仍由 TypeScript 检查。

主题设置入口仅在 Home 页面显示；已保存的主题仍全局应用，子页面、登录页和注册页不显示设置按钮。无需更新数据库。

站内一对一私聊已接入真实账号、数据库和实时通知。更新已有环境后，需要在后端执行一次 `npm run migrate:chat`；启动步骤、接口和测试说明见 [CHAT_SETUP.md](../CHAT_SETUP.md)。

可视化地图使用 Apache ECharts 与本地中国省级地图数据，入口位于“有趣功能点…”分类，支持缩放、平移、省市下钻和按账号保存在本机浏览器的多点标记。已有环境在后端执行 `npm run migrate:visual-map` 增补入口；配置和检查说明见 [MAP_SETUP.md](../MAP_SETUP.md)。

## 屏幕适配

首页、聊天、流程图、签名板、登录注册和弹窗支持手机、平板与桌面布局，低高度窗口使用紧凑布局。全局可用高度跟随可见视口调整；手机弹出键盘后，聊天输入和发送按钮保持可达。签名板会随窗口尺寸与像素密度重建画布并保留笔迹；流程图画布在自己的容器内滚动。

在后端目录运行 `npm run test:responsive-browser` 可执行真实浏览器检查，需要本地 Playwright 和 Chrome/Chromium，并通过 `PLAYWRIGHT_MODULE`、`CHROMIUM_PATH` 指定路径。脚本读取后端 `.env` 的连接信息，使用独立随机测试库，覆盖320、390、768、1024、1366、1920像素宽度及手机横屏；测试结束会清理临时数据库和服务。可用 `RESPONSIVE_ARTIFACT_DIR` 指定报告和截图目录。

## 弹窗与控件样式

弹窗、确认框、下拉菜单、颜色选择和删除浮层的公共样式集中在 `src/assets/styles/overlays.css`。新增弹窗沿用 Element Plus 组件和公共规则；页面只补充业务布局，避免单独覆盖公共尺寸。确认框桌面宽度为400px，小屏幕随视口收缩，长内容保留滚动且隐藏滚动条。

普通操作按钮统一为32px高，尺寸由 `global-theme.css` 中的 `--app-button-height` 与 `--app-button-padding` 控制。纯图标按钮沿用 `app-icon-button` 公共样式，无边框和底色，悬停时改变图标颜色。用户管理的返回、编辑、重置密码和翻页图标保留32px点击区域、悬停提示与无障碍名称。

在后端目录运行 `npm run test:ui-browser`，沿用上述浏览器路径配置，检查浅色和深色主题下的桌面、手机、小屏幕与横屏弹出控件。测试使用随机独立数据库并自动清理，检查边界、标题对齐、按钮高度与横向溢出；可通过 `THEME_SETTINGS_ARTIFACT_DIR` 保存报告和截图。

可用登录密码
cara/cara
