import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';
// 导入`IconsResolver`来解析图标
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  optimizeDeps: {
    include: ['echarts/core', 'echarts/components', 'echarts/renderers', 'echarts/charts'],
  },
  server: {
    watch: {
      // Generated type declarations must not reload pages or discard open dialogs.
      ignored: ['**/auto-imports.d.ts', '**/components.d.ts', '**/.eslintrc-auto-import.json'],
    },
  },
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router'],
      resolvers: [ElementPlusResolver(), IconsResolver({ prefix: 'Icon' })], // 添加 IconsResolver
      dts: 'src/auto-imports.d.ts',
      eslintrc: {
        enabled: true,
        filepath: './.eslintrc-auto-import.json',
        globalsPropValue: 'readonly',
      },
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
      '@views': resolve(__dirname, 'src/views'),
    },
  },
});
