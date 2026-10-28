<template>
  <div class="theme-preview-page">
    <header class="preview-header">
      <PageBackButton @click="goBack" />
      <div>
        <h1>颜色变量测试</h1>
        <p>查看当前主题的色彩搭配与组件效果</p>
      </div>
      <span class="preview-mode-badge">{{
        themeState.settings.mode === 'dark' ? '深色主题' : '浅色主题'
      }}</span>
    </header>
    <div class="preview-toolbar">
      <div class="preview-theme-field">
        <label for="preview-theme-mode">外观</label
        ><el-select
          id="preview-theme-mode"
          class="preview-theme-select"
          aria-label="预览主题"
          :model-value="themeState.settings.mode"
          :disabled="themeState.loading || saving"
          @change="changeTheme"
          ><el-option value="light" label="浅色" /><el-option value="dark" label="深色"
        /></el-select>
      </div>
      <span class="preview-save-hint" role="status">{{
        saving ? '正在保存…' : '切换外观后自动保存到当前账号'
      }}</span>
    </div>
    <div class="preview-content">
      <section class="palette-section" aria-labelledby="palette-title">
        <div class="section-heading">
          <h2 id="palette-title">对应色卡匹配</h2>
          <span>{{ colorCount }} 个颜色变量</span>
          <el-button :icon="Plus" :disabled="saving || themeState.loading" @click="editColor()"
            >新增色卡</el-button
          >
        </div>
        <section
          v-for="group in colorGroups"
          :key="group.title"
          class="color-group"
          :aria-label="group.title"
        >
          <h3>{{ group.title }}</h3>
          <div class="palette-grid">
            <article
              v-for="item in group.items"
              :key="item.variable"
              class="color-card"
              :data-color-variable="item.variable"
            >
              <div class="color-swatch" :style="{ backgroundColor: `var(${item.variable})` }"></div>
              <div class="color-card-content">
                <h4>{{ item.label }}</h4>
                <el-button
                  class="color-edit app-icon-button"
                  :icon="Edit"
                  :aria-label="`编辑${item.label}`"
                  :title="`编辑${item.label}`"
                  :disabled="saving || themeState.loading"
                  @click="editColor(item)"
                />
                <code class="variable-name">{{ item.variable }}</code
                ><span class="color-value">{{
                  colorValues[item.variable] || '当前外观未设置'
                }}</span>
              </div>
            </article>
          </div>
        </section>
      </section>
      <aside class="component-preview" aria-labelledby="component-preview-title">
        <div class="section-heading">
          <h2 id="component-preview-title">组件效果</h2>
          <span class="live-dot">跟随主题</span>
        </div>
        <div class="example-card">
          <span class="example-eyebrow">内容卡片</span>
          <h3>让颜色保持一致</h3>
          <p>正文、辅助信息和强调色会随当前主题同步变化。</p>
          <span class="example-link">这是一段强调文字</span>
        </div>
        <div class="example-field">
          <label for="preview-example-input">输入框</label
          ><el-input id="preview-example-input" model-value="主题效果预览" readonly />
        </div>
        <div class="example-buttons">
          <el-button type="primary" @click="previewFeedback('主要按钮')">主要按钮</el-button
          ><el-button @click="previewFeedback('默认按钮')">默认按钮</el-button
          ><el-button disabled>禁用状态</el-button>
        </div>
        <p class="component-note">色卡展示页面当前生效的 CSS 变量，可用于核对深浅色主题。</p>
      </aside>
    </div>
    <el-dialog
      v-model="editorOpen"
      :title="originalVariable ? '编辑色卡' : '新增色卡'"
      width="460"
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form label-width="72px" label-position="left" @submit.prevent="saveColor">
        <el-form-item label="名称"
          ><el-input
            v-model="colorDraft.label"
            maxlength="24"
            aria-label="色卡名称"
            :disabled="saving"
        /></el-form-item>
        <el-form-item label="变量名"
          ><el-input
            v-model="colorDraft.variable"
            aria-label="色卡变量名"
            :disabled="saving || isBuiltin"
            maxlength="65"
        /></el-form-item>
        <el-form-item label="颜色"
          ><div class="color-value-editor">
            <el-color-picker
              v-model="colorDraft.value"
              color-format="hex"
              :disabled="saving"
              aria-label="选择色卡颜色"
            /><el-input
              v-model="colorDraft.value"
              aria-label="色卡颜色值"
              placeholder="#409eff"
              maxlength="9"
              :disabled="saving"
            /></div
        ></el-form-item>
      </el-form>
      <p class="color-editor-hint">
        仅修改当前{{
          themeState.settings.mode === 'dark' ? '深色' : '浅色'
        }}外观。点击保存后生效；新增变量使用 --custom- 前缀。
      </p>
      <template #footer
        ><div class="color-dialog-footer">
          <el-button
            v-if="originalVariable"
            text
            type="danger"
            :disabled="saving"
            @click="removeColor"
            >{{ isBuiltin ? '恢复默认' : '删除色卡' }}</el-button
          ><span></span><el-button :disabled="saving" @click="editorOpen = false">取消</el-button
          ><el-button type="primary" :loading="saving" @click="saveColor">保存</el-button>
        </div></template
      >
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElInput, ElMessage, ElOption, ElSelect } from 'element-plus';
import { Edit, Plus } from '@element-plus/icons-vue';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/select/style/css';
import 'element-plus/es/components/tooltip/style/css';
import { themeState, saveTheme, type ColorCard } from '@/utils/theme';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'ThemePreviewPage' });
const route = useRoute(),
  router = useRouter();
