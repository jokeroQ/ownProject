<template>
  <el-tooltip content="返回收藏" placement="bottom" :show-after="250" :trigger-keys="[]">
    <el-button
      class="app-icon-button page-back-button"
      :icon="Back"
      aria-label="返回收藏"
      @click="emit('click', $event)"
    />
  </el-tooltip>
</template>
<script setup lang="ts">
import { ElButton, ElTooltip } from 'element-plus';
import { Back } from '@element-plus/icons-vue';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/tooltip/style/css';
const emit = defineEmits<{ click: [event: MouseEvent] }>();
</script>
<style scoped>
.page-back-button.el-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  width: 32px;
  min-width: 32px;
  height: 32px;
  margin: 0;
  font-size: 18px;
}
.page-back-button :deep(.el-icon),
.page-back-button :deep(svg) {
  display: block;
  width: 18px;
  height: 18px;
  font-size: 18px;
}
</style>
