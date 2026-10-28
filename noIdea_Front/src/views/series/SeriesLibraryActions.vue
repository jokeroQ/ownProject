<template>
  <div class="library-actions">
    <span class="watch-label">{{ statusLabel }}</span>
    <el-tooltip :content="favorite ? '取消收藏' : '加入收藏'" :trigger-keys="[]" :show-after="200">
      <el-button
        class="app-icon-button library-icon"
        :class="{ 'is-favorite': favorite }"
        :icon="favorite ? StarFilled : Star"
        :aria-label="favorite ? '取消收藏' : '收藏作品'"
        :aria-pressed="favorite"
        :disabled="disabled"
        @click="emit('change', { favorite: !favorite })"
      />
    </el-tooltip>
    <el-dropdown trigger="click" :disabled="disabled" @command="command">
      <el-button
        class="app-icon-button library-icon"
        :class="{ 'has-status': watchStatus !== 'none' }"
        :icon="watchStatus === 'watching' ? VideoPlay : Clock"
        aria-label="设置观看状态"
        :title="
          watchStatus === 'watching'
            ? '正在观看：点击修改状态'
            : watchStatus === 'want'
              ? '想看：点击修改状态'
              : '设置想看或正在观看'
        "
        :disabled="disabled"
      />
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="want" :disabled="watchStatus === 'want'" :icon="Clock"
            >想看</el-dropdown-item
          >
          <el-dropdown-item
            command="watching"
            :disabled="watchStatus === 'watching'"
            :icon="VideoPlay"
            >正在观看</el-dropdown-item
          >
          <el-dropdown-item v-if="watchStatus !== 'none'" command="none"
            >清除观看状态</el-dropdown-item
          >
          <el-dropdown-item
            v-if="favorite || watchStatus !== 'none'"
            command="remove"
            divided
            :icon="Delete"
            >从片单移除</el-dropdown-item
          >
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Clock, Delete, Star, StarFilled, VideoPlay } from '@element-plus/icons-vue';
import type { WatchStatus } from '@/api/series';
const props = defineProps<{ favorite: boolean; watchStatus: WatchStatus; disabled: boolean }>();
const emit = defineEmits<{
  change: [patch: { favorite?: boolean; watchStatus?: WatchStatus }];
  remove: [];
}>();
const statusLabel = computed(() =>
  props.watchStatus === 'watching'
    ? '正在观看'
    : props.watchStatus === 'want'
      ? '想看'
      : props.favorite
        ? '已收藏'
        : '',
);
function command(value: string) {
  if (value === 'remove') emit('remove');
  else if (['none', 'want', 'watching'].includes(value))
    emit('change', { watchStatus: value as WatchStatus });
}
</script>
<style scoped>
.library-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.watch-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--theme-muted);
  font-size: 10px;
}
.library-icon.el-button {
  width: 28px;
  min-width: 28px;
  height: 28px;
  margin: 0;
  font-size: 16px;
}
.library-icon.is-favorite {
  color: var(--el-color-warning);
}
.library-icon.has-status {
  color: var(--el-color-primary);
}
</style>
