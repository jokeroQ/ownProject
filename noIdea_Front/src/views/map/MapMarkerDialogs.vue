<template>
  <el-dialog
    v-model="listOpen"
    :title="`标记点（${markers.length}）`"
    width="440px"
    class="map-marker-dialog"
    append-to-body
  >
    <p class="marker-storage-note">按当前账号保存在本机浏览器，刷新后保留。</p>
    <p v-if="!markers.length" class="marker-empty">
      暂无标记。点击地图右上角的定位图标，再在地图上连续点击添加。
    </p>
    <ul v-else class="marker-list">
      <li v-for="marker in markers" :key="marker.id" :data-marker-row="marker.id">
        <div class="marker-summary">
          <strong>{{ marker.name }}</strong
          ><span
            >{{ marker.regionName }} · {{ marker.lng.toFixed(4) }},
            {{ marker.lat.toFixed(4) }}</span
          >
          <span v-if="marker.address" class="marker-detail">{{ marker.address }}</span>
          <span v-if="marker.description" class="marker-detail">{{ marker.description }}</span>
        </div>
        <div class="marker-row-actions">
          <el-tooltip content="定位到标记" :show-after="250" :trigger-keys="[]"
            ><el-button
              class="app-icon-button"
              :icon="Aim"
              :aria-label="`定位 ${marker.name}`"
              @click="focus(marker)"
          /></el-tooltip>
          <el-tooltip content="编辑标记" :show-after="250" :trigger-keys="[]"
            ><el-button
              class="app-icon-button"
              :icon="EditPen"
              :aria-label="`编辑 ${marker.name}`"
              @click="openEditor(marker)"
          /></el-tooltip>
          <el-tooltip content="删除标记" :show-after="250" :trigger-keys="[]"
            ><el-button
              class="app-icon-button"
              :icon="Delete"
              :aria-label="`删除 ${marker.name}`"
              @click="remove(marker.id)"
          /></el-tooltip>
        </div>
      </li>
    </ul>
    <template #footer><el-button @click="listOpen = false">关闭</el-button></template>
  </el-dialog>
  <el-dialog
    v-model="editorOpen"
    title="编辑标记"
    width="460px"
    class="map-marker-dialog"
    append-to-body
  >
    <el-form label-width="56px" label-position="left" @submit.prevent="save">
      <el-form-item label="名称"
        ><el-input
          v-model="draft.name"
          aria-label="标记名称"
          maxlength="40"
          show-word-limit
          @keyup.enter="save"
      /></el-form-item>
      <el-form-item label="地址"
        ><el-input
          v-model="draft.address"
          aria-label="标记地址"
          placeholder="可填写具体地址"
          maxlength="120"
      /></el-form-item>
      <el-form-item label="备注"
        ><el-input
          v-model="draft.description"
          aria-label="标记备注"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="记录这个地点的信息"
      /></el-form-item>
      <el-form-item label="经度"
        ><el-input-number
          v-model="draft.lng"
          aria-label="标记经度"
          :min="-180"
          :max="180"
          :precision="6"
          :controls="false"
      /></el-form-item>
      <el-form-item label="纬度"
        ><el-input-number
          v-model="draft.lat"
          aria-label="标记纬度"
          :min="-90"
          :max="90"
          :precision="6"
          :controls="false"
      /></el-form-item>
    </el-form>
    <p class="marker-storage-note">名称、地址、备注和坐标均可编辑，保存后在本机保留。</p>
    <template #footer
      ><el-button @click="editorOpen = false">取消</el-button
      ><el-button type="primary" @click="save">保存标记</el-button></template
    >
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElTooltip,
} from 'element-plus';
import { Aim, Delete, EditPen } from '@element-plus/icons-vue';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/form/style/css';
import 'element-plus/es/components/form-item/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/input-number/style/css';
import type { MapMarker, MarkerEdit } from './useMapMarkers';
const props = defineProps<{
  markers: MapMarker[];
  saveMarker: (marker: MarkerEdit) => boolean;
  removeMarker: (id: string) => void;
}>();
const emit = defineEmits<{ focus: [marker: MapMarker] }>();
const listOpen = ref(false),
  editorOpen = ref(false);
const draft = reactive<{
  id: string;
  name: string;
  address: string;
  description: string;
  lng: number | undefined;
  lat: number | undefined;
}>({ id: '', name: '', address: '', description: '', lng: 0, lat: 0 });
function openList() {
  listOpen.value = true;
}
function openEditor(marker: MapMarker) {
  listOpen.value = false;
  Object.assign(draft, {
    id: marker.id,
    name: marker.name,
    address: marker.address,
    description: marker.description,
    lng: marker.lng,
    lat: marker.lat,
  });
  editorOpen.value = true;
}
function focus(marker: MapMarker) {
  listOpen.value = false;
  emit('focus', marker);
}
function remove(id: string) {
  props.removeMarker(id);
}
function save() {
  const name = draft.name.trim();
  if (
    !name ||
    name.length > 40 ||
    typeof draft.lng !== 'number' ||
    typeof draft.lat !== 'number' ||
    !Number.isFinite(draft.lng) ||
    !Number.isFinite(draft.lat)
  ) {
    ElMessage.warning('请填写标记名称和有效坐标');
    return;
  }
  if (draft.address.length > 120 || draft.description.length > 500) {
    ElMessage.warning('地址最多120字，备注最多500字');
    return;
  }
  if (
    props.saveMarker({
      id: draft.id,
      name,
      address: draft.address.trim(),
      description: draft.description.trim(),
      lng: draft.lng,
      lat: draft.lat,
    })
  )
    editorOpen.value = false;
}
defineExpose({ openList, openEditor });
watch(
  () => props.markers,
  (markers) => {
    if (editorOpen.value && !markers.some((marker) => marker.id === draft.id))
      editorOpen.value = false;
  },
);
</script>

<style scoped>
.marker-storage-note {
  margin: 0 0 16px;
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 1.8;
}
.marker-empty {
  margin: 20px 0;
  color: var(--theme-muted);
  font-size: 13px;
  line-height: 1.8;
}
.marker-list {
  display: grid;
  gap: 6px;
  max-height: min(50vh, 400px);
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  scrollbar-width: none;
}
.marker-list::-webkit-scrollbar {
  display: none;
}
.marker-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.marker-list li:last-child {
  border-bottom: 0;
}
.marker-summary {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.marker-summary strong {
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 500;
}
.marker-summary > span {
  font-size: 11px;
  color: var(--theme-muted);
  overflow-wrap: anywhere;
}
.marker-detail {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}
.marker-row-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}
.marker-row-actions .el-button {
  width: 28px;
  height: 28px;
  margin: 0;
}
:deep(.el-input-number) {
  width: 100%;
}
@media (max-width: 400px) {
  .marker-row-actions {
    gap: 0;
  }
  .marker-row-actions .el-button {
    width: 25px;
  }
}
</style>
