<template>
  <details class="catalog-info" @toggle="onToggle">
    <summary>
      片库收录情况 <span v-if="status">已入库 {{ status.total }} 部</span>
    </summary>
    <p>实时检索与自建片库合并展示。下方数量仅统计已入库作品，未入库的平台不代表已接通全量数据。</p>
    <div v-if="error" class="catalog-error" role="alert">
      {{ error }} <el-button text @click="load">重试</el-button>
    </div>
    <p v-else-if="loading" role="status">正在读取收录情况…</p>
    <div v-if="status" class="catalog-sources">
      <div v-for="source in status.sources" :key="source.source" class="catalog-source">
        <strong>{{ source.label }}</strong
        ><span>{{
          source.count
            ? `${source.count} 部已入库`
            : source.live
              ? '支持实时检索 · 暂未入库'
              : '待采集 / 导入'
        }}</span>
        <small v-if="source.lastFetchedAt"
          >更新于 {{ new Date(source.lastFetchedAt).toLocaleString('zh-CN') }}</small
        >
      </div>
    </div>
  </details>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { fetchSeriesCatalogStatus, type SeriesCatalogStatus } from '@/api/series';
import { getErrorMessage } from '@/utils/errors';
const status = ref<SeriesCatalogStatus | null>(null),
  loading = ref(false),
  error = ref('');
let controller: AbortController | undefined;
function onToggle(event: Event) {
  if ((event.target as HTMLDetailsElement).open && !status.value && !loading.value) void load();
}
async function load() {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchSeriesCatalogStatus(request.signal);
    if (!request.signal.aborted) status.value = data;
  } catch (e) {
    if (!request.signal.aborted) error.value = getErrorMessage(e, '收录情况暂时无法读取');
  } finally {
    if (controller === request) loading.value = false;
  }
}
onBeforeUnmount(() => controller?.abort());
</script>
<style scoped>
.catalog-info {
  margin-top: 14px;
  color: var(--theme-muted);
  font-size: 12px;
}
summary {
  cursor: pointer;
  width: fit-content;
  line-height: 1.6;
}
summary span {
  margin-left: 8px;
  font-size: 11px;
}
.catalog-info p {
  margin: 12px 0;
  line-height: 1.7;
}
.catalog-sources {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  padding: 12px 0;
}
.catalog-source {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
strong {
  color: var(--theme-text);
  font-weight: 500;
}
small {
  font-size: 10px;
}
.catalog-error {
  color: var(--el-color-danger);
}
@media (max-width: 600px) {
  .catalog-sources {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 10px;
  }
  .catalog-source span {
    font-size: 11px;
  }
}
</style>
