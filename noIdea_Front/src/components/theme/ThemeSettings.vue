<template>
  <el-button class="theme-launcher" type="primary" @click="open = true">主题设置</el-button>
  <el-dialog v-model="open" title="我的主题" width="460px" :close-on-click-modal="!busy" :show-close="!busy" :before-close="beforeClose">
    <div class="theme-settings" v-loading="themeState.loading">
      <p v-if="themeState.error" role="alert">{{ themeState.error }} <el-button link @click="loadTheme">重新加载</el-button></p>
      <label for="theme-mode">外观</label>
      <select id="theme-mode" v-model="draft.mode" :disabled="busy || themeState.loading">
        <option value="light">浅色</option><option value="dark">深色</option>
      </select>
      <label for="theme-color">主题色</label>
      <input id="theme-color" v-model="draft.primaryColor" type="color" :disabled="busy || themeState.loading" />
      <div class="color-presets">
        <button v-for="color in colors" :key="color" type="button" :style="{ backgroundColor: color }" :aria-label="`使用主题色 ${color}`" :disabled="busy || themeState.loading" @click="draft.primaryColor = color"></button>
      </div>
      <label for="theme-overlay">背景遮罩：{{ Math.round(draft.overlay * 100) }}%</label>
      <input id="theme-overlay" v-model.number="draft.overlay" type="range" min="0" max="0.85" step="0.05" :disabled="busy || themeState.loading" />
      <label for="theme-file">个人背景图片</label>
      <input id="theme-file" type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy || themeState.loading" @change="onFile" />
      <p class="theme-hint">支持静态 JPG、PNG、WebP，最大5MB。图片上传后立即保存；配色和遮罩可先预览，再点击保存。</p>
      <img v-if="themeState.backgroundUrl" :src="themeState.backgroundUrl" class="theme-preview" alt="当前个人背景" />
      <el-button v-if="themeState.settings.hasBackground" :disabled="busy || themeState.loading" @click="run(removeBackground, '已移除背景图片')">移除图片</el-button>
    </div>
    <template #footer>
      <el-button :disabled="busy || themeState.loading" @click="restoreDefaults">恢复默认</el-button>
      <el-button :disabled="busy" @click="open = false">关闭</el-button>
      <el-button type="primary" :loading="busy" :disabled="themeState.loading || Boolean(themeState.error)" @click="run(() => saveTheme({ ...draft }), '主题已保存')">保存设置</el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import { themeState, applyTheme, loadTheme, saveTheme, uploadBackground, removeBackground, resetTheme } from '@/utils/theme';
const open = ref(false);
const busy = ref(false);
const draft = reactive({ ...themeState.settings });
const colors = ['#409eff', '#7c3aed', '#059669', '#e11d48', '#d97706'];
watch(() => themeState.settings, value => Object.assign(draft, value), { deep: true });
watch(open, value => {
  if (value) Object.assign(draft, themeState.settings);
  else applyTheme(themeState.settings);
});
watch(draft, value => { if (open.value) applyTheme(value); }, { deep: true });
const beforeClose = (done: () => void) => { if (!busy.value) done(); };
async function run(operation: () => Promise<void>, message: string) {
  if (busy.value) return;
  busy.value = true;
  try { await operation(); ElMessage.success(message); }
  catch (error: any) { ElMessage.error(error.response?.data?.message ?? error.message ?? '主题更新失败'); }
  finally { busy.value = false; }
}
async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    ElMessage.error('请选择5MB以内的 JPG、PNG 或 WebP 图片'); return;
  }
  await run(() => uploadBackground(file), '背景图片已保存');
}
async function restoreDefaults() {
  try {
    await ElMessageBox.confirm('恢复浅色和默认主题色，并删除个人背景图片？', '恢复默认', { confirmButtonText: '恢复', cancelButtonText: '取消' });
    await run(resetTheme, '已恢复默认主题');
  } catch { /* User cancelled. */ }
}
</script>
<style scoped>
.theme-launcher { position: fixed; right: 24px; bottom: 24px; z-index: 100; box-shadow: 0 4px 20px #0002; }
.theme-settings { display: grid; gap: 12px; }
.theme-settings select { padding: 8px; border-radius: 6px; color: var(--el-text-color-primary); background: var(--el-bg-color); border: 1px solid var(--el-border-color); }
.theme-hint { font-size: 12px; color: var(--el-text-color-secondary); margin: 0; }
.theme-preview { width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; }
.color-presets { display: flex; gap: 10px; }
.color-presets button { width: 28px; height: 28px; border: 2px solid var(--el-border-color); border-radius: 50%; cursor: pointer; }
</style>