const saving = ref(false),
  colorValues = ref<Record<string, string>>({});
const baseColorGroups = [
  {
    title: '背景与层次',
    items: [
      { label: '页面背景', variable: '--background-main' },
      { label: '顶部背景', variable: '--background-header' },
      { label: '侧栏背景', variable: '--background-aside' },
      { label: '浮层背景', variable: '--el-bg-color-overlay' },
    ],
  },
  {
    title: '文字与强调',
    items: [
      { label: '主要文字', variable: '--font-primary' },
      { label: '强调文字', variable: '--font-highlight' },
      { label: '辅助文字', variable: '--theme-muted' },
      { label: '占位文字', variable: '--el-text-color-placeholder' },
    ],
  },
  {
    title: '边框与交互',
    items: [
      { label: '默认边框', variable: '--el-border-color' },
      { label: '浅色边框', variable: '--el-border-color-light' },
      { label: '浅色填充', variable: '--el-fill-color-light' },
      { label: '主题浅色', variable: '--el-color-primary-light-9' },
    ],
  },
];
const builtinVariables = new Set(
  baseColorGroups.flatMap((group) => group.items.map((item) => item.variable)),
);
const colorGroups = computed(() => {
  const cards = themeState.settings.colorCards || [];
  const groups = baseColorGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      label: cards.find((card) => card.variable === item.variable)?.label || item.label,
    })),
  }));
  const custom = cards.filter((card) => !builtinVariables.has(card.variable));
  if (custom.length) groups.push({ title: '自定义色卡', items: custom });
  return groups;
});
const colorCount = computed(() =>
  colorGroups.value.reduce((count, group) => count + group.items.length, 0),
);
const editorOpen = ref(false),
  originalVariable = ref('');
