<template>
  <span class="bookmark-icon" aria-hidden="true">
    <img
      v-if="source && failedSource !== source"
      :src="source"
      alt=""
      :draggable="false"
      @error="failedSource = source"
    />
    <span v-else class="bookmark-initial">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{ icon?: string | null; title: string }>();
const source = computed(() => props.icon?.trim() || '');
const initial = computed(() => Array.from(props.title.trim())[0] || '?');
const failedSource = ref('');
watch(source, () => {
  failedSource.value = '';
});
</script>

<style scoped lang="less">
.bookmark-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--ui-accent-text, var(--el-color-primary));
  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
  }
}
.bookmark-initial {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}
@media (max-width: 640px) {
  .bookmark-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
  }
  .bookmark-initial {
    font-size: 22px;
  }
}
</style>
