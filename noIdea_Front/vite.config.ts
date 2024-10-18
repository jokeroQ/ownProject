import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';
// 导入`IconsResolver`来解析图标
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import eslintPlugin from 'vite-plugin-eslint';
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    eslintPlugin({
      fix: false, // 不自动修复，确保代码问题报告，但不影响项目运行
      emitWarning: true, // 仅发出警告，不阻止编译
      emitError: false, // 不会阻止项目启动 
    }),
    AutoImport({
      imports: ['vue', 'vue-router'],
      resolvers: [
        ElementPlusResolver(), 
        IconsResolver({ prefix: 'Icon' })
      ], // 添加 IconsResolver
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [
        ElementPlusResolver(),
        IconsResolver({ enabledCollections: ['ep'] }), // 为 Element Plus 图标库添加支持
      ],
      dts: 'src/components.d.ts',
    }),
    Icons({
      autoInstall: true, // 自动安装图标
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@views': resolve(__dirname, 'src/views')
    }
  }
});