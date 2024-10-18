<template>
  <div class="mainLabel">
    <el-card
      v-for="(i, index) in initData"
      :key="i.targetUrl"
      class="box draggable-item"
      @click="linkTo(i.targetUrl,i.type)"
      :draggable="editMode"
      @dragstart="onDragStart($event, index)"
      @dragover.prevent="onDragOver(index)"
      @drop="onDrop($event, index)"
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
    <el-dialog v-model="dialogVisible" title="添加标签" width="500">
      <el-form>
        <el-form-item>
          <el-input placeholder="请输入目标网址" v-model="formData.url" />
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
import { defineProps, watch } from "vue";
import { labelData } from "./label";
import { useRouter } from "vue-router";
const props = defineProps<{
  activeTab: string;
  editMode: boolean;
}>();
const router=useRouter();
const currentIndex = ref<number | null>(null);
const draggedItemIndex = ref<number | null>(null);
const linkTo = (url: string,type:string) => {
  if(type=='5'){
    router.push({
      path:url
    })
  }else{
    window.open(url, "_blank");
  }
};
const dialogVisible = ref<boolean>(false);

const initData = ref(labelData.filter((i) => i.type == props.activeTab));

const hoverIndex = ref<number | null>(null);

const formData = reactive({
  url: "",
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

//拖拽改动
const onDrop = (event: DragEvent, index: number) => {
  if (draggedItemIndex.value !== null) {
    const draggedItem = initData.value[draggedItemIndex.value];
    initData.value.splice(draggedItemIndex.value, 1);
    initData.value.splice(index, 0, draggedItem);
    draggedItemIndex.value = null;
    hoverIndex.value = null;
  }
};

const onDragOver = (index: number) => {
  hoverIndex.value = index;
};

const showAdd = () => {
  dialogVisible.value = true;
  resetData();
};
const resetData = () => {
  formData.url = "";
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
  formData.url = i.targetUrl;
  formData.title = i.title;
  formData.id = i.id;
};

//删除书签
const deleteItem = (id: string) => {
  initData.value = initData.value.filter((i) => i.id !== id);
  ElMessage({
    message: "删除书签成功",
    type: "success",
  });
};

//添加或修改标签
const confirmLabel = () => {
  dialogVisible.value = false;
  if (formData.url && formData.title) {
    let len = initData.value.filter((i) => i.id == formData.id).length;
    if (len) {
      initData.value.forEach((i) => {
        if (i.id == formData.id) {
          i.targetUrl = formData.url;
          i.title = formData.title;
        }
      });
    } else {
      initData.value.push({
        id: formData.title,
        title: formData.title,
        targetUrl: formData.url,
        type: props.activeTab,
        icon: formData.icon,
      });
    }
  }
};

watch(
  () => props.activeTab,
  (newVal) => {
    // console.log(props.activeTab);
    initData.value = labelData.filter((i) => i.type == newVal);
  }
  // { immediate: true, deep: true }
);
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