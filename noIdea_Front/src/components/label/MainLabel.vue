<template>
  <div class="mainLabel">
    <el-card
      v-for="(i, index) in orderList"
      :key="i.targetUrl"
      class="box draggable-item"
      @click="linkTo(i.targetUrl, i.type)"
      :draggable="editMode"
      @dragstart="onDragStart($event, index)"
      @dragover.prevent="onDragOver(index)"
      @drop="onDrop($event, i.id)"
      @mouseenter="handleHover(index)"
      @mouseleave="handleHover(-1)"
      :class="{ hoverStyle: hoverIndex == index }"
    >
      <span>{{ i.title }}</span>
      <!--  -->
      <div v-if="currentIndex == index && editMode" class="edit">
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
          <el-card>图标</el-card>
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
import { defineProps, watch, defineEmits } from "vue";
import { labelData } from "./label";
import { useRouter } from "vue-router";
import {
  swapSubItem,
  addsubMenuItem,
  deletesubMenuItem,
  updatesubMenuItem,
} from "@/api/menuApi/menu";
import { error } from "console";
const props = defineProps<{
  editMode: boolean;
  activeLists: any[];
  activeTab: string;
}>();
const router = useRouter();
const currentIndex = ref<number | null>(null);
const draggedItemIndex = ref<number | null>(null);
const emit = defineEmits(["update-message"]);
const dialogType = ref();
const linkTo = (targetUrl: string, type: string) => {
  if (type == "5") {
    router.push({
      path: targetUrl,
    });
  } else {
    window.open(targetUrl, "_blank");
  }
};
const dialogVisible = ref<boolean>(false);

const hoverIndex = ref<number | null>(null);

const formData = reactive({
  targetUrl: "",
  title: "",
  icon: "",
  desc: "",
  id: "",
});
//拖拽事件
const onDragStart = (event: DragEvent, index: number) => {
  draggedItemIndex.value = index;
  (event.dataTransfer as DataTransfer).effectAllowed = "move";
};

const orderList = computed(() => {
  return props.activeLists.sort((a: any, b: any) => a.order - b.order);
});

//拖拽改动
const onDrop = (event: DragEvent, id: number) => {
  if (draggedItemIndex.value !== null) {
    swapSubItem({
      firstId: id,
      secondId: props.activeLists[draggedItemIndex.value].id,
    }).then((res) => {
      if (res.status == 200) {
        ElMessage({
          message: "位置交换成功",
          type: "success",
        });
        emit("update-message");
      }
    });
    draggedItemIndex.value = null;
    hoverIndex.value = null;
  }
};

const onDragOver = (index: number) => {
  hoverIndex.value = index;
};

const showAdd = () => {
  dialogVisible.value = true;
  dialogType.value = "add";
  resetData();
};
const resetData = () => {
  formData.targetUrl = "";
  formData.title = "";
  formData.icon = "";
  formData.desc = "";
  formData.id = "";
};

//类似hover事件
const handleHover = (index: number) => {
  currentIndex.value = index;
};

//编辑书签
const editDetail = (i: any) => {
  dialogVisible.value = true;
  dialogType.value = "update";
  formData.targetUrl = i.targetUrl;
  formData.title = i.title;
  formData.id = i.id;
};

//删除书签
const deleteItem = (id: string) => {
  deletesubMenuItem({
    subMenuId: id,
  })
    .then((res: any) => {
      if (res.status == 200) {
        ElMessage({
          message: "删除书签成功",
          type: "success",
        });
        emit("update-message");
      }
    })
    .catch((error: any) => {
      ElMessage({
        message: error.message,
        type: "success",
      });
    });
};
const addSubMenus = () => {
  const params = {
    ...formData,
    menuId: props.activeTab,
  };
  addsubMenuItem(params).then((res: any) => {
    if (res.status == 200) {
      ElMessage({
        message: "添加书签成功",
        type: "success",
      });
      emit("update-message");
    }
  });
};

const editSubMenus = () => {
  const params = {
    ...formData,
    subMenuId: formData.id,
  };
  updatesubMenuItem(params).then((res: any) => {
    if (res.status == 200) {
      ElMessage({
        message: "更新书签成功",
        type: "success",
      });
      emit("update-message");
    }
  });
};

//添加或修改标签
const confirmLabel = () => {
  dialogVisible.value = false;
  if (formData.targetUrl && formData.title) {
    // let len = initData.value.filter((i) => i.id == formData.id).length;
    if (dialogType.value == "update") {
      editSubMenus();
    } else {
      addSubMenus();
    }
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
  display: flex;
  flex-wrap: wrap;
  .lastBox {
    display: flex;
    justify-content: center;
    /deep/ svg {
      margin: 0 auto;
    }
  }
  .box {
    // padding: 20px;
    margin: 20px;
    width: 200px;
    cursor: pointer;
    display: flex;
    align-items: center;
    /deep/ .el-card__body {
      justify-content: space-between;
      display: flex;
      align-items: center;
      width: 100%;
    }
    &:hover {
      background-color: antiquewhite;
    }
    &.hoverStyle {
      // background-color: lightblue; // 悬停时的背景色
      border-top: 2px dashed blue;
    }
    .edit {
      display: flex;
      flex-direction: column;
    }
  }
  .autoBtn {
    display: flex;
    justify-content: space-between;
  }
}
</style>