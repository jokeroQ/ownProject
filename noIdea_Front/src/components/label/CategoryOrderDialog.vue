<template>
  <el-dialog
    v-model="open"
    title="调整分类顺序"
    width="440"
    :show-close="!saving"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
  >
    <p class="sort-hint">拖动分类调整顺序，也可以点击右侧箭头。保存后同步到左侧列表。</p>
    <ol class="category-order-list">
      <li
        v-for="(menu, index) in draft"
        :key="menu.id"
        :data-sort-category="menu.id"
        :draggable="!saving"
        :class="{ 'is-over': over === menu.id }"
        @dragstart="start($event, menu.id)"
        @dragover.prevent="over = menu.id"
        @dragleave="over = null"
        @drop.prevent="drop(menu.id)"
        @dragend="
          dragged = null;
          over = null;
        "
      >
        <el-icon class="sort-handle" aria-hidden="true"><Rank /></el-icon
        ><span :title="menu.title">{{ menu.title }}</span
        ><el-button
          class="app-icon-button"
          :icon="ArrowUp"
          :aria-label="`上移${menu.title}`"
          title="上移"
          :disabled="saving || index === 0"
          @click="swap(index, index - 1)"
        /><el-button
          class="app-icon-button"
          :icon="ArrowDown"
          :aria-label="`下移${menu.title}`"
          title="下移"
          :disabled="saving || index === draft.length - 1"
          @click="swap(index, index + 1)"
        />
      </li>
    </ol>
    <template #footer
      ><el-button :disabled="saving" @click="open = false">取消</el-button
      ><el-button type="primary" :loading="saving" :disabled="!draft.length" @click="save"
        >保存顺序</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Rank, ArrowUp, ArrowDown } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { Menu } from '@/utils/types';
import apiClient from '@/api/apiClient';
import { getErrorMessage } from '@/utils/errors';
const open = defineModel<boolean>({ default: false });
const props = defineProps<{ menus: Menu[] }>();
const emit = defineEmits<{ changed: [] }>();
const draft = ref<{ id: number; title: string }[]>([]),
  saving = ref(false),
  dragged = ref<number | null>(null),
  over = ref<number | null>(null);
watch(open, (value) => {
  if (value) draft.value = props.menus.map((menu) => ({ id: menu.id, title: menu.title }));
});
function start(event: DragEvent, id: number) {
  dragged.value = id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
  }
}
function swap(from: number, to: number) {
  if (saving.value || to < 0 || to >= draft.value.length) return;
  const [item] = draft.value.splice(from, 1);
  draft.value.splice(to, 0, item);
}
function drop(id: number) {
  if (dragged.value === null || dragged.value === id || saving.value) return;
  const from = draft.value.findIndex((item) => item.id === dragged.value),
    to = draft.value.findIndex((item) => item.id === id);
  if (from >= 0 && to >= 0) swap(from, to);
  dragged.value = null;
  over.value = null;
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    await apiClient.put('/menu/order', { ids: draft.value.map((menu) => menu.id) });
    open.value = false;
    emit('changed');
    ElMessage.success('分类顺序已保存');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '排序保存失败'));
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped>
.sort-hint {
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 1.8;
  margin: 0 0 14px;
}
.category-order-list {
  display: grid;
  gap: 6px;
  list-style: none;
  padding: 0;
  margin: 0;
}
.category-order-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.category-order-list li.is-over {
  border-color: var(--el-color-primary);
}
.category-order-list li > span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.sort-handle {
  color: var(--theme-muted);
  cursor: grab;
}
.category-order-list .el-button {
  margin: 0;
  width: 26px;
  flex-shrink: 0;
}
</style>
