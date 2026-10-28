<template>
  <div class="flow-page">
    <header class="flow-header">
      <PageBackButton @click="goBack" />
      <div class="flow-heading">
        <h1>我的流程图</h1>
        <p>把想法连成清晰的步骤</p>
      </div>
      <span
        class="save-state"
        :class="{ 'is-dirty': dirty, 'is-error': loadError }"
        role="status"
        >{{
          loading
            ? '正在加载'
            : loadError
              ? '未连接到账户'
              : dirty
                ? '有未保存的修改'
                : '已与账户同步'
        }}</span
      >
      <el-button
        class="save-button"
        type="primary"
        :icon="Check"
        :loading="saving"
        :disabled="loading || !!loadError"
        @click="save"
        >保存流程图</el-button
      >
    </header>
    <div v-if="loading" class="flow-message">正在加载你的流程图…</div>
    <div v-else-if="loadError" class="flow-message">
      <p>{{ loadError }}</p>
      <el-button @click="load">重新加载</el-button>
    </div>
    <template v-else>
      <div class="flow-toolbar" role="toolbar" aria-label="流程图工具栏">
        <div class="toolbar-group" role="group" aria-label="添加节点">
          <el-button
            v-for="item in nodeTypes"
            :key="item.type"
            :icon="Plus"
            :aria-label="`+ ${item.label}`"
            @click="addNode(item.type)"
          >
            {{ item.label }}
          </el-button>
        </div>
        <div class="toolbar-group" role="group" aria-label="编辑工具">
          <el-tooltip
            :content="connecting ? '取消连线' : '连线'"
            :show-after="250"
            :trigger-keys="[]"
          >
            <el-button
              class="flow-icon-button app-icon-button"
              :type="connecting ? 'primary' : 'default'"
              :icon="Connection"
              :aria-label="connecting ? '取消连线' : '连线'"
              :aria-pressed="connecting"
              @click="toggleConnection"
            />
          </el-tooltip>
          <el-tooltip content="撤销" :show-after="250" :trigger-keys="[]">
            <span class="icon-tooltip-target"
              ><el-button
                class="flow-icon-button app-icon-button"
                :icon="RefreshLeft"
                aria-label="撤销"
                :disabled="!past.length"
                @click="undo"
            /></span>
          </el-tooltip>
          <el-tooltip content="重做" :show-after="250" :trigger-keys="[]">
            <span class="icon-tooltip-target"
              ><el-button
                class="flow-icon-button app-icon-button"
                :icon="RefreshRight"
                aria-label="重做"
                :disabled="!future.length"
                @click="redo"
            /></span>
          </el-tooltip>
        </div>
        <div class="toolbar-group view-tools" role="group" aria-label="画布视图">
          <label class="zoom-control" for="flow-zoom">缩放</label>
          <el-select
            id="flow-zoom"
            v-model="zoom"
            class="zoom-select"
            aria-label="画布缩放"
            @change="onZoomChange"
          >
            <el-option value="fit" label="适应容器" />
            <el-option
              v-for="value in [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]"
              :key="value"
              :value="value"
              :label="`${value * 100}%`"
            />
          </el-select>
          <el-tooltip content="适应容器" :show-after="250" :trigger-keys="[]">
            <el-button
              class="flow-icon-button app-icon-button"
              :icon="FullScreen"
              aria-label="适应容器"
              :aria-pressed="zoom === 'fit'"
              @click="fitCanvas"
            />
          </el-tooltip>
        </div>
        <div class="toolbar-group file-tools" role="group" aria-label="导入与导出">
          <el-button :icon="Download" @click="exportSvg">导出 SVG</el-button>
          <el-button :icon="Document" @click="exportJson">备份 JSON</el-button>
          <el-button :icon="Upload" @click="fileInput?.click()">导入 JSON</el-button>
        </div>
        <div class="toolbar-group inspector-tools">
          <el-tooltip
            :content="inspectorOpen ? '收起属性' : '属性 / 说明'"
            :show-after="250"
            :trigger-keys="[]"
          >
            <span class="icon-tooltip-target">
              <el-button
                class="flow-inspector-toggle flow-icon-button app-icon-button"
                data-flow-inspector-toggle
                :icon="Setting"
                :type="inspectorOpen ? 'primary' : 'default'"
                :aria-label="inspectorOpen ? '收起属性' : '属性 / 说明'"
                :aria-expanded="inspectorOpen"
                aria-controls="flow-inspector"
                @click="inspectorOpen = !inspectorOpen"
              />
            </span>
          </el-tooltip>
        </div>
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
        <div ref="canvasScroll" class="canvas-scroll">
          <div class="canvas-stage" :class="{ 'is-fit': zoom === 'fit' }" :style="canvasStageStyle">
            <svg
              ref="canvas"
              class="flow-canvas"
              xmlns="http://www.w3.org/2000/svg"
              :viewBox="canvasViewBox"
              :width="zoom === 'fit' ? '100%' : 1600 * zoom"
              :height="zoom === 'fit' ? '100%' : 1000 * zoom"
              preserveAspectRatio="xMidYMid meet"
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
              <rect
                class="canvas-background"
                width="1600"
                height="1000"
                fill="#f8fafc"
                @click="selected = ''"
              />
              <g
                v-for="edge in document.edges"
                :key="edge.id"
                :data-edge="edge.id"
                class="flow-edge"
                :class="{ 'is-selected': selected === edge.id }"
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
                  class="edge-line"
                  :d="edgeGeometry(edge, document.nodes).path"
                  fill="none"
                  :stroke="selected === edge.id ? '#2563eb' : '#64748b'"
                  stroke-width="2.5"
                  marker-end="url(#flow-arrow)"
                />
                <text
                  class="edge-label"
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
                :class="[
                  `flow-node--${node.type}`,
                  { 'is-selected': selected === node.id || connectionStart === node.id },
                ]"
                @pointerdown.stop="beginDrag($event, node)"
                @click.stop="selectNode(node.id)"
                @keydown.enter.prevent="selectNode(node.id)"
              >
                <title>{{ node.label }}</title>
                <polygon
                  v-if="node.type === 'decision'"
                  class="node-shape"
                  points="0,-50 80,0 0,50 -80,0"
                  fill="#fef3c7"
                  :stroke="nodeStroke(node.id)"
                  stroke-width="2"
                />
                <rect
                  v-else
                  class="node-shape"
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
                  class="node-label"
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
        </div>
        <aside id="flow-inspector" class="flow-inspector" :class="{ 'is-open': inspectorOpen }">
          <div class="inspector-heading">
            <h2>{{ selectedNode ? '节点设置' : selectedEdge ? '连线设置' : '使用说明' }}</h2>
            <el-button
              class="inspector-close flow-icon-button app-icon-button"
              data-flow-inspector-close
              :icon="Close"
              aria-label="收起属性面板"
              @click="inspectorOpen = false"
            />
          </div>
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
import { ElMessage, ElMessageBox, ElTooltip } from 'element-plus';
import {
  Check,
  Close,
  Connection,
  Document,
  Download,
  FullScreen,
  Plus,
  RefreshLeft,
  RefreshRight,
  Setting,
  Upload,
} from '@element-plus/icons-vue';
import 'element-plus/es/components/tooltip/style/css';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
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
  canvasScroll = ref<HTMLDivElement | null>(null),
  fileInput = ref<HTMLInputElement | null>(null);
