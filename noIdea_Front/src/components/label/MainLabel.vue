<template>
  <div class="mainLabel">
    <el-card
      v-for="(i, index) in orderList"
      :key="i.id"
      class="box draggable-item"
      @click="clickCard(i)"
      @keydown.enter.self.prevent="clickCard(i)"
      @keydown.space.self.prevent="clickCard(i)"
      :tabindex="editMode && i.can_edit ? 0 : undefined"
      :role="editMode && i.can_edit ? 'button' : undefined"
      :aria-label="editMode && i.can_edit ? `选择${i.title}` : undefined"
      :aria-pressed="editMode && i.can_edit ? !!selectedIds?.includes(i.id) : undefined"
      :title="i.desc || i.title"
      :draggable="editMode && i.can_edit && !selectionBusy"
      @dragstart="onDragStart($event, i.id)"
      @dragend="emit('drag-end')"
      @dragover="onDragOver($event, index)"
      @dragleave="hoverIndex = null"
      @drop="onDrop($event, i.id)"
      @mouseenter="handleHover(index)"
      @mouseleave="handleHover(-1)"
      :data-bookmark-id="i.id"
      :class="{
        hoverStyle: dragging && !selectedIds?.includes(i.id) && hoverIndex === index,
        'is-editable': editMode && i.can_edit,
        'is-selected': editMode && selectedIds?.includes(i.id),
        'is-dragging': dragging && draggedIds?.includes(i.id),
      }"
    >
      <BookmarkIcon :icon="i.icon" :title="i.title" />
      <span class="bookmark-title">{{ i.title }}</span>
      <!--  -->
      <div v-show="editMode && i.can_edit" class="edit">
        <button
          class="app-icon-button"
          type="button"
          aria-label="编辑书签"
          :disabled="selectionBusy"
          title="编辑书签"
          @click.stop="editDetail(i)"
        >
          <i-ep-edit />
        </button>
        <button
          class="app-icon-button"
          type="button"
          aria-label="删除书签"
          :disabled="selectionBusy"
          title="删除书签"
          @click.stop="deleteItem(i.id)"
        >
          <i-ep-delete />
        </button>
      </div>
    </el-card>
    <el-card
      v-if="editMode"
      class="box lastBox"
      :data-home-add-bookmark="activeTab"
      @click="showAdd"
    >
      <i-ep-plus></i-ep-plus>
    </el-card>
    <el-dialog
      v-model="dialogVisible"
      class="bookmark-edit-dialog"
      :title="dialogType == 'add' ? '添加标签' : '编辑标签'"
      width="500"
    >
      <el-form
        class="app-form"
        label-width="calc(var(--app-form-label-width) + var(--app-form-column-gap))"
        label-position="right"
      >
        <el-form-item label="目标网址">
          <el-input
            placeholder="请输入目标网址"
            aria-label="目标网址"
            v-model="formData.targetUrl"
          />
        </el-form-item>
        <el-form-item label="书签名称">
          <el-input
            placeholder="请输入书签名称"
            aria-label="书签名称"
            v-model="formData.title"
            maxlength="255"
          />
        </el-form-item>
        <el-form-item label="图标">
          <el-input
            placeholder="请输入图标地址或名称首字"
            aria-label="图标地址或名称首字"
            v-model="formData.icon"
            maxlength="255"
          />
        </el-form-item>
        <el-form-item label="简介">
          <el-input placeholder="请输入网址简介" v-model="formData.desc" />
        </el-form-item>
        <div class="autoBtn">
          <el-button data-bookmark-auto-title :loading="titleLoading" @click="autoTitle"
            >自动获取网站名称</el-button
          >
          <el-button data-bookmark-auto-icon :loading="iconLoading" @click="autoIcon"
            >自动获取图标地址</el-button
          >
          <BookmarkIcon :icon="formData.icon" :title="formData.title" />
        </div>
        <p class="metadata-hint">
          站内页面读取路由标题，图标使用名称首字；网站图标无法加载时也会显示首字。
        </p>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="titleLoading || iconLoading" @click="confirmLabel">
            确认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import BookmarkIcon from './BookmarkIcon.vue';
