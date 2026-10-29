<template>
  <el-tooltip :content="label" placement="bottom" :show-after="250" :trigger-keys="[]">
    <el-button
      class="app-icon-button page-back-button"
      :icon="Back"
      :aria-label="label"
      @click="emit('click', $event)"
    />
  </el-tooltip>
</template>
<script setup lang="ts">
import { ElButton, ElTooltip } from 'element-plus';
import { Back } from '@element-plus/icons-vue';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/tooltip/style/css';
withDefaults(defineProps<{ label?: string }>(), { label: '返回收藏' });
const emit = defineEmits<{ click: [event: MouseEvent] }>();
</script>
<style scoped>
.page-back-button.el-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--app-button-height, 32px);
  width: var(--app-button-height, 32px);
  min-width: var(--app-button-height, 32px);
  height: var(--app-button-height, 32px);
  margin: 0;
  font-size: var(--app-icon-size, 18px);
}
.page-back-button :deep(.el-icon),
.page-back-button :deep(svg) {
  display: block;
  width: var(--app-icon-size, 18px);
  height: var(--app-icon-size, 18px);
  font-size: var(--app-icon-size, 18px);
}
</style>
