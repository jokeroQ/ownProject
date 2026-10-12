<template>
  <el-container class="full-height">
    <el-aside width="200px">
      <el-menu :default-active="activeTab" class="el-menu-vertical-demo">
        <el-menu-item-group>
          <el-menu-item
            @click="changeTab(String(i.id))"
            :index="String(i.id)"
            v-for="i in state.menus"
            :key="i.index"
            >{{ i.title }}
            <div class="edit">
              <i-ep-edit @click.stop="editDetail(i)"></i-ep-edit>
              <el-popconfirm
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
      <div class="btnGroup">
        <i-ep-folderAdd @click="createMenu" />
        <i-ep-setting @click="goEdit" />
        <i-ep-download />
        <i-ep-upload />
        <i-ep-questionFilled />
      </div>
    </el-aside>
    <el-container>
      <el-header class="header">
        <el-input
          v-model="searchValue"
          placeholder="请输入搜索内容"
          @keyup.enter="goSearch"
          clearable
        >
          <template #append>
            <el-button :icon="Search" @click="goSearch" />
          </template>
        </el-input>

        <el-button type="danger" plain @click="logout"> 退出登录 </el-button>
      </el-header>
      <el-main>
        <MainLabel
          :activeTab="activeTab"
          :editMode="editMode"
          :activeLists="activeLists"
          @update-message="getMenu"
        ></MainLabel>
      </el-main>
      <el-footer>
        <div class="bottom">
          <p>{{ state.moto }}</p>
          <el-link @click="exitMode" :underline="false" v-if="editMode">退出编辑模式</el-link>
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
        style="width: 240px"
        placeholder="请输入标签名称"
        @keyup.enter="addType"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="addType"> 确认 </el-button>
          <el-button @click="dialogVisible = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <ThemeSettings />
  </el-container>
</template>

