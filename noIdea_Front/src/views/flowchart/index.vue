<template>
  <div class="flow-page">
    <header class="flow-header">
      <el-button @click="goBack">返回收藏</el-button>
      <div>
        <h1>我的流程图</h1>
        <p>把想法连成清晰的步骤</p>
      </div>
      <span class="save-state" role="status">{{
        loading
          ? '正在加载'
          : loadError
            ? '未连接到账户'
            : dirty
              ? '有未保存的修改'
              : '已与账户同步'
      }}</span>
      <el-button type="primary" :loading="saving" :disabled="loading || !!loadError" @click="save"
        >保存流程图</el-button
      >
    </header>
    <div v-if="loading" class="flow-message">正在加载你的流程图…</div>
    <div v-else-if="loadError" class="flow-message">
      <p>{{ loadError }}</p>
      <el-button @click="load">重新加载</el-button>
    </div>
    <template v-else>
      <div class="flow-toolbar">
        <el-button v-for="item in nodeTypes" :key="item.type" @click="addNode(item.type)"
          >+ {{ item.label }}</el-button
        >
        <el-button :type="connecting ? 'primary' : 'default'" @click="toggleConnection">{{
          connecting ? '取消连线' : '连线'
        }}</el-button>
        <el-button :disabled="!past.length" @click="undo">撤销</el-button>
        <el-button :disabled="!future.length" @click="redo">重做</el-button>
        <label class="zoom-control"
          >缩放
          <select v-model.number="zoom" aria-label="画布缩放">
            <option :value="0.5">50%</option>
            <option :value="0.75">75%</option>
            <option :value="1">100%</option>
            <option :value="1.25">125%</option>
          </select></label
        >
        <el-button @click="exportSvg">导出 SVG</el-button>
        <el-button @click="exportJson">备份 JSON</el-button>
        <el-button @click="fileInput?.click()">导入 JSON</el-button>
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          hidden
          @change="importJson"
        />
      </div>
      <p class="flow-hint" role="status">
        {{
          connecting
            ? connectionStart
              ? '再点击目标节点，完成连线。'
              : '点击起点节点，再点击终点节点。'
            : '拖动节点调整位置；点击节点或连线编辑文字。修改后请点击保存。'
        }}
      </p>
      <div class="flow-workspace">
        <div class="canvas-scroll">
          <svg
            ref="canvas"
            class="flow-canvas"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1600 1000"
            :width="1600 * zoom"
            :height="1000 * zoom"
            aria-label="流程图画布"
            font-family="sans-serif"
            @pointermove="moveNode"
            @pointerup="endDrag"
            @pointercancel="endDrag"
            @lostpointercapture="endDrag"
          >
            <title>我的流程图</title>
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
            </defs>
            <rect width="1600" height="1000" fill="#f8fafc" @click="selected = ''" />
            <g
              v-for="edge in document.edges"
              :key="edge.id"
              :data-edge="edge.id"
              tabindex="0"
              role="button"
              :aria-label="`连线 ${edge.label || '未命名'}`"
              @click.stop="selectEdge(edge.id)"
              @keydown.enter.prevent="selectEdge(edge.id)"
            >
              <path
                :d="edgeGeometry(edge, document.nodes).path"
                fill="none"
                stroke="transparent"
                stroke-width="18"
              />
              <path
                :d="edgeGeometry(edge, document.nodes).path"
                fill="none"
                :stroke="selected === edge.id ? '#2563eb' : '#64748b'"
                stroke-width="2.5"
                marker-end="url(#flow-arrow)"
              />
              <text
                :x="edgeGeometry(edge, document.nodes).x"
                :y="edgeGeometry(edge, document.nodes).y"
                fill="#475569"
                font-size="14"
              >
                {{ edge.label }}
              </text>
            </g>
            <g
              v-for="node in document.nodes"
              :key="node.id"
              :data-node="node.id"
              :transform="`translate(${node.x},${node.y})`"
              tabindex="0"
              role="button"
              :aria-label="`节点 ${node.label}`"
              class="flow-node"
              @pointerdown.stop="beginDrag($event, node)"
              @click.stop="selectNode(node.id)"
              @keydown.enter.prevent="selectNode(node.id)"
            >
              <title>{{ node.label }}</title>
              <polygon
                v-if="node.type === 'decision'"
                points="0,-50 80,0 0,50 -80,0"
                fill="#fef3c7"
                :stroke="nodeStroke(node.id)"
                stroke-width="2"
              />
              <rect
                v-else
                x="-80"
                y="-30"
                width="160"
                height="60"
                :rx="node.type === 'process' ? 10 : 30"
                :fill="
                  node.type === 'start' ? '#dcfce7' : node.type === 'end' ? '#fee2e2' : '#eff6ff'
                "
                :stroke="nodeStroke(node.id)"
                stroke-width="2"
              />
              <text
                fill="#1e293b"
                text-anchor="middle"
                font-size="14"
                font-family="sans-serif"
                pointer-events="none"
              >
                <tspan
                  v-for="(line, index) in labelLines(node.label)"
                  :key="index"
                  x="0"
                  :y="(index - (labelLines(node.label).length - 1) / 2) * 17 + 5"
                >
                  {{ line }}
                </tspan>
              </text>
            </g>
          </svg>
        </div>
        <aside class="flow-inspector">
          <h2>{{ selectedNode ? '节点设置' : selectedEdge ? '连线设置' : '使用说明' }}</h2>
          <template v-if="selectedNode || selectedEdge">
            <label for="flow-label">{{
              selectedNode ? '节点文字' : '连线文字（例如：是 / 否）'
            }}</label>
            <el-input
              id="flow-label"
              :model-value="selectedNode?.label ?? selectedEdge?.label"
              type="textarea"
              :rows="3"
              maxlength="64"
              show-word-limit
              @input="updateLabel"
              @blur="labelEditId = ''"
            />
            <p v-if="selectedNode">可以从工具栏开启连线，然后依次点击两个节点。</p>
            <el-button type="danger" plain @click="removeSelected">{{
              selectedNode ? '删除节点' : '删除连线'
            }}</el-button>
          </template>
          <template v-else
            ><p>绿色代表开始，蓝色代表步骤，菱形代表判断，红色代表结束。</p>
            <p>判断节点可以连接多条分支；选中连线后填写“是”“否”等说明。</p>
            <p>流程图保存在你的账户下。SVG 可用作图片，JSON 可备份并重新导入。</p></template
          >
          <div class="flow-count">
            {{ document.nodes.length }} / 100 个节点 · {{ document.edges.length }} / 200 条连线
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'FlowchartPage' });
import { computed, onMounted, onBeforeUnmount, nextTick, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getRequest, putRequest } from '@/utils/httpService';
import { getErrorMessage } from '@/utils/errors';
import {
  edgeGeometry,
  nodeTypes,
  parseDocument,
  type FlowDocument,
  type FlowNode,
  type NodeType,
  type SavedFlowchart,
} from './document';
const router = useRouter(),
  route = useRoute();
