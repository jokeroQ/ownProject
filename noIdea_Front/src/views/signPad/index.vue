<template>
  <div class="signature-page">
    <header class="signature-header">
      <PageBackButton @click="goBack" />
      <div>
        <h1>我的签名板</h1>
        <p>用鼠标、手指或触控笔留下签名</p>
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
    <Teleport to="body">
      <div v-if="isPreview" class="signature-preview-overlay" @click.self="closePreview">
        <section
          ref="previewDialog"
          class="signature-preview-dialog"
          data-signature-preview-dialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="signature-preview-title"
          tabindex="-1"
          @keydown="onPreviewKeydown"
        >
          <header class="preview-header">
            <h2 id="signature-preview-title">签名预览</h2>
            <button
              class="preview-close app-icon-button"
              data-signature-preview-close
              type="button"
              aria-label="关闭签名预览"
              @click="closePreview"
            >
              ×
            </button>
          </header>
          <div class="preview-image"><img :src="signatureImg" alt="已保存的签名" /></div>
          <p>点击空白处或按 Esc 关闭预览。</p>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import { useRoute, useRouter } from 'vue-router';
import SignaturePad, { type PointGroup } from 'signature_pad';

defineOptions({ name: 'SignaturePage' });

const router = useRouter();
const route = useRoute();
const workspace = ref<HTMLElement | null>(null);
const signatureControls = ref<HTMLElement | null>(null);
const signatureCanvas = ref<HTMLCanvasElement | null>(null);
const previewDialog = ref<HTMLElement | null>(null);
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
async function previewSignature() {
  isPreview.value = true;
  await nextTick();
  previewDialog.value?.focus();
}
function closePreview() {
  isPreview.value = false;
  void nextTick(() => previewButton.value?.focus());
}
function onPreviewKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePreview();
  } else if (event.key === 'Tab') {
    // The dialog has one interactive control; keep keyboard focus inside while open.
    event.preventDefault();
    previewDialog.value?.querySelector<HTMLButtonElement>('button')?.focus();
  }
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
.signature-page {
  --signature-gutter-x: 24px;
  --signature-gutter-y: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1280px;
  height: var(--app-height, 100dvh);
  min-width: 0;
  min-height: 0;
  margin: 0 auto;
  padding: max(var(--signature-gutter-y), env(safe-area-inset-top))
    max(var(--signature-gutter-x), env(safe-area-inset-right))
    max(var(--signature-gutter-y), env(safe-area-inset-bottom))
    max(var(--signature-gutter-x), env(safe-area-inset-left));
  overflow: hidden;
  color: var(--theme-text);
}
.signature-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 14px;
}
.signature-header h1 {
  margin: 0;
  font-size: 22px;
}
.signature-header p {
  margin: 5px 0 0;
  color: var(--theme-muted);
  font-size: 12px;
}
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
  padding: 0 9px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text);
  font: inherit;
  font-size: 12px;
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
.signature-preview-overlay {
  --preview-gutter: 16px;
  position: fixed;
  inset: 0;
  bottom: auto;
  height: var(--app-height, 100dvh);
  z-index: 2500;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(var(--preview-gutter), env(safe-area-inset-top))
    max(var(--preview-gutter), env(safe-area-inset-right))
    max(var(--preview-gutter), env(safe-area-inset-bottom))
    max(var(--preview-gutter), env(safe-area-inset-left));
  background: rgb(0 0 0 / 55%);
}
.signature-preview-dialog {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: min(760px, 100%);
  max-height: 100%;
  overflow: auto;
  padding: 18px;
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  background: var(--el-bg-color);
  color: var(--theme-text);
  outline: none;
}
.preview-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.preview-header h2 {
  margin: 0;
  font-size: 17px;
}
.preview-close {
  width: var(--app-button-height);
  height: var(--app-button-height);
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text);
  font-size: 24px;
  cursor: pointer;
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
.signature-preview-dialog > p {
  flex-shrink: 0;
  margin: 12px 0 0;
  color: var(--theme-muted);
  font-size: 11px;
}
@media (max-width: 600px), (max-height: 600px) {
  .signature-page {
    --signature-gutter-x: 12px;
    --signature-gutter-y: 12px;
    gap: 12px;
  }
  .signature-header {
    gap: 12px;
  }
  .signature-header h1 {
    font-size: 20px;
  }
  .signature-header p {
    display: none;
  }
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
    font-size: 11px;
  }
}
@media (max-height: 450px) {
  .signature-page {
    --signature-gutter-y: 8px;
    gap: 8px;
  }
  .signature-header h1 {
    font-size: 18px;
  }
  .signature-sheet {
    gap: 10px;
  }
  .signature-controls {
    gap: 6px;
  }
  .signature-hint,
  .signature-status {
    font-size: 10px;
  }
  .signature-preview-overlay {
    --preview-gutter: 10px;
  }
  .signature-preview-dialog {
    padding: 12px;
  }
}
</style>