<script setup lang="ts">
defineOptions({ name: 'HomePage' });
import MainLabel from '@/components/label/MainLabel.vue';
import ThemeSettings from '@/components/theme/ThemeSettings.vue';
import { getMotto } from '@views/home/home';
import { deleteMenuItem } from '@/api/menuApi/menu';
import { Search } from '@element-plus/icons-vue';
import { reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { postRequest, getRequest, putRequest } from '../../utils/httpService';
import { useRouter, useRoute } from 'vue-router';
import { clearLogin } from '@/utils/auth';
import type { Menu } from '@/utils/types';
import { getErrorMessage } from '@/utils/errors';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
// const state = reactive({
//   menuList: menuList,
// });
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
const editMode = ref<boolean>(false);
const mode = ref<string>('add');
const index = ref<string>('');
const syncCategoryUrl = (category: string) => {
  if (route.name !== 'home' || route.query.category === (category || undefined)) return;
  void router.replace({
    name: 'home',
    query: { ...route.query, category: category || undefined },
    hash: route.hash,
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
    if (route.name === 'home' && state.menus.length) restoreCategory();
  },
);
onMounted(() => {
  getMenu();
});
const activeLists = computed(() => {
  const data = state.menus.find((i) => String(i.id) === activeTab.value);
  return data ? data.menuLists : [];
});
//获取最新的菜单
const getMenu = async () => {
  getRequest<Menu[]>('/menu/getMenus')
    .then((res) => {
      state.menus = res.data;
      restoreCategory();
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
  // The route is the source of truth; update the visible category after its URL is saved.
  syncCategoryUrl(index);
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
  editMode.value = true;
  ElMessage({
    message: '已经开启编辑功能，点击右下角可退出',
  });
};
//关闭编辑模式
const exitMode = () => {
  editMode.value = false;
  ElMessage({
    message: '已退出编辑模式',
  });
};
//编辑左侧菜单标签
const editDetail = (i: Menu) => {
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
  width: 100%;
  height: 100%;
  padding: 20px;
  gap: 20px;
  box-sizing: border-box;
  .el-aside {
    width: 232px !important;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 22px;
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.04);
    &::before {
      content: 'noIdea.';
      margin: 26px 26px 22px;
      color: var(--ui-accent-text, var(--el-color-primary));
      font-size: 28px;
      font-weight: 750;
      letter-spacing: -1.5px;
    }
  }
  > .el-container {
    min-width: 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 22px;
    overflow: hidden;
    background: var(--theme-surface);
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.04);
  }
  .el-main {
    padding: 32px;
    &::before {
      content: '我的收藏';
      display: block;
      margin-bottom: 8px;
      font-size: 28px;
      line-height: 1.35;
      font-weight: 700;
      letter-spacing: -0.8px;
    }
  }
  .el-footer {
    height: 64px;
    padding: 0 32px;
    background: transparent;
  }
}
.el-menu {
  flex: 1;
  min-height: 0;
  padding: 0 12px;
  overflow-y: auto;
  border: none;
  &::before {
    content: '我的分类';
    display: block;
    padding: 0 14px 12px;
    color: var(--theme-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
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
  border-radius: 12px;
  font-size: 14px;
  transition:
    background-color 160ms,
    color 160ms;
  &.is-active {
    background: var(--el-color-primary-light-9);
    font-weight: 650;
  }
  &:hover .edit {
    display: flex;
  }
}
.edit {
  display: none;
  gap: 8px;
  color: var(--theme-muted);
  svg {
    width: 15px;
    height: 15px;
  }
}
.btnGroup {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--theme-muted);
  svg {
    width: 18px;
    height: 18px;
    cursor: pointer;
    transition:
      color 160ms,
      transform 160ms;
    &:hover {
      color: var(--el-color-primary);
      transform: translateY(-2px);
    }
  }
}
.header {
  height: 86px;
  padding: 0 32px;
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
    width: min(460px, 58%);
    :deep(.el-input__wrapper) {
      height: 42px;
      padding: 0 14px;
      background: var(--el-fill-color-light);
      border-radius: 12px 0 0 12px;
      box-shadow: none;
    }
    :deep(.el-input-group__append) {
      padding: 0 18px;
      border: none;
      box-shadow: none;
      border-radius: 0 12px 12px 0;
      background: var(--el-fill-color-light);
      color: var(--theme-muted);
    }
  }
  > .el-button {
    --el-button-bg-color: transparent;
    --el-button-border-color: var(--el-border-color-lighter);
    --el-button-text-color: var(--theme-muted);
    --el-button-hover-bg-color: var(--el-fill-color-light);
    --el-button-hover-border-color: var(--el-border-color);
    --el-button-hover-text-color: var(--theme-text);
    padding: 0 14px;
    height: 36px;
    font-size: 12px;
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
    margin: 0;
    line-height: 1.6;
  }
  .el-link {
    flex-shrink: 0;
    font-size: 12px;
  }
}
@media (max-width: 1000px) {
  .full-height {
    padding: 14px;
    gap: 14px;
  }
  .full-height .el-aside {
    width: 196px !important;
  }
  .full-height .el-main {
    padding: 24px;
  }
  .header {
    padding: 0 24px;
    &::before {
      display: none;
    }
  }
  .header > .el-input {
    flex: 1;
    width: auto;
  }
}
@media (max-width: 640px) {
  .full-height {
    height: auto;
    min-height: 100vh;
    flex-direction: column;
    padding: 10px;
    gap: 12px;
    .el-aside {
      width: 100% !important;
      border-radius: 18px;
      &::before {
        font-size: 23px;
        margin: 16px 20px 14px;
      }
    }
    > .el-container {
      border-radius: 18px;
      min-height: 60vh;
    }
    .el-main {
      padding: 22px 18px;
      &::before {
        font-size: 24px;
      }
    }
    .el-footer {
      padding: 0 18px;
      height: 76px;
    }
  }
  .el-menu {
    flex: none;
    overflow-x: auto;
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
    margin-bottom: 0;
  }
  .btnGroup {
    margin: 12px 20px;
    padding-top: 12px;
    justify-content: flex-start;
    gap: 26px;
  }
  .header {
    height: 72px;
    padding: 0 18px;
    gap: 12px;
  }
  .bottom {
    padding-right: 100px;
    font-size: 11px;
  }
}
</style>