const document = ref<FlowDocument>({ version: 1, nodes: [], edges: [] });
const revision = ref(0),
  saved = ref(''),
  loading = ref(true),
  saving = ref(false),
  loadError = ref('');
const canvas = ref<SVGSVGElement | null>(null),
  fileInput = ref<HTMLInputElement | null>(null);
const selected = ref(''),
  connecting = ref(false),
  connectionStart = ref(''),
  zoom = ref(0.75);
const past = ref<string[]>([]),
  future = ref<string[]>([]);
const serialize = () => JSON.stringify(document.value);
const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
const dirty = computed(() => !loading.value && !loadError.value && serialize() !== saved.value);
const selectedNode = computed(() =>
  document.value.nodes.find((node) => node.id === selected.value),
);
const selectedEdge = computed(() =>
  document.value.edges.find((edge) => edge.id === selected.value),
);
let drag: { id: string; pointer: number; offsetX: number; offsetY: number; before: string } | null =
  null;
let labelEditId = '';
function remember(before = serialize()) {
  past.value.push(before);
  if (past.value.length > 50) past.value.shift();
  future.value = [];
}
function undo() {
  labelEditId = '';
  const previous = past.value.pop();
  if (!previous) return;
  future.value.push(serialize());
  document.value = JSON.parse(previous);
  selected.value = '';
  connectionStart.value = '';
}
function redo() {
  labelEditId = '';
  const next = future.value.pop();
  if (!next) return;
  past.value.push(serialize());
  document.value = JSON.parse(next);
  selected.value = '';
  connectionStart.value = '';
}
async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const response = await getRequest<SavedFlowchart>('/flowchart');
    document.value = parseDocument(response.data.document);
    revision.value = response.data.revision;
    saved.value = serialize();
    past.value = [];
    future.value = [];
  } catch (error) {
    loadError.value = getErrorMessage(error, '流程图加载失败，请确认后端已执行流程图迁移');
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (saving.value || loading.value || loadError.value) return;
  saving.value = true;
  try {
    const snapshot = parseDocument(JSON.parse(serialize()));
    const response = await putRequest<SavedFlowchart>('/flowchart', {
      document: snapshot,
      revision: revision.value,
    });
    revision.value = response.data.revision;
    saved.value = JSON.stringify(snapshot);
    ElMessage.success('流程图已保存');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存失败，请重试'));
  } finally {
    saving.value = false;
  }
}
function addNode(type: NodeType) {
  if (document.value.nodes.length >= 100) {
    ElMessage.warning('最多添加100个节点');
    return;
  }
  remember();
  const node: FlowNode = {
    id: newId(),
    type,
    label: nodeTypes.find((item) => item.type === type)!.label,
    x: 650 + (document.value.nodes.length % 4) * 190,
    y: 120 + (Math.floor(document.value.nodes.length / 4) % 5) * 160,
  };
  document.value.nodes.push(node);
  selected.value = node.id;
  void nextTick(() => {
    const scroller = canvas.value?.parentElement;
    scroller?.scrollTo({
      left: Math.max(0, node.x * zoom.value - scroller.clientWidth / 2),
      top: Math.max(0, node.y * zoom.value - scroller.clientHeight / 2),
    });
  });
}
function toggleConnection() {
  connecting.value = !connecting.value;
  connectionStart.value = '';
}
function selectNode(id: string) {
  selected.value = id;
  if (!connecting.value) return;
  if (!connectionStart.value) {
    connectionStart.value = id;
    return;
  }
  if (connectionStart.value === id) {
    ElMessage.warning('请选择另一个节点');
    return;
  }
  if (document.value.edges.some((edge) => edge.from === connectionStart.value && edge.to === id)) {
    ElMessage.warning('这两个节点已连接');
    return;
  }
  if (document.value.edges.length >= 200) {
    ElMessage.warning('最多添加200条连线');
    return;
  }
  remember();
  document.value.edges.push({
    id: newId(),
    from: connectionStart.value,
    to: id,
    label: '',
  });
  connecting.value = false;
  connectionStart.value = '';
}
function selectEdge(id: string) {
  selected.value = id;
}
function nodeStroke(id: string) {
  return selected.value === id || connectionStart.value === id ? '#2563eb' : '#94a3b8';
}
function point(event: PointerEvent) {
  const matrix = canvas.value?.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}