import { useRouter } from 'vue-router';
import type { Bookmark } from '@/utils/types';
import { getErrorMessage } from '@/utils/errors';
import { addsubMenuItem, deletesubMenuItem, updatesubMenuItem } from '@/api/menuApi/menu';
import { fetchWebsiteMetadata, type WebsiteMetadata } from '@/api/bookmarkMetadata';
import { bookmarkInitial, resolveBookmarkTarget } from '@/utils/bookmarkMetadata';
const props = defineProps<{
  editMode: boolean;
  activeLists: Bookmark[];
  activeTab: string;
  dragging: boolean;
  draggedIds?: number[];
  selectedIds?: number[];
  selectionBusy?: boolean;
}>();
const router = useRouter();
const currentIndex = ref<number | null>(null);
const emit = defineEmits<{
  'update-message': [];
  'drag-start': [id: number, event: DragEvent];
  'drag-end': [];
  'drop-bookmark': [beforeId: number];
  'toggle-selection': [id: number];
}>();
function clickCard(item: Bookmark) {
  if (props.selectionBusy) return;
  if (props.editMode) {
    if (item.can_edit) emit('toggle-selection', item.id);
    return;
  }
  linkTo(item.targetUrl);
}
const dialogType = ref();
const linkTo = (targetUrl: string) => {
  if (targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
    const destination = router.resolve(targetUrl);
    router.push({
      path: destination.path,
      query: { ...destination.query, fromCategory: props.activeTab },
      hash: destination.hash,
    });
  } else {
    window.open(targetUrl, '_blank');
  }
};
const dialogVisible = ref<boolean>(false);

const hoverIndex = ref<number | null>(null);

const formData = reactive({
  targetUrl: '',
  title: '',
  icon: '',
  desc: '',
  id: '',
});
const titleLoading = ref(false);
const iconLoading = ref(false);
let lookupVersion = 0;
let metadataTask: {
  url: string;
  controller: AbortController;
  promise: Promise<WebsiteMetadata>;
} | null = null;
const cancelLookup = () => {
  lookupVersion++;
  metadataTask?.controller.abort();
  metadataTask = null;
  titleLoading.value = false;
  iconLoading.value = false;
};
watch([dialogVisible, () => formData.targetUrl, () => formData.id], cancelLookup, {
  flush: 'sync',
});
onBeforeUnmount(cancelLookup);
const websiteMetadata = (url: string) => {
  if (metadataTask?.url === url) return metadataTask.promise;
  const controller = new AbortController();
  const promise = fetchWebsiteMetadata(url, controller.signal);
  const task = { url, controller, promise };
  metadataTask = task;
  void promise.catch(() => {
    if (metadataTask === task) metadataTask = null;
  });
  return promise;
};
const autoTitle = async () => {
  if (titleLoading.value) return;
  const version = lookupVersion;
  const previous = formData.title;
  titleLoading.value = true;
  try {
    const target = resolveBookmarkTarget(formData.targetUrl, router, window.location.origin);
    const title = target.internal ? target.title : (await websiteMetadata(target.url)).title;
    if (version !== lookupVersion || !dialogVisible.value || formData.title !== previous) return;
    if (!title) {
      ElMessage.warning(
        target.internal
          ? '未找到已注册的路由名称，请手动填写名称'
          : '网站未提供名称或限制访问，请手动填写名称',
      );
      return;
    }
    formData.title = title.slice(0, 255).replace(/[\uD800-\uDBFF]$/, '');
    ElMessage.success('名称已获取');
  } catch (error) {
    if (version === lookupVersion && dialogVisible.value)
      ElMessage.warning(getErrorMessage(error, '获取名称失败，请手动填写'));
  } finally {
    if (version === lookupVersion) titleLoading.value = false;
  }
};
const autoIcon = async () => {
  if (iconLoading.value) return;
  const version = lookupVersion;
  const previous = formData.icon;
  iconLoading.value = true;
  try {
    const target = resolveBookmarkTarget(formData.targetUrl, router, window.location.origin);
    let icon: string;
    if (target.internal) {
      const name = formData.title.trim() || target.title;
      if (!name) {
        ElMessage.warning('请先填写名称，或输入已注册的站内路由');
        return;
      }
      icon = bookmarkInitial(name);
    } else {
      const metadata = await websiteMetadata(target.url);
      icon =
        metadata.icon ||
        bookmarkInitial(formData.title || metadata.title || new URL(target.url).hostname);
    }
    if (version !== lookupVersion || !dialogVisible.value || formData.icon !== previous) return;
    formData.icon = icon;
    ElMessage.success(target.internal ? '已使用名称首字作为图标' : '图标地址已获取');
  } catch (error) {
    if (version === lookupVersion && dialogVisible.value)
      ElMessage.warning(getErrorMessage(error, '获取图标失败，请手动填写'));
  } finally {
    if (version === lookupVersion) iconLoading.value = false;
  }
};
//拖拽事件
const onDragStart = (event: DragEvent, id: number) => {
  if (props.selectionBusy) {
    event.preventDefault();
    return;
  }
  if (!props.activeLists.some((item) => item.id === id && item.can_edit)) {
    event.preventDefault();
    return;
  }
  if (!props.editMode || !event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(id));
  emit('drag-start', id, event);
};

