<template>
  <el-container class="full-height">
    <el-aside width="232px" class="category-sidebar" style="background: var(--background-aside)">
      <el-menu :default-active="activeTab" class="el-menu-vertical-demo">
        <el-menu-item-group>
          <el-menu-item
            @click="changeTab(String(i.id))"
            :index="String(i.id)"
            :data-category="i.id"
            @dragover="allowDrop($event, String(i.id))"
            @dragleave="dropCategory = ''"
            @drop="dropBookmark($event, String(i.id))"
            :class="{ 'drop-target': dropCategory === String(i.id) }"
            v-for="i in state.menus"
            :key="i.index"
            ><span class="category-name" :title="i.title">{{ i.title }}</span>
            <i-ep-lock
              v-if="!i.can_edit"
              class="readonly-icon"
              title="只读分类，可以在此新增自己的书签"
            />
            <div v-if="i.can_edit" class="edit">
              <i-ep-edit @click.stop="editDetail(i)"></i-ep-edit>
              <el-popconfirm
                v-if="i.can_delete"
                width="220"
                confirm-button-text="确定"
                cancel-button-text="取消"
                icon-color="#626AEF"
                title="是否确定要删除该标签?"
                @confirm.stop="deleteItem(String(i.id))"
              >
                <template #reference>
                  <i-ep-delete></i-ep-delete>
                </template>
              </el-popconfirm>
            </div>
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>
      <div class="btnGroup" data-home-toolbar aria-label="分类工具栏">
        <button
          type="button"
          class="sidebar-action app-icon-button"
          aria-label="调整分类顺序"
          title="调整分类顺序"
          :disabled="selectionBusy || moving || !state.menus.length"
          @click="sortingCategories = true"
        >
          <i-ep-sort />
        </button>
        <button
          type="button"
          class="sidebar-action app-icon-button"
          data-home-add-category
          aria-label="添加分类"
          title="添加分类"
          @click="createMenu"
        >
          <i-ep-folderAdd />
        </button>
        <button
          type="button"
          class="sidebar-action app-icon-button"
          data-home-edit-mode
          :class="{ 'is-active': editMode }"
          :aria-pressed="editMode"
          aria-label="编辑书签"
          title="编辑书签"
          @click="goEdit"
        >
          <i-ep-setting />
        </button>
        <button
          type="button"
          class="sidebar-action app-icon-button sidebar-action--secondary"
          data-home-secondary-action="download"
          aria-label="下载"
          title="下载（暂未开放）"
          disabled
        >
          <i-ep-download />
        </button>
        <button
          type="button"
          class="sidebar-action app-icon-button sidebar-action--secondary"
          data-home-secondary-action="upload"
          aria-label="上传"
          title="上传（暂未开放）"
          disabled
        >
          <i-ep-upload />
        </button>
        <button
          type="button"
          class="sidebar-action app-icon-button sidebar-action--secondary"
          data-home-secondary-action="help"
          aria-label="帮助"
          title="帮助（暂未开放）"
          disabled
        >
          <i-ep-questionFilled />
        </button>
      </div>
    </el-aside>
    <el-container class="bookmark-workspace">
      <el-header class="header" style="background: var(--background-header)">
        <el-input
          v-model="searchValue"
          placeholder="请输入搜索内容"
          @keyup.enter="goSearch"
          clearable
        >
          <template #append>
            <el-button
              class="app-icon-button"
              :icon="Search"
              aria-label="搜索"
              title="搜索"
              @click="goSearch"
            />
          </template>
        </el-input>

        <div class="user-actions">
          <router-link
            v-if="currentUser?.role === 'admin'"
            class="current-user current-user-admin"
            data-admin-entry
            :to="{ name: 'userManagement', query: { fromCategory: activeTab } }"
            :title="`${currentUser.username} · 用户管理`"
            aria-label="用户管理"
          >
            <el-icon class="current-user-icon" aria-hidden="true"><User /></el-icon>
            <span class="current-user-name">{{ currentUser.username }}</span>
          </router-link>
          <div v-else-if="currentUser" class="current-user" :title="currentUser.username">
            <el-icon class="current-user-icon" aria-hidden="true"><User /></el-icon>
            <span class="current-user-name">{{ currentUser.username }}</span>
          </div>
          <el-button class="home-logout" data-home-logout type="danger" plain @click="logout">
            退出登录
          </el-button>
        </div>
      </el-header>
      <main
        ref="contentRoot"
        class="el-main"
        :class="{ 'is-editing': editMode }"
        @pointerdown="startMarquee"
        @scroll.passive="onContentScroll"
        @wheel.passive="cancelAutoScroll"
        @touchstart.passive="cancelAutoScroll"
        @dragover="onContentDragOver"
        @drop="stopDrag"
        @dragleave="leaveContent"
      >
        <BatchToolbar
          v-if="editMode"
          v-model:selected-ids="selectedIds"
          v-model:busy="selectionBusy"
          :menus="state.menus"
          @changed="getMenu"
        />
        <section
          v-for="menu in state.menus"
          :key="menu.id"
          :data-section="menu.id"
          class="category-section"
          :class="{ 'drop-target': dropCategory === String(menu.id) }"
          @dragover="allowDrop($event, String(menu.id))"
          @dragleave="dropCategory = ''"
          @drop="dropBookmark($event, String(menu.id))"
        >
          <h2>{{ menu.title }}</h2>
          <MainLabel
            :activeTab="String(menu.id)"
            :editMode="editMode"
            :activeLists="menu.menuLists"
            :dragging="draggedBookmark !== null"
            :selected-ids="selectedIds"
            :dragged-ids="draggedIds"
            :selection-busy="selectionBusy"
            @toggle-selection="toggleSelection"
            @update-message="getMenu"
            @drag-start="startDrag"
            @drag-end="stopDrag"
            @drop-bookmark="moveBookmark(String(menu.id), $event)"
          />
          <p v-if="!menu.menuLists.length && !editMode" class="empty-category">
            暂无书签，开启编辑模式后可添加或拖入书签。
          </p>
        </section>
        <p v-if="!state.menus.length" class="empty-category">点击左侧添加分类，开始收藏。</p>
        <Teleport to="body">
          <div
            v-if="rectangle"
            data-bookmark-marquee
            class="bookmark-marquee"
            :style="rectangle"
            aria-hidden="true"
          />
        </Teleport>
      </main>
      <el-footer>
        <div class="bottom">
          <p>{{ state.moto }}</p>
          <el-link @click="exitMode" underline="never" v-if="editMode">退出编辑模式</el-link>
        </div>
      </el-footer>
    </el-container>
    <el-dialog
      v-model="dialogVisible"
      :title="mode == 'add' ? '添加标签' : '修改标签'"
      width="500"
      :before-close="handleClose"
    >
      <el-input
        v-model="labelName"
        class="category-name-input"
        placeholder="请输入标签名称"
        @keyup.enter="addType"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="addType">确认</el-button>
        </div>
      </template>
    </el-dialog>
    <CategoryOrderDialog
      v-model="sortingCategories"
      :menus="state.menus"
      @changed="getMenu"
    /><ThemeSettings />
  </el-container>
