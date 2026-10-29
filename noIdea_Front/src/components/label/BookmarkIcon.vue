<template>
  <span class="bookmark-icon" aria-hidden="true">
    <img
      v-if="source && failedSource !== source"
      :key="source"
      :src="source"
      referrerpolicy="no-referrer"
      alt=""
      :draggable="false"
      @error="onImageError"
    />
    <span v-else class="bookmark-initial">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { bookmarkInitial, isTextBookmarkIcon } from '@/utils/bookmarkMetadata';
const props = defineProps<{ icon?: string | null; title: string }>();
const iconValue = computed(() => props.icon?.trim() || '');
const source = computed(() => (isTextBookmarkIcon(iconValue.value) ? '' : iconValue.value));
const initial = computed(() =>
  isTextBookmarkIcon(iconValue.value) ? iconValue.value : bookmarkInitial(props.title),
);
const failedSource = ref('');
const onImageError = (event: Event) => {
  const image = event.target as HTMLImageElement;
  if (image.getAttribute('src') === source.value) failedSource.value = source.value;
};
watch(source, () => {
  failedSource.value = '';
});
</script>

<style scoped lang="less">
.bookmark-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 10px;
  background: var(--app-accent-soft);
  color: var(--ui-accent-text, var(--el-color-primary));
  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
  }
}
.bookmark-initial {
  font-size: 21px;
  font-weight: 600;
  line-height: 1;
}
@media (max-width: 640px) {
  .bookmark-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }
  .bookmark-initial {
    font-size: 18px;
  }
}
</style>
