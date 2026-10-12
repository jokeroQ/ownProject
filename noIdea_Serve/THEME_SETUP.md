# 全局个人主题

登录后在 Home 页面点击右下角“主题设置”。支持浅色/深色、主题色、背景遮罩和个人图片。配色与遮罩实时预览，点击“保存设置”写入数据库；关闭面板或离开 Home 取消未保存的配色。图片上传、移除以及恢复默认立即保存。子页面不显示设置入口，但继续应用已保存主题。

## 已完成用户数据迁移的数据库

在与之前相同的 VS Code 终端中保留 DB_USER、DB_PASSWORD、DB_NAME 等连接环境变量，然后：

```sh
cd noIdea_Serve
npm ci
npm run migrate:themes
npm start
```

新数据库先按 USER_DATA_SETUP.md 执行用户数据迁移，再执行主题迁移。主题迁移只增加 user_themes 表，可以重复执行，不会更改分类、书签或个人主题。

前端继续在 noIdea_Front 中执行 npm run dev。前后端都需要更新到同一版本。主题接口为 GET/PUT/DELETE /api/theme 和 GET/PUT/DELETE /api/theme/background，均要求登录；PUT background 以原始图片二进制提交，Content-Type 为 image/jpeg、image/png 或 image/webp，不使用 multipart 表单。

## 数据及图片存储

用户模式、主题色、遮罩透明度和文件名保存在 user_themes，每个 user_id 只有一条记录。未设置的用户使用浅色默认主题。

默认图片目录为 noIdea_Serve/uploads/themes，可以通过 THEME_UPLOAD_DIR 指定持久存储目录。需允许后端进程读写，并与数据库一起备份。目录已加入 .gitignore；图片不提交到 Git，也不公开挂载为静态资源，读取时由后端校验用户会话。部署到容器时将此目录挂载持久卷，避免重建后丢失。

限制5MB，支持静态 JPEG、PNG、WebP，拒绝 SVG、GIF、动画、多页及无法解码的图片。服务端使用 sharp 验证解码，最大输入4000万像素、输出最长边2560，统一重编码 WebP并去掉 EXIF。替换或删除后清理旧文件。颜色、模式、透明度验证在服务端执行，前端传来的 user_id 或文件名不能改变归属。

登录及刷新时从服务器恢复主题；退出时清除照片与配色；跨标签页账号变化会清空页面数据并重新加载。其他用户不能读取这张图片，主题设置也不会进入默认书签模板。

## 验证

npm test 使用独立测试数据库和临时上传目录，验证主题迁移、个性化隔离、图片解码/大小/格式限制、并发替换、删除和恢复默认，同时保留书签隔离测试。测试使用固定的旧版表结构样例，不读取实际账号导出的 noidea.sql。

可选真实浏览器检查：在安装好前端依赖、Playwright 和 Chromium 的环境运行 node tests/theme-browser.smoke.cjs。支持 PLAYWRIGHT_MODULE 指定 Playwright 模块路径、CHROMIUM_PATH 指定浏览器、THEME_FRONTEND_ROOT 指定前端目录。脚本创建独立测试库和上传目录，自行启动后端和 Vite，验证登录、保存、上传、取消预览、刷新恢复、跨页面主题、退出与账号切换，结束后清理测试数据和进程。

sharp 使用平台对应的原生可选依赖：npm ci 时不要加 --omit=optional。建议 Node.js 20.3+、22 或24。前端运行 npm run check 可检查类型、ESLint 和格式；npm run build 会先执行类型检查再打包。