const selected = ref(''),
  inspectorOpen = ref(false),
  connecting = ref(false),
  connectionStart = ref(''),
  zoom = ref<'fit' | number>('fit');
const fitViewBox = ref('0 0 1600 1000');
const canvasViewBox = computed(() => (zoom.value === 'fit' ? fitViewBox.value : '0 0 1600 1000'));
const canvasStageStyle = computed(() =>
  zoom.value === 'fit'
    ? undefined
    : {
        width: `${1600 * zoom.value}px`,
        height: `${1000 * zoom.value}px`,
      },
);
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
  if (zoom.value === 'fit') fitCanvas();
}
function redo() {
  labelEditId = '';
  const next = future.value.pop();
  if (!next) return;
  past.value.push(serialize());
  document.value = JSON.parse(next);
  selected.value = '';
  connectionStart.value = '';
  if (zoom.value === 'fit') fitCanvas();
}
function fitCanvas() {
  const nodes = document.value.nodes;
  if (nodes.length) {
    const left = Math.min(...nodes.map((node) => node.x - 80));
    const right = Math.max(...nodes.map((node) => node.x + 80));
    const top = Math.min(...nodes.map((node) => node.y - (node.type === 'decision' ? 50 : 30)));
    const bottom = Math.max(...nodes.map((node) => node.y + (node.type === 'decision' ? 50 : 30)));
    const width = Math.min(1600, Math.max(320, right - left + 128));
    const height = Math.min(1000, Math.max(240, bottom - top + 128));
    const x = Math.max(0, Math.min(1600 - width, (left + right - width) / 2));
    const y = Math.max(0, Math.min(1000 - height, (top + bottom - height) / 2));
    fitViewBox.value = `${x} ${y} ${width} ${height}`;
  } else fitViewBox.value = '0 0 1600 1000';
  zoom.value = 'fit';
  void nextTick(() => canvasScroll.value?.scrollTo({ left: 0, top: 0 }));
}
function onZoomChange() {
  if (zoom.value === 'fit') fitCanvas();
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
    selected.value = '';
    inspectorOpen.value = false;
    fitCanvas();
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
  inspectorOpen.value = true;
  if (zoom.value === 'fit') fitCanvas();
  void nextTick(() => {
    const scroller = canvasScroll.value,
      matrix = canvas.value?.getScreenCTM();
    if (!scroller || !matrix) return;
    const position = new DOMPoint(node.x, node.y).matrixTransform(matrix),
      bounds = scroller.getBoundingClientRect();
    scroller.scrollBy({
      left: position.x - bounds.left - scroller.clientWidth / 2,
      top: position.y - bounds.top - scroller.clientHeight / 2,
    });
  });
}
function toggleConnection() {
  connecting.value = !connecting.value;
  connectionStart.value = '';
  if (connecting.value) inspectorOpen.value = false;
}
function selectNode(id: string) {
  selected.value = id;
  if (!connecting.value) {
    inspectorOpen.value = true;
    return;
  }
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
  inspectorOpen.value = true;
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
  if (zoom.value === 'fit') fitCanvas();
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
  copy.setAttribute('viewBox', '0 0 1600 1000');
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
    fitCanvas();
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
  --tool-gutter: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: var(--app-height, 100dvh);
  padding: max(var(--tool-gutter), env(safe-area-inset-top))
    max(var(--tool-gutter), env(safe-area-inset-right))
    max(var(--tool-gutter), env(safe-area-inset-bottom))
    max(var(--tool-gutter), env(safe-area-inset-left));
  color: var(--theme-text);
  overflow: hidden;
}
.flow-header {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto auto;
  flex-shrink: 0;
  align-items: center;
  gap: 16px;
}
.flow-heading {
  min-width: 0;
}
.flow-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.5px;
}
.flow-heading p {
  margin: 4px 0 0;
  color: var(--theme-muted);
  font-size: 12px;
}
.flow-header .el-button {
  margin: 0;
}
.flow-icon-button {
  flex-shrink: 0;
  width: var(--app-button-height);
  height: var(--app-button-height);
}
.flow-icon-button :deep(.el-icon) {
  font-size: 16px;
}
.icon-tooltip-target {
  display: inline-flex;
}
.save-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--theme-muted);
  font-size: 12px;
  white-space: nowrap;
}
.save-state::before {
  content: '';
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--el-color-success);
}
.save-state.is-dirty::before {
  background: var(--el-color-warning);
}
.save-state.is-error::before {
  background: var(--el-color-danger);
}
.flow-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--theme-surface);
}
.toolbar-group {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}
.toolbar-group + .toolbar-group {
  padding-left: 12px;
  border-left: 1px solid var(--el-border-color-light);
}
.toolbar-group .el-button {
  margin: 0;
}
.inspector-tools {
  margin-left: auto;
}
.zoom-control {
  margin-right: 2px;
  color: var(--theme-muted);
  font-size: 12px;
  white-space: nowrap;
}
.zoom-select {
  width: 112px;
}
.zoom-select :deep(.el-select__wrapper) {
  min-height: var(--app-button-height);
  border-radius: 8px;
}
.flow-hint {
  flex-shrink: 0;
  margin: 0;
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 20px;
}
.flow-workspace {
  position: relative;
  display: flex;
  flex: 1;
  gap: 12px;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.canvas-scroll {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  scrollbar-width: thin;
  scrollbar-color: var(--el-border-color) transparent;
}
.canvas-stage {
  display: grid;
  place-items: center;
  min-width: 100%;
  min-height: 100%;
  background-color: var(--el-bg-color);
  background-image: radial-gradient(var(--el-border-color-light) 1px, transparent 1px);
  background-size: 20px 20px;
}
.canvas-stage.is-fit {
  width: 100%;
  height: 100%;
}
.flow-canvas {
  display: block;
  max-width: none;
  max-height: none;
  user-select: none;
  touch-action: pan-x pan-y;
}
/* SVG attributes retain a standalone light palette for exported images. */
.canvas-background {
  fill: transparent;
}
.flow-canvas marker path {
  fill: var(--theme-muted);
}
.edge-line {
  stroke: var(--theme-muted);
}
.edge-label {
  fill: var(--theme-muted);
}
.flow-edge {
  outline: none;
  cursor: pointer;
}
.flow-edge.is-selected .edge-line,
.flow-edge:focus-visible .edge-line {
  stroke: var(--ui-accent-text, var(--el-color-primary));
}
.flow-node {
  --flow-node-color: var(--el-color-primary);
  outline: none;
  cursor: grab;
  touch-action: none;
}
.flow-node:active {
  cursor: grabbing;
}
.flow-node--start {
  --flow-node-color: var(--el-color-success);
}
.flow-node--decision {
  --flow-node-color: var(--el-color-warning);
}
.flow-node--end {
  --flow-node-color: var(--el-color-danger);
}
.node-shape {
  fill: color-mix(in srgb, var(--flow-node-color) 12%, var(--el-bg-color));
  stroke: color-mix(in srgb, var(--flow-node-color) 55%, var(--el-border-color));
}
.flow-node.is-selected .node-shape,
.flow-node:focus-visible .node-shape {
  stroke: var(--ui-accent-text, var(--el-color-primary));
  stroke-width: 3px;
}
.node-label {
  fill: var(--theme-text);
}
.flow-inspector {
  display: none;
  flex-direction: column;
  flex-shrink: 0;
  gap: 0;
  width: 270px;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--theme-surface);
  scrollbar-width: none;
}
.flow-inspector::-webkit-scrollbar {
  display: none;
}
.flow-inspector.is-open {
  display: flex;
}
.inspector-heading {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}
.inspector-heading h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.flow-inspector label {
  margin-bottom: 8px;
  font-size: 13px;
}
.flow-inspector p {
  margin: 0 0 12px;
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 1.8;
}
.flow-inspector :deep(.el-textarea__inner) {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
}
.flow-inspector > .el-button {
  align-self: flex-start;
  margin: 16px 0;
}
.flow-count {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
  color: var(--theme-muted);
  font-size: 11px;
}
.flow-message {
  padding: 60px 20px;
  overflow: auto;
  text-align: center;
  color: var(--theme-muted);
}
@media (max-width: 800px), (max-height: 600px) {
  .flow-page {
    --tool-gutter: 10px;
    gap: 8px;
  }
  .flow-header {
    gap: 10px;
  }
  .flow-heading h1 {
    font-size: 20px;
  }
  .flow-heading p {
    display: none;
  }
  .flow-toolbar {
    flex-wrap: nowrap;
    gap: 10px;
    padding: 8px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  .flow-toolbar::-webkit-scrollbar {
    display: none;
  }
  .toolbar-group + .toolbar-group {
    padding-left: 10px;
  }
  .flow-hint {
    font-size: 11px;
    line-height: 18px;
  }
  .flow-inspector {
    position: absolute;
    inset: 0 0 0 auto;
    z-index: 2;
    width: min(290px, 100%);
    padding: 12px;
    background: var(--el-bg-color-overlay);
    box-shadow: -8px 0 24px rgb(0 0 0 / 12%);
  }
}
@media (max-width: 600px) {
  .flow-header {
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 2px 10px;
  }
  .flow-header > .flow-icon-button,
  .save-button {
    grid-row: 1 / 3;
  }
  .save-button {
    grid-column: 3;
  }
  .flow-heading h1 {
    font-size: 18px;
  }
  .save-state {
    grid-column: 2;
    grid-row: 2;
    font-size: 10px;
  }
}
</style>
