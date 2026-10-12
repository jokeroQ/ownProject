# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (previously Volar) and disable Vetur

- Use [vue-tsc](https://github.com/vuejs/language-tools/tree/master/packages/tsc) for performing the same type checking from the command line, or for generating d.ts files for SFCs.

## 开发与代码检查

在此目录执行 `npm ci` 安装依赖，然后运行 `npm run dev`。也支持使用仓库中的 pnpm 锁文件执行 `pnpm install --frozen-lockfile`；请选择其中一种方式安装，不要混用 node_modules。

- `npm run check`：执行 TypeScript、ESLint 和格式检查。
- `npm run build`：执行类型检查并打包前端。
- `npm run format`：统一前端源码格式。
- `npm run lint:fix`：自动修复可修复的 lint 问题。

VS Code 安装仓库推荐的 Vue - Official、ESLint 和 Prettier 扩展，禁用同一工作区中的 Vetur。仓库已配置保存时格式化、ESLint 工作目录和修复操作。更新代码及依赖后，若编辑器仍显示旧诊断，可执行“TypeScript: Restart TS Server”和“ESLint: Restart ESLint Server”，或“Developer: Reload Window”。

只使用 ESLint 9 的 eslint.config.js；旧 .eslintrc.js 已移除。自动导入变量由 Vite 生成 .eslintrc-auto-import.json 供 ESLint 读取。auto-imports.d.ts、components.d.ts 等生成文件不参与手工格式检查，但仍由 TypeScript 检查。

主题设置入口仅在 Home 页面显示；已保存的主题仍全局应用，子页面、登录页和注册页不显示设置按钮。无需更新数据库。

可用登录密码
cara/cara
