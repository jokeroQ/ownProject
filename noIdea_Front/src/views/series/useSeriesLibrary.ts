import { computed, onBeforeUnmount, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  fetchSeriesLibraryStatus,
  removeSeriesLibrary,
  updateSeriesLibrary,
  type SeriesItem,
  type SeriesLibraryState,
  type SeriesList,
} from '@/api/series';
import { getErrorMessage } from '@/utils/errors';

export function useSeriesLibrary() {
  const states = ref<Record<string, SeriesLibraryState>>({});
  const ready = ref(false),
    statusLoading = ref(false),
    statusError = ref(''),
    saving = ref(new Set<string>()),
    version = ref(0);
  let controller: AbortController | undefined,
    active = true;
  const counts = computed(() => {
    const entries = Object.values(states.value);
    return {
      all: entries.length,
      favorite: entries.filter((item) => item.favorite).length,
      want: entries.filter((item) => item.watchStatus === 'want').length,
      watching: entries.filter((item) => item.watchStatus === 'watching').length,
    } satisfies Record<SeriesList, number>;
  });
  const state = (id: string): SeriesLibraryState =>
    states.value[id] || { id, favorite: false, watchStatus: 'none' };
  const disabled = (id: string) => !ready.value || saving.value.has(id);
  async function refreshStatus() {
    controller?.abort();
    const request = new AbortController();
    const generation = version.value;
    controller = request;
    statusLoading.value = true;
    statusError.value = '';
    try {
      const result = await fetchSeriesLibraryStatus(request.signal);
      if (!request.signal.aborted && generation === version.value) {
        states.value = Object.fromEntries(result.entries.map((item) => [item.id, item]));
        ready.value = true;
      }
    } catch (error) {
      if (!request.signal.aborted)
        statusError.value = getErrorMessage(error, '片单暂时无法读取，请重试');
    } finally {
      if (controller === request) statusLoading.value = false;
    }
  }
  async function change(
    item: SeriesItem,
    patch: Partial<Pick<SeriesLibraryState, 'favorite' | 'watchStatus'>>,
    remove = false,
  ) {
    if (disabled(item.id)) return;
    saving.value.add(item.id);
    try {
      const result = remove
        ? await removeSeriesLibrary(item.id)
        : await updateSeriesLibrary(item, patch);
      if (!active) return;
      if (result.favorite || result.watchStatus !== 'none') states.value[item.id] = result;
      else delete states.value[item.id];
      version.value++;
      ElMessage.success(
        remove
          ? '已从片单移除'
          : patch.watchStatus === 'watching'
            ? '已标记为正在观看'
            : patch.watchStatus === 'want'
              ? '已加入想看'
              : patch.favorite === true
                ? '已收藏'
                : patch.favorite === false
                  ? '已取消收藏'
                  : '已清除观看状态',
      );
    } catch (error) {
      if (active) ElMessage.error(getErrorMessage(error, '片单保存失败，请重试'));
    } finally {
      saving.value.delete(item.id);
    }
  }
  async function remove(item: SeriesItem) {
    if (disabled(item.id)) return;
    try {
      await ElMessageBox.confirm(
        `将《${item.title}》从个人片单移除？收藏和观看状态会一并清除。`,
        '移除作品',
        { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' },
      );
    } catch {
      return;
    }
    await change(item, {}, true);
  }
  onBeforeUnmount(() => {
    active = false;
    controller?.abort();
  });
  return {
    counts,
    state,
    disabled,
    refreshStatus,
    change,
    remove,
    ready,
    statusLoading,
    statusError,
    version,
  };
}
