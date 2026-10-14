<template>
  <div class="mainLabel">
    <el-card
      v-for="(i, index) in orderList"
      :key="i.id"
      class="box draggable-item"
      @click="linkTo(i.targetUrl)"
      :title="i.desc || i.title"
      :draggable="editMode && i.can_edit"
      @dragstart="onDragStart($event, i.id)"
      @dragend="emit('drag-end')"
      @dragover="onDragOver($event, index)"
      @dragleave="hoverIndex = null"
      @drop="onDrop($event, i.id)"
      @mouseenter="handleHover(index)"
      @mouseleave="handleHover(-1)"
      :class="{ hoverStyle: hoverIndex == index }"
    >
      <BookmarkIcon :icon="i.icon" :title="i.title" />
      <span class="bookmark-title">{{ i.title }}</span>
      <!--  -->
      <div v-show="currentIndex == index && editMode && i.can_edit" class="edit">
        <i-ep-edit @click.stop="editDetail(i)"></i-ep-edit>
        <i-ep-delete @click.stop="deleteItem(i.id)"></i-ep-delete>
      </div>
    </el-card>
    <el-card v-if="editMode" class="box lastBox" @click="showAdd">
      <i-ep-plus></i-ep-plus>
    </el-card>
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType == 'add' ? '添加标签' : '编辑标签'"
      width="500"
    >
      <el-form>
        <el-form-item>
          <el-input placeholder="请输入目标网址" v-model="formData.targetUrl" />
        </el-form-item>
        <el-form-item>
          <el-input placeholder="请输入书签名称" v-model="formData.title" />
        </el-form-item>
        <el-form-item>
          <el-input placeholder="请输入图标地址" v-model="formData.icon" />
        </el-form-item>
        <el-form-item>
          <el-input placeholder="请输入网址简介" v-model="formData.desc" />
        </el-form-item>
        <div class="autoBtn">
          <el-button>自动获取网站名称</el-button>
          <el-button>自动获取图标地址</el-button>
          <BookmarkIcon :icon="formData.icon" :title="formData.title" />
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="confirmLabel"> 确认 </el-button>
          <el-button @click="dialogVisible = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import BookmarkIcon from './BookmarkIcon.vue';
import { useRouter } from 'vue-router';
import type { Bookmark } from '@/utils/types';
import { getErrorMessage } from '@/utils/errors';
import { addsubMenuItem, deletesubMenuItem, updatesubMenuItem } from '@/api/menuApi/menu';
const props = defineProps<{
  editMode: boolean;
  activeLists: Bookmark[];
  activeTab: string;
  dragging: boolean;
}>();
const router = useRouter();
const currentIndex = ref<number | null>(null);
const emit = defineEmits<{
  'update-message': [];
  'drag-start': [id: number];
  'drag-end': [];
  'drop-bookmark': [beforeId: number];
}>();
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
//拖拽事件
const onDragStart = (event: DragEvent, id: number) => {
  if (!props.activeLists.some((item) => item.id === id && item.can_edit)) {
    event.preventDefault();
    return;
  }
  if (!props.editMode || !event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(id));
  emit('drag-start', id);
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
const deleteItem = (id: number) => {
  if (!props.activeLists.some((item) => item.id === id && item.can_edit)) return;
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
.mainLabel {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
  &::before {
    content: '常用网址与灵感，都有自己的位置。';
    grid-column: 1 / -1;
    margin-bottom: 14px;
    color: var(--theme-muted);
    font-size: 13px;
    line-height: 1.6;
  }
  .box {
    width: auto;
    min-width: 0;
    min-height: 100px;
    margin: 0;
    padding: 20px;
    display: flex;
    position: relative;
    align-items: center;
    gap: 16px;
    cursor: pointer;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    box-shadow: 0 3px 12px rgba(15, 23, 42, 0.025);
    transition:
      transform 180ms,
      border-color 180ms,
      box-shadow 180ms;
    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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
        font-weight: 600;
      }
    }
    &:hover {
      transform: translateY(-3px);
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
    }
    &.hoverStyle {
      border: 2px dashed var(--el-color-primary);
    }
    .edit {
      display: flex;
      gap: 10px;
      color: var(--theme-muted);
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
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }
  :deep(.el-form-item) {
    margin-bottom: 16px;
  }
}
@media (max-width: 640px) {
  .mainLabel {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    .box {
      padding: 16px;
      min-height: 90px;
      gap: 12px;
    }
    .autoBtn {
      flex-wrap: wrap;
    }
  }
}
</style>
