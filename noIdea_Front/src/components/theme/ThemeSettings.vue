<template>
  <el-button class="theme-launcher" type="primary" @click="open = true">主题设置</el-button>
  <el-dialog
    v-model="open"
    class="theme-settings-dialog"
    title="我的主题"
    width="460px"
    :close-on-click-modal="!busy"
    :show-close="!busy"
    :before-close="beforeClose"
  >
    <div class="theme-settings" v-loading="themeState.loading">
      <p v-if="themeState.error" role="alert">
        {{ themeState.error }} <el-button link @click="loadTheme">重新加载</el-button>
      </p>
      <div class="theme-setting-row">
        <label for="theme-mode">外观</label>
        <el-select
          id="theme-mode"
          v-model="draft.mode"
          class="theme-mode-select"
          aria-label="外观"
          popper-class="theme-mode-options"
          :show-arrow="false"
          :disabled="busy || themeState.loading"
        >
          <el-option label="浅色" value="light" />
          <el-option label="深色" value="dark" />
        </el-select>
      </div>
      <div class="theme-setting-row">
        <label for="theme-color">主题色</label>
        <div class="theme-setting-control">
          <el-color-picker
            id="theme-color"
            :model-value="draft.primaryColor"
            class="theme-color-picker"
            aria-label="主题色"
            color-format="hex"
            popper-class="theme-color-options"
            :clearable="false"
            :disabled="busy || themeState.loading"
            @update:model-value="
              (color) => {
                if (color) draft.primaryColor = color;
              }
            "
          />
          <div class="color-presets">
            <button
              v-for="color in colors"
              :key="color"
              type="button"
              :style="{ backgroundColor: color }"
              :aria-label="`使用主题色 ${color}`"
              :disabled="busy || themeState.loading"
              @click="draft.primaryColor = color"
            ></button>
          </div>
        </div>
      </div>
      <div class="theme-setting-row">
        <label for="theme-overlay">背景遮罩</label>
        <div class="theme-overlay-control">
          <input
            id="theme-overlay"
            v-model.number="draft.overlay"
            type="range"
            min="0"
            max="0.85"
            step="0.05"
            :disabled="busy || themeState.loading"
          />
          <output for="theme-overlay">{{ Math.round(draft.overlay * 100) }}%</output>
        </div>
      </div>
      <div class="theme-setting-row">
        <label for="theme-file">个人背景图片</label>
        <div class="theme-setting-control">
          <input
            id="theme-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            :disabled="busy || themeState.loading"
            @change="onFile"
          />
          <img
            v-if="backgroundPreview"
            :src="backgroundPreview"
            class="theme-preview"
            alt="待保存的个人背景"
          />
          <el-button
            v-if="draft.hasBackground"
            class="theme-remove-background"
            :disabled="busy || themeState.loading"
            @click="discardBackground"
            >移除图片</el-button
          >
        </div>
      </div>
      <p class="theme-hint">
        支持静态 JPG、PNG、WebP，最大5MB。所有修改点击“保存设置”后生效，关闭则放弃未保存的修改。
      </p>
    </div>
    <template #footer>
      <el-button :disabled="busy || themeState.loading" @click="restoreDefaults"
        >恢复默认</el-button
      >
      <el-button :disabled="busy" @click="open = false">关闭</el-button>
      <el-button
        type="primary"
        :loading="busy"
        :disabled="themeState.loading || Boolean(themeState.error)"
        @click="saveSettings"
        >保存设置</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch, onUnmounted } from 'vue';