const orderList = computed(() => {
  return [...props.activeLists].sort((a, b) => a.order - b.order);
});

//拖拽改动
const onDrop = (event: DragEvent, id: number) => {
  if (!props.editMode || !props.dragging) return;
  event.preventDefault();
  event.stopPropagation();
  emit('drop-bookmark', id);
  hoverIndex.value = null;
};

const onDragOver = (event: DragEvent, index: number) => {
  if (!props.editMode || !props.dragging) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  hoverIndex.value = index;
};

const showAdd = () => {
  dialogVisible.value = true;
  dialogType.value = 'add';
  resetData();
};
const resetData = () => {
  formData.targetUrl = '';
  formData.title = '';
  formData.icon = '';
  formData.desc = '';
  formData.id = '';
};

//类似hover事件
const handleHover = (index: number) => {
  currentIndex.value = index;
};

//编辑书签
const editDetail = (i: Bookmark) => {
  if (!i.can_edit) return;
  dialogVisible.value = true;
  dialogType.value = 'update';
  formData.targetUrl = i.targetUrl;
  formData.title = i.title;
  formData.id = String(i.id);
  formData.icon = i.icon || '';
  formData.desc = i.desc || '';
};

//删除书签
const deleteItem = async (id: number) => {
  if (!props.activeLists.some((item) => item.id === id && item.can_edit)) return;
  try {
    await ElMessageBox.confirm('确定删除这个书签吗？删除后无法恢复。', '删除书签', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }
  deletesubMenuItem({
    subMenuId: id,
  })
    .then((res) => {
      if (res.status == 200) {
        ElMessage({
          message: '删除书签成功',
          type: 'success',
        });
        emit('update-message');
      }
    })
    .catch((error: unknown) => {
      ElMessage({
        message: getErrorMessage(error, '删除书签失败'),
        type: 'error',
      });
    });
};
const addSubMenus = async () => {
  const params = {
    ...formData,
    menuId: props.activeTab,
  };
  const res = await addsubMenuItem(params);
  if (res.status === 201) {
    ElMessage.success('添加书签成功');
    emit('update-message');
  }
};

const editSubMenus = async () => {
  const params = {
    ...formData,
    subMenuId: formData.id,
  };
  const res = await updatesubMenuItem(params);
  if (res.status === 200) {
    ElMessage.success('更新书签成功');
    emit('update-message');
  }
};

//添加或修改标签
const confirmLabel = async () => {
  if (titleLoading.value || iconLoading.value) return;
  if (formData.targetUrl && formData.title) {
    // let len = initData.value.filter((i) => i.id == formData.id).length;
    if (dialogType.value == 'update') {
      try {
        await editSubMenus();
        dialogVisible.value = false;
      } catch (error) {
        ElMessage.error(getErrorMessage(error, '更新失败'));
      }
    } else {
      try {
        await addSubMenus();
        dialogVisible.value = false;
      } catch (error) {
        ElMessage.error(getErrorMessage(error, '添加失败'));
      }
    }
  } else {
    ElMessage.warning('请填写网址和书签名称');
  }
};

// watch(
//   () => props.activeTab,
//   (newVal) => {
//     // console.log(props.activeTab);
//     initData.value = labelData.filter((i) => i.type == newVal);
//   }
// { immediate: true, deep: true }
// );
</script>
<style lang="less" scoped>
.mainLabel .box.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}
.mainLabel .box.is-editable {
  user-select: none;
  cursor: grab;
}
.mainLabel .box.is-dragging {
  opacity: 0.45;
}
.mainLabel .box.is-editable:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}
.mainLabel .box.is-editable:hover {
  transform: none;
}
.mainLabel {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr));
  gap: 14px;
  .box {
    width: auto;
    min-width: 0;
    min-height: 84px;
    margin: 0;
    padding: 16px;
    display: flex;
    position: relative;
    align-items: center;
    gap: var(--app-space-3);
    cursor: pointer;
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--app-radius-panel);
    box-shadow: var(--app-shadow-panel);
    transition:
      transform 180ms,
      border-color 180ms,
      box-shadow 180ms;
    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--app-space-3);
      width: 100%;
      min-width: 0;
      padding: 0;
      > .bookmark-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 550;
      }
    }
    &:hover {
      transform: translateY(-1px);
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 5px 16px rgb(18 24 35 / 6%);
    }
    &.hoverStyle {
      border: 2px dashed var(--el-color-primary);
    }
    &.is-editable :deep(.el-card__body) {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--app-space-2) var(--app-space-3);
    }
    .edit {
      display: flex;
      grid-column: 1 / -1;
      justify-self: end;
      gap: var(--app-space-1);
      color: var(--theme-muted);
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--app-button-height);
        height: var(--app-button-height);
        padding: 0;
        border: 0;
        border-radius: var(--app-radius-control);
        background: transparent;
        color: inherit;
        cursor: pointer;
        &:hover,
        &:focus-visible {
          color: var(--el-color-primary);
        }
        &:focus-visible {
          outline: 2px solid var(--el-color-primary);
          outline-offset: 1px;
        }
      }
      svg {
        width: var(--app-icon-size);
        height: var(--app-icon-size);
      }
    }
  }
  .lastBox {
    justify-content: center;
    background: transparent;
    border-style: dashed;
    box-shadow: none;
    color: var(--theme-muted);
    :deep(.el-card__body) {
      justify-content: center;
    }
    :deep(svg) {
      width: 24px;
      height: 24px;
    }
  }
  .autoBtn {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    min-width: 0;
    align-items: center;
    gap: var(--app-space-2);
    > .el-button {
      min-width: 0;
      max-width: 100%;
      height: auto;
      min-height: var(--app-button-height);
      margin-left: 0;
      padding: 4px 8px;
      font-size: 12px;
      white-space: normal;
    }
  }
  .metadata-hint {
    margin: 12px 0 0;
    color: var(--theme-muted);
    font-size: 12px;
    line-height: 1.7;
  }
}
@media (max-width: 1000px) {
  .mainLabel {
    grid-template-columns: repeat(auto-fill, minmax(min(190px, 100%), 1fr));
    gap: 14px;
    .box {
      padding: 16px;
      min-height: 88px;
    }
  }
}
@media (max-width: 640px) {
  .mainLabel {
    grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
    gap: 10px;
    .box {
      padding: 12px;
      min-height: 78px;
      gap: 8px;
      :deep(.el-card__body) {
        gap: 8px;
        > .bookmark-title {
          font-size: 13px;
        }
      }
    }
  }
}
@media (max-height: 600px) {
  .mainLabel {
    gap: 10px;
    .box {
      min-height: 72px;
      padding: 12px;
      &:hover {
        transform: translateY(-1px);
      }
    }
  }
}
</style>
