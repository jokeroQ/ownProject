<template>
  <span ref="host" class="series-poster">
    <img
      v-if="displayUrl && !failed"
      :src="displayUrl"
      :alt="title"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else class="poster-fallback" aria-hidden="true"
      ><span>{{ Array.from(title)[0] || '剧' }}</span
      ><small>{{ src && !failed ? '海报加载中' : '暂无海报' }}</small></span
    >
  </span>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import apiClient from '@/api/apiClient';
const props = defineProps<{ src: string; title: string }>();
const failed = ref(false);
const host = ref<HTMLElement | null>(null),
  displayUrl = ref('');
let observer: IntersectionObserver | undefined,
  controller: AbortController | undefined,
  objectUrl = '',
  visible = false;
function clear() {
  controller?.abort();
  controller = undefined;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
  displayUrl.value = '';
}
async function load() {
  if (
    !props.src ||
    !visible ||
    displayUrl.value ||
    failed.value ||
    (controller && !controller.signal.aborted)
  )
    return;
  const request = new AbortController();
  controller = request;
  const proxy = /^https:\/\/(?:img[1239]\.doubanio\.com|lain\.bgm\.tv|static\.tvmaze\.com)\//.test(
    props.src,
  );
  if (!proxy) {
    displayUrl.value = props.src;
    observer?.disconnect();
    return;
  }
  try {
    const response = await apiClient.get('/series/poster', {
      params: { url: props.src },
      responseType: 'blob',
      signal: request.signal,
      timeout: 20000,
    });
    if (!request.signal.aborted) {
      objectUrl = URL.createObjectURL(response.data);
      displayUrl.value = objectUrl;
      observer?.disconnect();
    }
  } catch {
    if (!request.signal.aborted) {
      failed.value = true;
      observer?.disconnect();
    }
  }
}
function observe() {
  observer?.disconnect();
  clear();
  failed.value = false;
  visible = false;
  if (!host.value) return;
  if (!('IntersectionObserver' in window)) {
    visible = true;
    void load();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) void load();
      else if (!displayUrl.value) controller?.abort();
    },
    { root: host.value.closest('.series-page'), rootMargin: '120px 0px' },
  );
  if (host.value) observer.observe(host.value);
}
watch(() => props.src, observe);
onMounted(observe);
onBeforeUnmount(() => {
  observer?.disconnect();
  clear();
});
</script>
<style scoped>
.series-poster {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: var(--el-fill-color-light);
}
img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.poster-fallback {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--theme-muted);
  background: linear-gradient(145deg, var(--el-color-primary-light-9), var(--el-fill-color-light));
}
.poster-fallback > span {
  font-size: 32px;
  font-weight: 700;
  opacity: 0.6;
}
small {
  font-size: 11px;
}
</style>