const colorDraft = reactive({ label: '', variable: '--custom-', value: '#409eff' });
const isBuiltin = computed(() => builtinVariables.has(originalVariable.value));
function editColor(item?: { label: string; variable: string }) {
  originalVariable.value = item?.variable || '';
  let value = '#409eff';
  if (item) {
    const swatch = Array.from(document.querySelectorAll<HTMLElement>('[data-color-variable]'))
      .find((card) => card.dataset.colorVariable === item.variable)
      ?.querySelector('.color-swatch');
    const actual = swatch ? getComputedStyle(swatch).backgroundColor : '';
    const parts = actual.match(/[\d.]+/g)?.map(Number);
    if (parts && parts.length >= 3)
      value =
        '#' +
        parts
          .slice(0, 3)
          .map((part) => Math.round(part).toString(16).padStart(2, '0'))
          .join('');
    value =
      (themeState.settings.colorCards || []).find((card) => card.variable === item.variable)?.[
        themeState.settings.mode
      ] || value;
  }
  Object.assign(colorDraft, {
    label: item?.label || '',
    variable: item?.variable || '--custom-',
    value,
  });
  editorOpen.value = true;
}
async function persistCards(cards: ColorCard[]) {
  if (saving.value) return;
  saving.value = true;
  try {
    await saveTheme({ ...themeState.settings, colorCards: cards });
    editorOpen.value = false;
    await readColors();
    ElMessage.success('色卡已保存');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '色卡保存失败'));
  } finally {
    saving.value = false;
  }
}
function saveColor() {
  const variable = colorDraft.variable.trim(),
    label = colorDraft.label.trim(),
    value = colorDraft.value;
  const others = (themeState.settings.colorCards || []).filter(
    (card) => card.variable !== originalVariable.value,
  );
  if (
    !label ||
    label.length > 24 ||
    (!isBuiltin.value && !/^--custom-[a-z][a-z0-9-]{0,55}$/.test(variable)) ||
    !/^#[a-f0-9]{6}([a-f0-9]{2})?$/i.test(value || '') ||
    others.some((card) => card.variable === variable)
  ) {
    ElMessage.warning('请填写名称、有效颜色及不重复的 --custom- 变量名');
    return;
  }
  const previous = (themeState.settings.colorCards || []).find(
    (card) => card.variable === originalVariable.value,
  );
  void persistCards([
    ...others,
    { ...previous, label, variable, [themeState.settings.mode]: value },
  ]);
}
function removeColor() {
  const cards = (themeState.settings.colorCards || []).flatMap((card) => {
    if (card.variable !== originalVariable.value) return [card];
    if (!isBuiltin.value) return [];
    const updated = { ...card };
    delete updated[themeState.settings.mode];
    return updated.light || updated.dark ? [updated] : [];
  });
  void persistCards(cards);
}
async function readColors() {
  await nextTick();
  const style = getComputedStyle(document.documentElement);
  colorValues.value = Object.fromEntries(
    colorGroups.value.flatMap((group) =>
      group.items.map((item) => [item.variable, style.getPropertyValue(item.variable).trim()]),
    ),
  );
}
async function changeTheme(mode: 'light' | 'dark') {
  if (saving.value || mode === themeState.settings.mode) return;
  saving.value = true;
  try {
    await saveTheme({ ...themeState.settings, mode });
  } catch {
    ElMessage.error('主题保存失败');
  } finally {
    saving.value = false;
  }
}
function previewFeedback(label: string) {
  ElMessage.info(`${label}效果预览`);
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
watch(
  () => [
    themeState.settings.mode,
    themeState.settings.primaryColor,
    themeState.settings.colorCards,
  ],
  readColors,
  {
    flush: 'post',
  },
);
onMounted(readColors);
</script>

<style scoped>
.theme-preview-page {
  width: 100%;
  max-width: 1600px;
  min-width: 0;
  margin: 0 auto;
  padding: 24px;
  color: var(--theme-text);
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}
.preview-header > div {
  flex: 1;
  min-width: 0;
}
.preview-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.5px;
}
.preview-header p {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--theme-muted);
}
.preview-mode-badge {
  padding: 5px 9px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--ui-accent-text);
  font-size: 11px;
  white-space: nowrap;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 24px;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--theme-surface);
}
.preview-theme-field {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
}
.preview-theme-field label {
  white-space: nowrap;
}
.preview-theme-select {
  width: 140px;
}
.preview-theme-select :deep(.el-select__wrapper) {
  min-height: var(--app-button-height);
  border-radius: 8px;
}
.preview-save-hint {
  font-size: 11px;
  color: var(--theme-muted);
}
.preview-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 286px;
  align-items: start;
  gap: 24px;
}
.palette-section {
  min-width: 0;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.section-heading h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.section-heading > span {
  font-size: 11px;
  color: var(--theme-muted);
}
.color-group {
  margin-top: 22px;
}
.color-group > h3 {
  margin: 0 0 10px;
  color: var(--theme-muted);
  font-size: 12px;
  font-weight: 500;
}
.palette-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.color-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--theme-surface);
}
.color-swatch {
  height: 68px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.color-card-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  padding: 12px;
}
.color-card h4 {
  padding-right: 22px;
  margin: 0;
  font-size: 12px;
  font-weight: 500;
}
.variable-name {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  color: var(--theme-muted);
  font-family: Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
}
.color-value {
  max-width: 100%;
  margin-top: 2px;
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-family: Consolas, monospace;
  font-size: 10px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.component-preview {
  position: sticky;
  top: 24px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--theme-surface);
}
.live-dot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.live-dot::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--el-color-primary);
}
.example-card {
  margin-top: 22px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.example-eyebrow {
  color: var(--theme-muted);
  font-size: 10px;
}
.example-card h3 {
  margin: 10px 0 8px;
  font-size: 15px;
  font-weight: 600;
}
.example-card p {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--theme-muted);
}
.example-link {
  font-size: 12px;
  color: var(--ui-accent-text);
}
.example-field {
  display: grid;
  gap: 8px;
  margin-top: 20px;
  font-size: 12px;
}
.example-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.example-buttons .el-button {
  margin: 0;
}
.component-note {
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--theme-muted);
  font-size: 11px;
  line-height: 1.8;
}
@media (max-width: 1250px) {
  .palette-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .theme-preview-page {
    padding: 16px;
  }
  .preview-content {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .component-preview {
    position: static;
  }
  .palette-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .theme-preview-page {
    padding: 12px;
  }
  .preview-header {
    gap: 10px;
    margin-bottom: 16px;
  }
  .preview-header h1 {
    font-size: 18px;
  }
  .preview-header p {
    display: none;
  }
  .preview-toolbar {
    margin-bottom: 18px;
    padding: 10px 12px;
  }
  .preview-theme-select {
    width: 120px;
  }
  .preview-save-hint {
    font-size: 10px;
  }
  .palette-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .color-group {
    margin-top: 18px;
  }
  .color-card-content {
    padding: 10px;
  }
  .component-preview {
    padding: 16px;
  }
}
.color-edit {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 26px;
  height: 26px;
}
.color-value-editor {
  display: flex;
  gap: 10px;
  width: 100%;
  align-items: center;
}
.color-value-editor > .el-input {
  flex: 1;
  min-width: 0;
}
.color-editor-hint {
  font-size: 12px;
  color: var(--theme-muted);
  line-height: 1.8;
  margin: 0;
}
.color-dialog-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color-dialog-footer > span {
  flex: 1;
}
.color-dialog-footer .el-button {
  margin: 0;
}
.palette-section > .section-heading > span {
  margin-right: auto;
}
</style>
