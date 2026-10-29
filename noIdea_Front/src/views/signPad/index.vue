<template>
  <div class="signature-page app-page app-page--workspace">
    <div class="app-page__content app-page__content--workspace">
      <header class="signature-header app-page__header">
        <PageBackButton @click="goBack" />
        <div class="app-page__heading">
          <h1 class="app-page__title">我的签名板</h1>
          <p class="app-page__description">用鼠标、手指或触控笔留下签名</p>
        </div>
      </header>
      <main ref="workspace" class="signature-workspace">
        <div class="signature-sheet">
          <canvas
            ref="signatureCanvas"
            class="signature-canvas"
            :style="canvasStyle"
            data-signature-canvas
            aria-label="签名画布，可使用鼠标、手指或触控笔书写"
          ></canvas>
          <footer ref="signatureControls" class="signature-controls">
            <p class="signature-hint">在画布内书写，调整窗口或旋转屏幕会保留笔迹。</p>
            <div class="signature-actions">
              <el-button data-signature-clear @click="goClear">清空</el-button>
              <el-button type="primary" data-signature-save @click="goSave">保存签名</el-button>
              <button
                v-if="signatureImg"
                ref="previewButton"
                class="signature-thumbnail"
                data-signature-preview
                type="button"
                aria-label="查看签名预览"
                @click="previewSignature"
              >
                <img :src="signatureImg" alt="已保存的签名缩略图" /><span>查看预览</span>
              </button>
            </div>
            <p class="signature-status" role="status">{{ status }}</p>
          </footer>
        </div>
      </main>
      <el-dialog
        v-model="isPreview"
        class="signature-preview-dialog app-dialog--custom-header"
        data-signature-preview-dialog
        title="签名预览"
        width="760"
        :show-close="false"
        append-to-body
        @closed="closePreview"
      >
        <template #header="{ titleId }">
          <header class="preview-header app-dialog-header">
            <h2 :id="titleId" class="app-dialog-title">签名预览</h2>
            <el-tooltip content="关闭签名预览" :trigger-keys="[]"
              ><el-button
                class="preview-close app-icon-button"
                data-signature-preview-close
                :icon="Close"
                aria-label="关闭签名预览"
                @click="closePreview"
            /></el-tooltip>
          </header>
        </template>
        <div class="preview-image"><img :src="signatureImg" alt="已保存的签名" /></div>
        <p class="signature-preview-note">点击空白处或按 Esc 关闭预览。</p>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import { Close } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import SignaturePad, { type PointGroup } from 'signature_pad';

defineOptions({ name: 'SignaturePage' });

const router = useRouter();
const route = useRoute();
const workspace = ref<HTMLElement | null>(null);
const signatureControls = ref<HTMLElement | null>(null);
const signatureCanvas = ref<HTMLCanvasElement | null>(null);
const previewButton = ref<HTMLButtonElement | null>(null);
const signatureImg = ref('');
const isPreview = ref(false);
const status = ref('签名仅保留在当前页面');
const canvasSize = ref({ width: 0, height: 0 });
const canvasStyle = computed(() => ({
  width: `${canvasSize.value.width}px`,
  height: `${canvasSize.value.height}px`,
}));
let signaturePad: SignaturePad | null = null;
let observer: ResizeObserver | null = null;
let resizeFrame = 0;
let pixelRatioQuery: MediaQueryList | null = null;
let disposed = false;