function beginDrag(event: PointerEvent, node: FlowNode) {
  if (event.button !== 0 || connecting.value) return;
  const location = point(event);
  if (!location || !canvas.value) return;
  selected.value = node.id;
  drag = {
    id: node.id,
    pointer: event.pointerId,
    offsetX: location.x - node.x,
    offsetY: location.y - node.y,
    before: serialize(),
  };
  canvas.value.setPointerCapture(event.pointerId);
}
function moveNode(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointer) return;
  const location = point(event),
    node = document.value.nodes.find((item) => item.id === drag?.id);
  if (!location || !node) return;
  node.x = Math.round(Math.max(90, Math.min(1510, location.x - drag.offsetX)));
  node.y = Math.round(Math.max(60, Math.min(940, location.y - drag.offsetY)));
}
function endDrag() {
  if (!drag) return;
  const before = drag.before;
  drag = null;
  if (serialize() !== before) remember(before);
}
function labelLines(label: string) {
  return label.match(/.{1,10}/gu)?.slice(0, 4) || [''];
}
function updateLabel(value: string | number) {
  const item = selectedNode.value || selectedEdge.value;
  if (!item) return;
  const label = String(value).slice(0, 64);
  if (item.label === label) return;
  if (labelEditId !== item.id) remember();
  labelEditId = item.id;
  item.label = label;
}
function removeSelected() {
  if (!selected.value) return;
  remember();
  document.value.nodes = document.value.nodes.filter((node) => node.id !== selected.value);
  document.value.edges = document.value.edges.filter(
    (edge) =>
      edge.id !== selected.value && edge.from !== selected.value && edge.to !== selected.value,
  );
  selected.value = '';
  connectionStart.value = '';
}
function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJson() {
  download(JSON.stringify(document.value, null, 2), 'application/json', '我的流程图.json');
}
function exportSvg() {
  if (!canvas.value) return;
  const copy = canvas.value.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', '1600');
  copy.setAttribute('height', '1000');
  download(new XMLSerializer().serializeToString(copy), 'image/svg+xml', '我的流程图.svg');
}
async function importJson(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    if (file.size > 100 * 1024) throw new Error('流程图文件不能超过100KB');
    const imported = parseDocument(JSON.parse(await file.text()));
    await ElMessageBox.confirm('导入将替换当前画布，可通过撤销恢复。是否继续？', '导入流程图', {
      confirmButtonText: '导入',
      cancelButtonText: '取消',
    });
    remember();
    document.value = imported;
    selected.value = '';
    connectionStart.value = '';
  } catch (error) {
    if (error !== 'cancel' && error !== 'close')
      ElMessage.error(getErrorMessage(error, '导入失败'));
  }
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  try {
    await ElMessageBox.confirm('流程图有未保存的修改，确定离开吗？', '离开流程图', {
      confirmButtonText: '离开',
      cancelButtonText: '继续编辑',
      type: 'warning',
    });
    return true;
  } catch {
    return false;
  }
});
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload);
  drag = null;
});
</script>