</template>

<script setup lang="ts">
defineOptions({ name: 'HomePage' });
import MainLabel from '@/components/label/MainLabel.vue';
import { useBookmarkMarquee } from '@/components/label/useBookmarkMarquee';
import BatchToolbar from '@/components/label/BatchToolbar.vue';
import CategoryOrderDialog from '@/components/label/CategoryOrderDialog.vue';
import ThemeSettings from '@/components/theme/ThemeSettings.vue';
import { getMotto } from '@views/home/home';
import { deleteMenuItem, moveSubItems } from '@/api/menuApi/menu';
import { Search, User } from '@element-plus/icons-vue';
import { reactive, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { postRequest, getRequest, putRequest } from '../../utils/httpService';
import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router';
import { clearLogin, getCurrentUser } from '@/utils/auth';
import type { Menu } from '@/utils/types';
import { getErrorMessage } from '@/utils/errors';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import '@/assets/styles/logout-confirm.css';
// const state = reactive({
//   menuList: menuList,
// });
const currentUser = ref(getCurrentUser());
const syncCurrentUser = () => {
  currentUser.value = getCurrentUser();
};
const searchValue = ref<string>('');
const route = useRoute();
const activeTab = ref<string>(typeof route.query.category === 'string' ? route.query.category : '');
const dialogVisible = ref(false);
const labelName = ref('');
const router = useRouter();
const state = reactive<{ moto: string; menus: Menu[] }>({
  moto: getMotto(),
  menus: [],
});
const selectedIds = ref<number[]>([]);
const selectionBusy = ref(false);
const sortingCategories = ref(false);
let suppressSelectionUntil = 0;
const toggleSelection = (id: number) => {
  if (selectionBusy.value || performance.now() < suppressSelectionUntil) return;
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((value) => value !== id)
    : [...selectedIds.value, id];
};
const editMode = ref<boolean>(false);
const mode = ref<string>('add');
const index = ref<string>('');
const contentRoot = ref<HTMLElement | null>(null);
const { rectangle, startMarquee, cancelMarquee } = useBookmarkMarquee(
  contentRoot,
  editMode,
  selectionBusy,
  selectedIds,
);
const draggedBookmark = ref<number | null>(null);
const draggedIds = ref<number[]>([]);
let dragPreview: HTMLElement | null = null;
const dropCategory = ref('');
const moving = ref(false);
let scrollTarget = '';
let scrollFrame = 0;
let dragFrame = 0;
let dragSpeed = 0;
let categoryNavigation = 0;
let leavingHome = false;
const stopNavigationReset = router.afterEach((to, _from, failure) => {
  if (failure && to.name !== 'home') leavingHome = false;
});
onBeforeRouteLeave(() => {
  leavingHome = true;
  cancelMarquee();
  cancelAutoScroll();
  cancelAnimationFrame(scrollFrame);
});
const sections = () =>
  Array.from(contentRoot.value?.querySelectorAll<HTMLElement>('[data-section]') || []);
const categoryOffset = () => {
  const root = contentRoot.value;
  if (!root || !editMode.value) return 24;
  return (
    24 +
    (Number.parseFloat(getComputedStyle(root).paddingTop) || 0) +
    (root.querySelector<HTMLElement>('.batch-toolbar')?.offsetHeight || 0)
  );
};
const scrollToCategory = (category: string, smooth = false) => {
  const root = contentRoot.value;
  const section = sections().find((item) => item.dataset.section === category);
  if (!root || !section) return;
  const atStart = section === sections()[0];
  scrollTarget = atStart ? '' : category;
  root.scrollTo({
    top: atStart
      ? 0
      : section.getBoundingClientRect().top -
        root.getBoundingClientRect().top +
        root.scrollTop -
        categoryOffset(),
    behavior:
      smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'smooth'
        : 'instant',
  });
};
const cancelAutoScroll = () => {
  scrollTarget = '';
  contentRoot.value?.scrollTo({ top: contentRoot.value.scrollTop, behavior: 'instant' });
};
const onContentScroll = () => {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const root = contentRoot.value;
    if (!root) return;
    const all = sections();
    const top = root.getBoundingClientRect().top + categoryOffset() + 24;
    const current =
      all.filter((section) => section.getBoundingClientRect().top <= top).at(-1) || all[0];
    const atBottom =
      root.scrollHeight > root.clientHeight + 2 &&
      root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
    if (scrollTarget) {
      const target = all.find((section) => section.dataset.section === scrollTarget);
      if (target && (Math.abs(target.getBoundingClientRect().top - top + 24) < 3 || atBottom))
        scrollTarget = '';
      return;
    }
    const category = atBottom ? all.at(-1)?.dataset.section : current?.dataset.section;
    if (category && category !== activeTab.value) {
      activeTab.value = category;
      syncCategoryUrl(category);
      document
        .querySelector<HTMLElement>(`.el-menu-item[data-category="${category}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });
};
const startDrag = (id: number, event: DragEvent) => {
  if (selectionBusy.value) return;
  if (!state.menus.some((menu) => menu.menuLists.some((item) => item.id === id && item.can_edit)))
    return;
  cancelMarquee();
  if (!selectedIds.value.includes(id)) selectedIds.value = [id];
  draggedIds.value = [...selectedIds.value];
  draggedBookmark.value = id;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', JSON.stringify(draggedIds.value));
    if (draggedIds.value.length > 1) {
      dragPreview = document.createElement('div');
      dragPreview.textContent = draggedIds.value.length + ' 个书签';
      Object.assign(dragPreview.style, {
        position: 'fixed',
        top: Math.min(event.clientY, window.innerHeight - 80) + 'px',
        left: Math.min(event.clientX, window.innerWidth - 180) + 'px',
        padding: '16px 28px',
        background: 'var(--el-bg-color)',
        color: 'var(--el-color-primary)',
        border: '2px solid var(--el-color-primary)',
        borderRadius: '12px',
        boxShadow:
          '4px 4px 0 var(--el-color-primary-light-7), 8px 8px 0 var(--el-color-primary-light-9)',
        font: '600 14px sans-serif',
        pointerEvents: 'none',
      });
      document.body.appendChild(dragPreview);
      event.dataTransfer.setDragImage(dragPreview, 24, 24);
      const preview = dragPreview;
      requestAnimationFrame(() => preview.remove());
    }
  }
};
const stopDrag = () => {
  if (draggedBookmark.value !== null) suppressSelectionUntil = performance.now() + 250;
  dragPreview?.remove();
  dragPreview = null;
  draggedIds.value = [];
  draggedBookmark.value = null;
  dropCategory.value = '';
  dragSpeed = 0;
  cancelAnimationFrame(dragFrame);
  dragFrame = 0;
};
const allowDrop = (event: DragEvent, category: string) => {
  if (!editMode.value || draggedBookmark.value === null || moving.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dropCategory.value = category;
};
const moveBookmark = async (menuId: string, beforeId?: number) => {
  const ids = [...draggedIds.value];
  stopDrag();
  if (
    !ids.length ||
    !editMode.value ||
    moving.value ||
    selectionBusy.value ||
    (beforeId !== undefined && ids.includes(beforeId))
  )
    return;
  moving.value = true;
  selectionBusy.value = true;
  try {
    await moveSubItems({ ids, menuId, beforeId });
    await getMenu();
    ElMessage.success(ids.length > 1 ? '已移动 ' + ids.length + ' 个书签' : '书签已移动');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '移动失败，请重试'));
  } finally {
    moving.value = false;
    selectionBusy.value = false;
  }
};
const dropBookmark = (event: DragEvent, menuId: string) => {
  if (draggedBookmark.value === null || !editMode.value) return;
  event.preventDefault();
  event.stopPropagation();
  void moveBookmark(menuId);
};
const onContentDragOver = (event: DragEvent) => {
  const root = contentRoot.value;
  if (!root || draggedBookmark.value === null) return;
  scrollTarget = '';
  const bounds = root.getBoundingClientRect();
  dragSpeed = event.clientY < bounds.top + 70 ? -12 : event.clientY > bounds.bottom - 70 ? 12 : 0;
  if (dragFrame) return;
  const step = () => {
    if (draggedBookmark.value === null) {
      dragFrame = 0;
      return;
    }
    root.scrollTop += dragSpeed;
    dragFrame = requestAnimationFrame(step);
  };
  dragFrame = requestAnimationFrame(step);
};
const leaveContent = (event: DragEvent) => {
  if (!(event.relatedTarget instanceof Node) || !contentRoot.value?.contains(event.relatedTarget))
    dragSpeed = 0;
};
onBeforeUnmount(() => {
  stopNavigationReset();
  stopDrag();
  cancelAnimationFrame(scrollFrame);
  window.removeEventListener('user-changed', syncCurrentUser);
  window.removeEventListener('auth-changed', syncCurrentUser);
  window.removeEventListener('storage', syncCurrentUser);
});
const syncCategoryUrl = (category: string) => {
  if (leavingHome || route.name !== 'home' || route.query.category === (category || undefined))
    return;
  categoryNavigation++;
  void router
    .replace({
      name: 'home',
      query: { ...route.query, category: category || undefined },
      hash: route.hash,
    })
    .finally(async () => {
      await nextTick();
      categoryNavigation--;
    });
};
const restoreCategory = () => {
  const category = typeof route.query.category === 'string' ? route.query.category : '';
  activeTab.value = state.menus.some((menu) => String(menu.id) === category)
    ? category
    : state.menus.length
      ? String(state.menus[0].id)
      : '';
  syncCategoryUrl(activeTab.value);
};
watch(
  () => route.query.category,
  () => {
    if (
      !categoryNavigation &&
      route.name === 'home' &&
      state.menus.length &&
      route.query.category !== activeTab.value
    ) {
      restoreCategory();
      scrollToCategory(activeTab.value, true);
    }
  },
);
onMounted(async () => {
  syncCurrentUser();
  window.addEventListener('user-changed', syncCurrentUser);
  window.addEventListener('auth-changed', syncCurrentUser);
  window.addEventListener('storage', syncCurrentUser);
  try {
    await postRequest('/flowchart/entry', {});
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '流程图入口初始化失败'));
  }
  await getMenu();
});
//获取最新的菜单
const getMenu = async () => {
  const firstLoad = !state.menus.length;
  const previousCategory = activeTab.value;
  return getRequest<Menu[]>('/menu/getMenus')
    .then((res) => {
      state.menus = res.data;
      selectedIds.value = selectedIds.value.filter((id) =>
        res.data.some((menu) => menu.menuLists.some((item) => item.id === id && item.can_edit)),
      );
      restoreCategory();
      return nextTick().then(() => {
        if (firstLoad || previousCategory !== activeTab.value) scrollToCategory(activeTab.value);
      });
    })
    .catch((error: unknown) => {
      ElMessage({
        message: getErrorMessage(error, '获取菜单失败'),
        type: 'error',
      });
    });
};
//切换菜单项
const changeTab = (index: string) => {
  activeTab.value = index;
  syncCategoryUrl(index);
  scrollToCategory(index, true);
};
//新增菜单
const createMenu = () => {
  dialogVisible.value = true;
  mode.value = 'add';
  labelName.value = '';
  index.value = '';
};
const handleClose = () => {
  dialogVisible.value = false;
};

//开启编辑功能
const goEdit = () => {
  cancelAutoScroll();
  editMode.value = true;
  void nextTick(() => scrollToCategory(activeTab.value));
  ElMessage({
    message: '已开启编辑，可在空白处拉框选择书签',
  });
};
//关闭编辑模式
const exitMode = () => {
  if (selectionBusy.value) return;
  selectedIds.value = [];
  stopDrag();
  editMode.value = false;
  ElMessage({
    message: '已退出编辑模式',
  });
};
//编辑左侧菜单标签
const editDetail = (i: Menu) => {
  if (!i.can_edit) return;
  mode.value = 'update';
  dialogVisible.value = true;
  labelName.value = i.title;
  index.value = String(i.id);
};
//添加标签
const addType = async () => {
  if (index.value) {
    editMenus();
  } else {
    try {
      const res = await postRequest(`/menu/addMenus`, {
        title: labelName.value,
      });
      ElMessage({
        message: res.message,
        type: 'success',
      });
      getMenu();
    } catch (error) {
      ElMessage({
        message: getErrorMessage(error, '添加分类失败'),
        type: 'error',
      });
    }
  }
  dialogVisible.value = false;
};
//更新菜单项
const editMenus = async () => {
  const params = {
    index: index.value,
    title: labelName.value,
  };
  try {
    const res = await putRequest(`/menu/updateMenu/${index.value}`, params);
    ElMessage({
      message: res.message,
      type: 'success',
    });
    getMenu();
  } catch (error) {
    ElMessage({
      message: getErrorMessage(error, '更新分类失败'),
      type: 'error',
    });
  }
};
//删除左侧菜单标签
const deleteItem = async (index: string) => {
  if (!state.menus.some((menu) => String(menu.id) === index && menu.can_delete)) return;
  try {
    const res = await deleteMenuItem({ id: index });
    if (res.status == 200) {
      ElMessage({
        message: res.message,
        type: 'success',
      });
    } else {
      ElMessage({
        message: res.message,
        type: 'error',
      });
    }
    getMenu();
  } catch (error) {
    ElMessage({
      message: getErrorMessage(error, '删除分类失败'),
      type: 'error',
    });
  }
};
//跳转搜索
const goSearch = () => {
  window.open(`https://www.baidu.com/s?ie=utf-8&word=${searchValue.value}`, '_blank');
};
//退出登录
const logout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'logout-confirm-dialog',
      confirmButtonClass: 'logout-confirm-button',
    });

    await postRequest('/users/logout', {});
    clearLogin();
    state.menus = [];
    activeTab.value = '';

    await router.replace({
      name: 'login',
    });

    ElMessage.success('已退出登录');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getErrorMessage(error, '退出失败，请重试'));
    }
  }
};
</script>
<style lang="less" scoped>
.full-height {
  --home-gutter: 24px;
  width: 100%;
  height: var(--app-height, 100dvh);
  min-width: 0;
  min-height: 0;
  padding: max(var(--home-gutter), env(safe-area-inset-top))
    max(var(--home-gutter), env(safe-area-inset-right))
    max(var(--home-gutter), env(safe-area-inset-bottom))
    max(var(--home-gutter), env(safe-area-inset-left));
  gap: var(--app-space-4);
  box-sizing: border-box;
  .el-aside {
    width: clamp(180px, 18vw, 232px) !important;
    min-width: 0;
    min-height: 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--app-radius-panel);
    box-shadow: var(--app-shadow-panel);
    &::before {
      content: 'noIdea.';
      margin: 28px 24px 26px;
      color: var(--theme-text);
      font-size: 22px;
      font-weight: 650;
      letter-spacing: -0.8px;
    }
  }
  > .el-container {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--app-radius-panel);
    overflow: hidden;
    background: var(--theme-surface);
    box-shadow: var(--app-shadow-panel);
  }
  .el-main {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 28px;
    &::before {
      content: '我的收藏';
      display: block;
      margin-bottom: 8px;
      font-size: var(--app-page-title-size);
      line-height: 1.35;
      font-weight: 600;
      letter-spacing: -0.4px;
    }
  }
  .el-footer {
    height: 64px;
    padding: 0 32px;
    background: transparent;
  }
}
.el-aside,
.el-menu,
.el-main {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
.category-section {
  min-width: 0;
  margin-top: 24px;
  padding: 12px 0;
  border: 2px solid transparent;
  border-radius: var(--app-radius-panel);
  h2 {
    margin: 0 0 16px;
    font-size: 16px;
    color: var(--theme-text);
    overflow-wrap: anywhere;
    font-weight: 600;
  }
}
.drop-target {
  outline: 2px dashed var(--el-color-primary);
  outline-offset: -2px;
  background: var(--el-color-primary-light-9);
}
.empty-category {
  color: var(--theme-muted);
  padding: 12px 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.bookmark-marquee {
  position: fixed;
  z-index: 3;
  pointer-events: none;
  border: 1px solid var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  border-radius: 3px;
}
.el-main.is-editing {
  user-select: none;
}
.el-menu {
  background: transparent;
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 0 12px;
  overflow-y: auto;
  border: none;
  &::before {
    content: '我的分类';
    display: block;
    padding: 0 14px 12px;
    color: var(--theme-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  :deep(.el-menu-item-group__title) {
    display: none;
  }
}
.el-menu-item {
  height: 46px;
  margin-bottom: 6px;
  padding: 0 14px !important;
  justify-content: space-between;
  gap: 8px;
  border-radius: 12px;
  font-size: 14px;
  transition:
    background-color 160ms,
    color 160ms;
  &.is-active {
    background: var(--app-accent-soft);
    font-weight: 600;
  }
  &:hover .edit,
  &:focus-within .edit {
    display: flex;
  }
}
.category-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.edit {
  display: none;
  gap: 8px;
  flex-shrink: 0;
  color: var(--theme-muted);
  svg {
    width: 15px;
    height: 15px;
  }
}
.readonly-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--theme-muted);
}
.btnGroup {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
  margin: 14px;
  justify-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--theme-muted);
}
.sidebar-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--app-button-height);
  min-width: var(--app-button-height);
  height: var(--app-button-height);
  padding: 0;
  flex-shrink: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  &:not(:disabled):hover,
  &:focus-visible,
  &.is-active {
    color: var(--ui-accent-text, var(--el-color-primary));
  }
  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  :deep(svg) {
    display: block;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
  }
}
.header {
  height: 72px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: transparent;
  border-bottom: 1px solid var(--el-border-color-lighter);
  &::before {
    content: '收藏工作台';
    color: var(--theme-muted);
    white-space: nowrap;
    font-size: 13px;
    font-weight: 550;
  }
  > .el-input {
    min-width: 0;
    flex: 1 1 280px;
    width: auto;
    max-width: 460px;
    :deep(.el-input__wrapper) {
      height: 36px;
      padding: 0 12px;
      background: var(--app-control-bg);
      border-radius: 8px 0 0 8px;
    }
    :deep(.el-input-group__append) {
      padding: 0 12px;
      border: 1px solid var(--el-border-color);
      box-shadow: none;
      border-radius: 0 8px 8px 0;
      background: var(--app-control-bg);
      color: var(--theme-muted);
      border-left: 0;
    }
  }
  .user-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    min-width: 0;
    max-width: min(280px, 42%);
    margin-left: auto;
    flex: 0 1 auto;
  }
  .current-user {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--theme-text);
    font-size: 13px;
  }
  .current-user-admin {
    padding: 6px 8px;
    border-radius: 8px;
    text-decoration: none;
    transition: background-color 0.2s;
    &:hover {
      color: var(--el-color-primary);
      background: var(--el-fill-color-light);
    }
    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 2px;
    }
  }
  .current-user-icon {
    flex-shrink: 0;
    color: var(--theme-muted);
    font-size: 16px;
  }
  .current-user-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .home-logout {
    --el-button-bg-color: transparent;
    padding: 0 var(--app-button-padding);
    height: var(--app-button-height);
    font-size: var(--app-font-control-size);
    flex-shrink: 0;
  }
}
.bottom {
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-right: 124px;
  color: var(--theme-muted);
  font-size: 12px;
  p {
    min-width: 0;
    margin: 0;
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .el-link {
    flex-shrink: 0;
    font-size: 12px;
  }
}
.category-name-input {
  width: 100%;
  min-width: 0;
}
@media (max-width: 1200px) {
  .btnGroup {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 4px;
  }
  .full-height {
    --home-gutter: 14px;
    gap: 14px;
  }
  .full-height .el-aside {
    width: 184px !important;
  }
  .full-height .el-main {
    padding: 24px 20px;
  }
  .header {
    height: 72px;
    padding: 0 20px;
    gap: 16px;
    &::before {
      display: none;
    }
  }
  .header > .el-input {
    flex: 1;
    width: auto;
    max-width: none;
  }
  .category-section {
    padding: 12px;
  }
  .full-height .el-footer {
    height: 56px;
    padding: 0 20px;
  }
  .bottom {
    padding-right: 116px;
  }
}
@media (max-width: 900px) {
  .full-height {
    flex-direction: column;
    --home-gutter: 10px;
    gap: 10px;
    .el-aside {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      flex-shrink: 0;
      width: 100% !important;
      border-radius: var(--app-radius-panel);
      &::before {
        display: none;
      }
    }
    > .el-container {
      border-radius: var(--app-radius-panel);
    }
    .el-main {
      padding: 28px;
      &::before {
        font-size: var(--app-page-title-size);
      }
    }
    .el-footer {
      padding: 0 16px;
      height: 48px;
    }
    :deep(.theme-launcher) {
      right: max(24px, env(safe-area-inset-right));
      bottom: max(18px, env(safe-area-inset-bottom));
      height: var(--app-button-height);
      padding: 0 12px;
    }
  }
  .el-menu {
    flex: none;
    padding: 7px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
    &::before {
      display: none;
    }
    :deep(.el-menu-item-group > ul) {
      display: flex;
      gap: 6px;
      width: max-content;
    }
  }
  .el-menu-item {
    flex-shrink: 0;
    height: 40px;
    margin-bottom: 0;
    max-width: min(224px, calc(100vw - 156px));
    border-radius: 9px;
    font-size: 13px;
    .edit {
      display: flex;
    }
  }
  .btnGroup {
    display: flex;
    margin: 7px 7px 7px 0;
    padding: 0 0 0 7px;
    border-top: 0;
    border-left: 1px solid var(--el-border-color-lighter);
    justify-content: flex-start;
    gap: 2px;
    .sidebar-action--secondary {
      display: none;
    }
  }
  .sidebar-action {
    width: var(--app-button-height);
    height: var(--app-button-height);
  }
  .header {
    height: 64px;
    padding: 0 16px;
    gap: 16px;
    .user-actions {
      max-width: 44%;
    }
  }
  .category-section {
    margin-top: 20px;
    padding: 8px;
    h2 {
      margin-bottom: 14px;
      font-size: 16px;
      font-weight: 600;
    }
  }
  .bottom {
    padding-right: 104px;
    font-size: 11px;
    gap: 8px;
  }
}
@media (max-width: 600px) {
  .full-height {
    --home-gutter: 8px;
    gap: 8px;
    .el-main {
      padding: 28px;
      &::before {
        font-size: var(--app-page-title-size);
      }
    }
    .el-footer {
      padding: 0 12px;
    }
    :deep(.theme-launcher) {
      right: max(20px, env(safe-area-inset-right));
      bottom: max(16px, env(safe-area-inset-bottom));
    }
  }
  .header {
    height: auto;
    padding: 10px 12px;
    flex-wrap: wrap;
    gap: 8px;
    .user-actions {
      order: -1;
      width: 100%;
      max-width: none;
      justify-content: space-between;
      margin-left: 0;
      gap: 12px;
      > .el-button {
        height: var(--app-button-height);
        padding: 0 10px;
      }
    }
    .current-user {
      flex: 1;
    }
    > .el-input {
      flex: 0 0 100%;
      width: 100%;
      :deep(.el-input__wrapper) {
        height: 36px;
        padding: 0 12px;
      }
      :deep(.el-input-group__append) {
        padding: 0 12px;
        border-left: 0;
      }
    }
  }
  .category-section {
    margin-top: 16px;
    padding: 4px;
  }
}
@media (max-height: 600px) {
  .full-height {
    --home-gutter: 8px;
    gap: 8px;
    .el-aside::before {
      margin: 14px 18px;
      font-size: 24px;
    }
    .el-main {
      padding: 28px;
      &::before {
        font-size: var(--app-page-title-size);
        margin-bottom: 4px;
      }
    }
    .el-footer {
      height: 40px;
      padding: 0 16px;
    }
    :deep(.theme-launcher) {
      right: max(24px, env(safe-area-inset-right));
      bottom: max(13px, env(safe-area-inset-bottom));
      height: var(--app-button-height);
      padding: 0 12px;
    }
  }
  .header {
    height: 52px;
    padding: 0 16px;
    > .el-input :deep(.el-input__wrapper) {
      height: 34px;
    }
  }
  .category-section {
    margin-top: 12px;
    padding: 6px;
    h2 {
      margin-bottom: 10px;
      font-size: 16px;
      font-weight: 600;
    }
  }
  .btnGroup {
    margin-top: 8px;
    margin-bottom: 8px;
  }
  .bottom {
    padding-right: 104px;
  }
}
@media (max-width: 600px) and (max-height: 600px) {
  .header {
    height: auto;
    padding: 8px 12px;
    gap: 6px;
  }
}
</style>