function scaleSignature(groups: PointGroup[], scale: number): PointGroup[] {
  return groups.map((group) => ({
    ...group,
    minWidth: group.minWidth * scale,
    maxWidth: group.maxWidth * scale,
    dotSize: group.dotSize * scale,
    points: group.points.map((point) => ({ ...point, x: point.x * scale, y: point.y * scale })),
  }));
}
function resizeCanvas() {
  resizeFrame = 0;
  const canvas = signatureCanvas.value;
  const area = workspace.value;
  if (!canvas || !area || disposed) return;
  // A consistent aspect ratio preserves the shape and size after repeated rotations.
  const gap = parseFloat(getComputedStyle(canvas.parentElement!).rowGap) || 0;
  const availableHeight = Math.max(
    0,
    area.clientHeight - (signatureControls.value?.offsetHeight || 0) - gap,
  );
  const width = Math.min(area.clientWidth, availableHeight * 1.5, 1100);
  const height = width / 1.5;
  if (width < 1 || height < 1) return;
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (
    Math.abs(canvasSize.value.width - width) < 0.1 &&
    canvas.width === pixelWidth &&
    canvas.height === pixelHeight
  )
    return;
  const data = signaturePad?.toData() || [];
  const scale = canvasSize.value.width ? width / canvasSize.value.width : 1;
  signaturePad?.off();
  canvasSize.value = { width, height };
  // Backing pixels follow DPR, while SignaturePad points remain in CSS coordinates.
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.getContext('2d')?.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  signaturePad = new SignaturePad(canvas, {
    backgroundColor: '#ffffff',
    penColor: '#172033',
    minWidth: 1,
    maxWidth: 2.5,
  });
  if (data.length) signaturePad.fromData(scaleSignature(data, scale));
}
function scheduleResize() {
  if (!resizeFrame && !disposed) resizeFrame = requestAnimationFrame(resizeCanvas);
}
function watchPixelRatio() {
  pixelRatioQuery?.removeEventListener('change', onPixelRatioChange);
  pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  pixelRatioQuery.addEventListener('change', onPixelRatioChange);
}
function onPixelRatioChange() {
  watchPixelRatio();
  scheduleResize();
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
function goClear() {
  signaturePad?.clear();
  signatureImg.value = '';
  status.value = '画布已清空';
}
function goSave() {
  if (!signaturePad || signaturePad.isEmpty()) {
    status.value = '请先在画布内签名';
    return;
  }
  signatureImg.value = signaturePad.toDataURL();
  status.value = '签名预览已生成，点击缩略图查看';
}
function previewSignature() {
  isPreview.value = true;
}
function closePreview() {
  isPreview.value = false;
  void nextTick(() => previewButton.value?.focus());
}
onMounted(() => {
  observer = new ResizeObserver(scheduleResize);
  if (workspace.value) observer.observe(workspace.value);
  if (signatureControls.value) observer.observe(signatureControls.value);
  window.addEventListener('resize', scheduleResize);
  watchPixelRatio();
  resizeCanvas();
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  cancelAnimationFrame(resizeFrame);
  window.removeEventListener('resize', scheduleResize);
  pixelRatioQuery?.removeEventListener('change', onPixelRatioChange);
  signaturePad?.off();
  signaturePad = null;
});
</script>

<style scoped>
.signature-workspace {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}
.signature-sheet {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.signature-canvas {
  display: block;
  flex-shrink: 0;
  max-width: none;
  max-height: none;
  border-radius: 12px;
  background: #fff;
  box-shadow:
    0 0 0 1px var(--el-border-color),
    0 5px 24px rgb(0 0 0 / 4%);
  cursor: crosshair;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.signature-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
  width: min(100%, 720px);
  text-align: center;
}
.signature-hint,
.signature-status {
  max-width: 100%;
  margin: 0;
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.signature-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 100%;
}
.signature-actions .el-button {
  margin: 0;
}
.signature-thumbnail {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--app-button-height, 32px);
  padding: 0 var(--app-button-padding);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text);
  font: inherit;
  font-size: var(--app-font-control-size);
  cursor: pointer;
}
.signature-thumbnail:hover {
  border-color: var(--el-color-primary);
  color: var(--ui-accent-text);
}
.signature-thumbnail:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.signature-thumbnail img {
  width: 36px;
  height: 24px;
  object-fit: contain;
  border-radius: 3px;
  background: #fff;
}
.preview-image {
  min-height: 0;
  overflow: auto;
  border-radius: 8px;
  background: #fff;
}
.preview-image img {
  display: block;
  width: 100%;
  height: auto;
  max-height: calc(var(--app-height, 100dvh) - 160px);
  object-fit: contain;
}
.signature-preview-note {
  flex-shrink: 0;
  margin: 12px 0 0;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
@media (max-width: 600px), (max-height: 600px) {
  .signature-sheet {
    gap: 12px;
  }
  .signature-canvas {
    border-radius: 10px;
  }
  .signature-controls {
    gap: 8px;
  }
  .signature-hint,
  .signature-status {
    font-size: var(--app-font-caption-size);
  }
}
@media (max-height: 450px) {
  .signature-sheet {
    gap: 10px;
  }
  .signature-controls {
    gap: 6px;
  }
  .signature-hint,
  .signature-status {
    font-size: var(--app-font-caption-size);
  }
}
</style>