<style scoped lang="less">
.flow-page {
  height: 100dvh;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--theme-text);
}
.flow-header {
  display: flex;
  align-items: center;
  gap: 20px;
  h1 {
    margin: 0;
    font-size: 24px;
  }
  p {
    margin: 5px 0 0;
    color: var(--theme-muted);
    font-size: 13px;
  }
  .save-state {
    margin-left: auto;
    color: var(--theme-muted);
    font-size: 13px;
  }
}
.flow-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  background: var(--theme-surface);
  border: 1px solid var(--el-border-color-lighter);
  .el-button {
    margin: 0;
  }
}
.zoom-control {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  select {
    color: var(--theme-text);
    background: var(--theme-surface);
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    padding: 6px;
  }
}
.flow-hint {
  margin: 0;
  color: var(--theme-muted);
  font-size: 13px;
}
.flow-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
}
.canvas-scroll {
  flex: 1;
  min-width: 0;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 18px;
  background: #f8fafc;
}
.flow-canvas {
  display: block;
  user-select: none;
  touch-action: none;
}
.flow-node {
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
}
.flow-inspector {
  width: 230px;
  flex-shrink: 0;
  padding: 20px;
  overflow-y: auto;
  border-radius: 18px;
  background: var(--theme-surface);
  border: 1px solid var(--el-border-color-lighter);
  h2 {
    margin: 0 0 18px;
    font-size: 16px;
  }
  label {
    display: block;
    margin-bottom: 10px;
    font-size: 13px;
  }
  p {
    color: var(--theme-muted);
    font-size: 13px;
    line-height: 1.8;
  }
  .el-button {
    margin-top: 16px;
  }
}
.flow-count {
  margin-top: 24px;
  color: var(--theme-muted);
  font-size: 12px;
}
.flow-message {
  padding: 60px 20px;
  text-align: center;
  color: var(--theme-muted);
}
@media (max-width: 800px) {
  .flow-page {
    padding: 12px;
    gap: 12px;
  }
  .flow-header {
    flex-wrap: wrap;
    gap: 12px;
    h1 {
      font-size: 20px;
    }
    .save-state {
      margin-left: 0;
    }
  }
  .flow-workspace {
    flex-direction: column;
  }
  .flow-inspector {
    width: auto;
    max-height: 180px;
    padding: 14px;
  }
  .canvas-scroll {
    min-height: 240px;
  }
}
</style>
