<template>
  <el-container class="full-height">
    <el-aside width="200px">
      <el-menu :default-active="activeTab" class="el-menu-vertical-demo">
        <el-menu-item-group>
          <el-menu-item
            @click="changeTab(i.index)"
            :index="i.index"
            v-for="i in menus"
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
                @confirm.stop="deleteItem(i.index)"
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
            <el-button :icon="Search" @click="goSearch" /> </template
        ></el-input>
      </el-header>
      <el-main>
        <MainLabel :activeTab="activeTab" :editMode="editMode"></MainLabel>
      </el-main>
      <el-footer>
        <div class="bottom">
          <p>{{ statement.moto }}</p>
          <el-link @click="exitMode" :underline="false" v-if="editMode"
            >退出编辑模式</el-link
          >
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
  </el-container>
</template>

<script setup lang="ts">
import MainLabel from "@/components/label/MainLabel.vue";
import { menuList, Menu, getMotto } from "@views/home/home";
import { Search } from "@element-plus/icons-vue";
import { reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
// const state = reactive({
//   menuList: menuList,
// });
let menus = reactive<Menu[]>(menuList);
const searchValue = ref<string>("");
const activeTab = ref<string>("2");
const dialogVisible = ref(false);
const labelName = ref("");
const statement = reactive<object>({
  moto: getMotto(),
});
const editMode = ref<boolean>(false);
const mode = ref<string>("add");
const index = ref<string>("");
//切换菜单项
const changeTab = (index: string) => {
  //   console.log(index);
  activeTab.value = index;
};
//新增菜单
const createMenu = () => {
  dialogVisible.value = true;
  mode.value = "add";
  labelName.value = "";
  index.value = "";
};
const handleClose = (done: () => void) => {
  dialogVisible.value = false;
};

//开启编辑功能
const goEdit = () => {
  editMode.value = true;
  ElMessage({
    message: "已经开启编辑功能，点击右下角可退出",
  });
};
//关闭编辑模式
const exitMode = () => {
  editMode.value = false;
  ElMessage({
    message: "已退出编辑模式",
  });
};
//编辑左侧菜单标签
const editDetail = (i: any) => {
  mode.value = "update";
  dialogVisible.value = true;
  labelName.value = i.title;
  index.value = i.index;
};
//添加标签
const addType = () => {
  if (index.value) {
    menus.forEach((i) => {
      if (i.index == index.value) {
        i.title = labelName.value;
      }
    });
  } else {
    menus.push({
      index: `${menus.length + 1}dd`,
      title: labelName.value,
    });
  }
  dialogVisible.value = false;
};
//删除左侧菜单标签
const deleteItem = (index: string) => {
  const num = menus.findIndex((menu) => menu.index === index);
  if (num !== -1) {
    menus.splice(num, 1);
  }
};
//跳转搜索
const goSearch = () => {
  window.open(
    `https://www.baidu.com/s?ie=utf-8&word=${searchValue.value}`,
    "_blank"
  );
};
</script>
<style lang="less" scoped>
.btnGroup {
  display: flex;
  justify-content: space-evenly;
  margin: 20px 0;
  svg {
    cursor: pointer;
  }
}
.bottom {
  display: flex;
  justify-content: space-around;
  align-items: center;
}
.edit {
  display: none;
}
.el-menu-item {
  justify-content: space-between;
  &:hover .edit {
    display: flex;
    svg {
      margin-right: 12px;
    }
  }
}
.header {
  padding: 20px;
}
.full-height {
  height: 100%;
  width: 100vw;
  .el-aside {
    border-right: 1px solid #f1f1f1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .el-input {
    width: 50%;
  }
}
</style>