import { ElColorPicker, ElMessage, ElMessageBox } from 'element-plus';
import 'element-plus/es/components/color-picker/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import { themeState, loadTheme, saveTheme, defaultThemeSettings } from '@/utils/theme';
import { getErrorMessage } from '@/utils/errors';
const open = ref(false);
const busy = ref(false);
const draft = reactive({ ...themeState.settings });
const pendingBackground = shallowRef<File | null | undefined>();
const pendingPreview = ref('');
const backgroundPreview = computed(() =>
  pendingBackground.value === undefined ? themeState.backgroundUrl : pendingPreview.value,
);
const colors = ['#409eff', '#7c3aed', '#059669', '#e11d48', '#d97706'];
function clearPreview() {
  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
  pendingPreview.value = '';
}
function resetDraft() {
  Object.assign(draft, themeState.settings);
  pendingBackground.value = undefined;
  clearPreview();
}
watch(open, resetDraft);
watch(
  () => themeState.loading,
  (loading) => {
    if (!loading) resetDraft();
  },
);
const beforeClose = (done: () => void) => {
  if (!busy.value) done();
};
onUnmounted(clearPreview);
async function saveSettings() {
  if (busy.value || themeState.loading || themeState.error) return;
  busy.value = true;
  try {
    await saveTheme({ ...draft }, pendingBackground.value);
    resetDraft();
    ElMessage.success('主题已保存');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '主题更新失败'));
  } finally {
    busy.value = false;
  }
}
function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    ElMessage.error('请选择5MB以内的 JPG、PNG 或 WebP 图片');
    return;
  }
  clearPreview();
  pendingBackground.value = file;
  pendingPreview.value = URL.createObjectURL(file);
  draft.hasBackground = true;
}
function discardBackground() {
  clearPreview();
  pendingBackground.value = null;
  draft.hasBackground = false;
}
async function restoreDefaults() {
  try {
    await ElMessageBox.confirm(
      '将设置重置为浅色、默认主题色和无背景图片，点击“保存设置”后生效。',
      '恢复默认',
      {
        confirmButtonText: '恢复',
        cancelButtonText: '取消',
      },
    );
    Object.assign(draft, defaultThemeSettings());
    discardBackground();
  } catch {
    /* User cancelled. */
  }
}
</script>
<style scoped>
:global(.theme-settings-dialog .el-dialog__body) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
:global(.theme-settings-dialog .el-dialog__body::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}
.theme-launcher {
  position: fixed;
  right: 36px;
  bottom: 36px;
  z-index: 100;
  height: var(--app-button-height);
  padding: 0 var(--app-button-padding);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 550;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
}
.theme-settings {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}
.theme-setting-row {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  min-width: 0;
}
.theme-setting-control {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.theme-settings label {
  display: flex;
  align-items: center;
  min-height: 44px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--el-text-color-primary);
}
.theme-mode-select {
  width: 100%;
  min-width: 0;
}
.theme-mode-select :deep(.el-select__wrapper) {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
}
.theme-mode-select :deep(.el-select__wrapper:not(.is-disabled):hover) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}
.theme-mode-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
:global(.theme-mode-options.el-popper) {
  border-radius: 12px;
  box-shadow: 0 10px 30px rgb(15 23 42 / 12%);
}
:global(.theme-mode-options .el-select-dropdown__list) {
  padding: 6px;
}
:global(.theme-mode-options .el-select-dropdown__item) {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
}
:global(.theme-mode-options .el-select-dropdown__item.is-selected) {
  color: var(--ui-accent-text, var(--el-color-primary));
  background: var(--el-color-primary-light-9);
  font-weight: 600;
}
:global(.theme-color-picker.el-color-picker) {
  width: 100%;
  height: 44px;
  min-width: 0;
}
:global(.theme-color-picker .el-color-picker__trigger) {
  width: 100%;
  height: 44px;
  padding: 5px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-light);
  cursor: pointer;
}
:global(.theme-color-picker .el-color-picker__color) {
  overflow: hidden;
  border: 0;
  border-radius: 7px;
}
.theme-settings input[type='range'] {
  width: 100%;
  min-width: 0;
  margin: 0;
  accent-color: var(--el-color-primary);
  cursor: pointer;
}
.theme-overlay-control {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 44px;
}
.theme-overlay-control output {
  flex-shrink: 0;
  min-width: 34px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.theme-settings input[type='file'] {
  width: 100%;
  min-width: 0;
  height: 44px;
  padding: 5px 8px;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  line-height: 20px;
  color: var(--theme-muted);
}
.theme-settings input[type='file']::file-selector-button {
  padding: 5px 10px;
  margin-right: 8px;
  border: 0;
  border-radius: 8px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-weight: 550;
  cursor: pointer;
}
.theme-remove-background {
  justify-self: start;
  margin: 0;
}
.theme-hint {
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
  margin: 0;
}
.theme-preview {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid var(--el-border-color-lighter);
}
.color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.color-presets button {
  width: 30px;
  height: 30px;
  border: 3px solid var(--el-bg-color);
  border-radius: 50%;
  outline: 1px solid var(--el-border-color-light);
  cursor: pointer;
  transition: transform 160ms;
}
.color-presets button:hover {
  transform: scale(1.15);
}
@media (max-width: 640px) {
  .theme-launcher {
    right: max(20px, env(safe-area-inset-right));
    bottom: max(20px, env(safe-area-inset-bottom));
    height: var(--app-button-height);
    padding: 0 var(--app-button-padding);
  }
}
@media (max-width: 480px) {
  .theme-setting-row {
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 12px;
  }
  .color-presets {
    gap: 6px;
  }
  .color-presets button {
    width: 26px;
    height: 26px;
  }
}
</style>
