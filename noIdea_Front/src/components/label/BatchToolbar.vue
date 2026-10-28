<template>
  <div
    class="batch-toolbar"
    :class="{ 'has-selection': selectedIds.length > 0 }"
    aria-label="批量书签操作"
  >
    <div class="batch-selection">
      <button
        class="batch-select-all"
        type="button"
        :aria-pressed="allSelected"
        :disabled="busy || !editable.length"
        @click="toggleAll"
      >
        {{ allSelected ? '取消全选' : '全选' }}
      </button>
      <span class="selection-divider" aria-hidden="true" />
      <span class="selection-count" role="status"
        >已选 <strong>{{ selectedIds.length }}</strong> 项</span
      >
    </div>
    <p class="batch-guidance">空白处框选 · 拖动所选项移动</p>
    <div class="batch-actions">
      <el-tooltip content="移动到分类" :show-after="250" :trigger-keys="[]">
        <span class="batch-action-wrap">
          <el-button
            class="app-icon-button batch-action"
            :icon="FolderOpened"
            aria-label="移动到"
            :disabled="busy || !selectedIds.length"
            @click="openMove"
          />
        </span>
      </el-tooltip>
      <el-tooltip content="删除所选书签" :show-after="250" :trigger-keys="[]">
        <span class="batch-action-wrap">
          <el-button
            class="app-icon-button batch-action batch-action--delete"
            :icon="Delete"
            aria-label="删除"
            :disabled="busy || !selectedIds.length"
            @click="remove"
          />
        </span>
      </el-tooltip>
      <el-tooltip content="取消选择" :show-after="250" :trigger-keys="[]">
        <span class="batch-action-wrap">
          <el-button
            class="app-icon-button batch-action"
            :icon="Close"
            aria-label="取消选择"
            :disabled="busy || !selectedIds.length"
            @click="emit('update:selectedIds', [])"
          />
        </span>
      </el-tooltip>
      <el-tooltip
        content="空白处拉框选择，点击卡片增减选择；按住 Ctrl / ⌘ / Shift 框选可追加。拖动已选卡片可整组移动。"
        :show-after="250"
        :trigger-keys="[]"
        popper-class="batch-help-tooltip"
      >
        <el-button
          class="app-icon-button batch-action batch-help"
          :icon="QuestionFilled"
          aria-label="选择操作说明"
        />
      </el-tooltip>
    </div>
    <el-dialog
      v-model="moving"
      title="批量移动书签"
      width="420"
      :close-on-click-modal="!busy"
      :close-on-press-escape="!busy"
      :show-close="!busy"
    >
      <el-form label-width="72px" label-position="left"
        ><el-form-item label="目标分类"
          ><el-select
            v-model="target"
            placeholder="请选择分类"
            aria-label="目标分类"
            :disabled="busy"
            ><el-option
              v-for="menu in menus"
              :key="menu.id"
              :value="menu.id"
              :label="menu.title" /></el-select></el-form-item
      ></el-form>
      <p class="move-hint">将 {{ selectedIds.length }} 个书签一起移到所选分类末尾。</p>
      <template #footer
        ><el-button :disabled="busy" @click="moving = false">取消</el-button
        ><el-button type="primary" :loading="busy" :disabled="!target" @click="move"
          >确认移动</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Close, Delete, FolderOpened, QuestionFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import apiClient from '@/api/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type { Menu } from '@/utils/types';
const props = defineProps<{ menus: Menu[]; selectedIds: number[]; busy: boolean }>();
const emit = defineEmits<{
  'update:selectedIds': [ids: number[]];
  'update:busy': [busy: boolean];
  changed: [];
}>();
const moving = ref(false),
  target = ref<number>();
const editable = computed(() =>
  props.menus
    .flatMap((menu) => menu.menuLists)
    .filter((item) => item.can_edit)
    .map((item) => item.id),
);
const allSelected = computed(
  () => editable.value.length > 0 && editable.value.every((id) => props.selectedIds.includes(id)),
);
function toggleAll() {
  emit('update:selectedIds', allSelected.value ? [] : editable.value);
}
function openMove() {
  target.value = undefined;
  moving.value = true;
}
async function run(action: 'move' | 'delete', ids: number[]) {
  emit('update:busy', true);
  try {
    await apiClient.post('/menu/subMenus/batch', {
      action,
      ids,
      ...(action === 'move' ? { menuId: target.value } : {}),
    });
    emit('update:selectedIds', []);
    moving.value = false;
    emit('changed');
    ElMessage.success(action === 'move' ? '所选书签已移动' : '所选书签已删除');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '批量操作失败，请重试'));
  } finally {
    emit('update:busy', false);
  }
}
function move() {
  if (!props.busy && target.value && props.selectedIds.length)
    void run('move', [...props.selectedIds]);
}
async function remove() {
  if (props.busy || !props.selectedIds.length) return;
  const ids = [...props.selectedIds];
  emit('update:busy', true);
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${ids.length} 个书签吗？删除后无法恢复。`,
      '删除所选书签',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    );
  } catch {
    emit('update:busy', false);
    return;
  }
  await run('delete', ids);
}
</script>
<style scoped>
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
  padding: 7px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: color-mix(in srgb, var(--el-bg-color) 94%, transparent);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 4;
  box-shadow: 0 2px 8px rgb(15 23 42 / 2%);
}
.batch-selection {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.batch-select-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
  color: var(--theme-text);
  cursor: pointer;
}
.batch-select-all:not(:disabled):hover,
.batch-select-all[aria-pressed='true'] {
  color: var(--ui-accent-text, var(--el-color-primary));
}
.batch-select-all:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.batch-select-all:disabled {
  color: var(--theme-muted);
  opacity: 0.45;
  cursor: not-allowed;
}
.selection-divider {
  height: 14px;
  width: 1px;
  background: var(--el-border-color-lighter);
}
.selection-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--theme-muted);
  white-space: nowrap;
}
.selection-count strong {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.has-selection .selection-count strong {
  background: var(--el-color-primary-light-9);
  color: var(--ui-accent-text, var(--el-color-primary));
}
.batch-guidance {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.batch-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
  margin-left: auto;
}
.batch-action-wrap {
  display: inline-flex;
}
.batch-actions .batch-action {
  width: 32px;
  min-width: 32px;
  height: 32px;
  margin: 0;
  font-size: 16px;
}
.batch-actions .batch-action--delete:not(:disabled) {
  color: var(--el-color-danger);
}
.batch-help {
  opacity: 0.7;
}
.move-hint {
  font-size: 12px;
  color: var(--theme-muted);
  line-height: 1.7;
  margin-bottom: 0;
}
.el-select {
  width: 100%;
}
@media (max-width: 1000px) {
  .batch-guidance {
    display: none;
  }
}
@media (max-width: 600px) {
  .batch-toolbar {
    padding: 5px 8px;
    gap: 8px;
  }
  .batch-selection {
    gap: 7px;
  }
  .batch-select-all {
    font-size: 12px;
    padding: 0 2px;
  }
  .selection-count {
    gap: 3px;
  }
  .batch-actions {
    gap: 0;
  }
  .batch-actions .batch-action {
    min-width: 28px;
    width: 28px;
  }
}
</style>
<style>
.batch-help-tooltip {
  max-width: min(300px, calc(100vw - 32px));
  line-height: 1.7;
}
</style>
