<template>
  <div class="dinner-page app-page app-page--workspace">
    <div class="app-page__content app-page__content--workspace">
      <header class="dinner-header app-page__header">
        <PageBackButton @click="goBack" />
        <div class="app-page__heading">
          <h1 class="app-page__title">今晚吃什么</h1>
          <p class="app-page__description">把纠结交给转盘，把好心情留给晚餐。</p>
        </div>
        <el-button :icon="Edit" :disabled="loading || spinning || !!error" @click="openEditor"
          >编辑选项</el-button
        >
      </header>
      <el-alert v-if="error" :title="error" type="error" :closable="false"
        ><el-button text @click="load">重新加载</el-button></el-alert
      >
      <main class="dinner-layout" v-loading="loading">
        <section class="wheel-stage" aria-label="晚餐转盘">
          <span class="eyebrow">DINNER TIME</span>
          <div class="wheel-frame">
            <span class="wheel-pointer" aria-hidden="true"></span>
            <svg
              viewBox="0 0 400 400"
              class="dinner-wheel"
              :class="{ spinning, 'many-options': options.length > 12 }"
              :style="{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }"
              aria-hidden="true"
            >
              <g v-for="(option, index) in options" :key="index">
                <path
                  :d="sector(index)"
                  :fill="colors[index % colors.length]"
                  stroke="var(--el-bg-color)"
                  stroke-width="2"
                />
                <text
                  :x="labelPoint(index).x"
                  :y="labelPoint(index).y"
                  :transform="`rotate(${labelAngle(index)}, ${labelPoint(index).x}, ${labelPoint(index).y})`"
                  text-anchor="middle"
                  dominant-baseline="central"
                  :font-size="options.length > 12 ? 11 : 13"
                >
                  {{ Array.from(option).slice(0, 7).join('')
                  }}{{ Array.from(option).length > 7 ? '…' : '' }}
                </text>
              </g>
            </svg>
            <button
              class="spin-button"
              data-dinner-spin
              :disabled="loading || spinning || !!error"
              @click="spin"
            >
              {{ spinning ? '转动中' : '开转'
              }}<span>{{ spinning ? '美味在路上' : '让美味决定' }}</span>
            </button>
          </div>
          <p class="wheel-caption">每个选项机会相同 · {{ options.length }} 种晚餐灵感</p>
        </section>
        <aside class="dinner-details">
          <div class="dinner-result" role="status" aria-live="polite">
            <span>{{
              spinning ? '正在挑选晚餐…' : result ? '今晚就吃' : '今天的晚餐，等你揭晓'
            }}</span>
            <h2>{{ spinning ? '好吃的马上到' : result || '吃点开心的' }}</h2>
            <p>
              {{
                result && !spinning
                  ? '答案已经有了，出发去享用吧。'
                  : '点击转盘中央，看看今天和哪道美味有缘。'
              }}
            </p>
          </div>
          <div class="options-heading">
            <h2>候选菜单</h2>
            <span>{{ options.length }} 项</span>
          </div>
          <ul class="dinner-options" aria-label="候选菜单" tabindex="0">
            <li
              v-for="(option, index) in options"
              :key="index"
              :class="{ chosen: result === option && !spinning }"
            >
              <i :style="{ background: colors[index % colors.length] }"></i>{{ option
              }}<span v-if="result === option && !spinning">今晚推荐</span>
            </li>
          </ul>
          <p class="save-note">选项保存到当前账号，换台设备也能继续使用。</p>
        </aside>
      </main>
      <el-dialog
        v-model="editing"
        title="编辑晚餐选项"
        width="460"
        :close-on-click-modal="!saving"
        :show-close="!saving"
        :close-on-press-escape="!saving"
      >
        <p class="editor-hint">设置 2–16 项，每项最多 12 个字，名称不能重复。</p>
        <div class="option-editor app-form">
          <div
            v-for="(_, index) in draft"
            :key="index"
            class="option-row app-form-row app-form-row--action"
          >
            <label :for="`dinner-option-${index}`">选项 {{ index + 1 }}</label
            ><el-input
              :id="`dinner-option-${index}`"
              v-model="draft[index]"
              maxlength="12"
              :disabled="saving"
              :aria-label="`选项 ${index + 1}`"
            /><el-button
              class="app-icon-button"
              :icon="Delete"
              :aria-label="`删除选项 ${index + 1}`"
              title="删除选项"
              :disabled="draft.length <= 2 || saving"
              @click="draft.splice(index, 1)"
            />
          </div>
        </div>
        <div class="editor-actions">
          <el-button :icon="Plus" :disabled="draft.length >= 16 || saving" @click="draft.push('')"
            >添加选项</el-button
          ><el-button text :disabled="saving" @click="draft = [...defaults]">恢复默认</el-button>
        </div>
        <template #footer
          ><el-button :disabled="saving" @click="editing = false">取消</el-button
          ><el-button type="primary" :loading="saving" @click="save">保存选项</el-button></template
        >
      </el-dialog>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Edit, Delete, Plus } from '@element-plus/icons-vue';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import apiClient from '@/api/apiClient';
import { getErrorMessage } from '@/utils/errors';
import { ElMessage } from 'element-plus';
defineOptions({ name: 'DinnerWheelPage' });
const router = useRouter(),
  route = useRoute();
const defaults = ['火锅', '牛肉面', '饺子', '炒饭', '麻辣烫', '烤肉', '轻食沙拉', '家常菜'];
const colors = [
  '#eabf92',
  '#a6c6ae',
  '#b4c9df',
  '#d1b8d8',
  '#e4b3ad',
  '#dfcc93',
  '#9dcac7',
  '#bcc2e3',
];
const options = ref([...defaults]),
  draft = ref<string[]>([]),
  result = ref('');
const loading = ref(true),
  saving = ref(false),
  editing = ref(false),
  spinning = ref(false),
  error = ref('');
const rotation = ref(0),
  duration = ref(4500);
let timer = 0;
const point = (angle: number, radius: number) => ({
  x: 200 + Math.sin((angle * Math.PI) / 180) * radius,
  y: 200 - Math.cos((angle * Math.PI) / 180) * radius,
});
function sector(index: number) {
  const step = 360 / options.value.length,
    a = point(index * step, 194),
    b = point((index + 1) * step, 194);
  return `M200 200 L${a.x} ${a.y} A194 194 0 ${step > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
}
const labelPoint = (index: number) => point(((index + 0.5) * 360) / options.value.length, 137);
const labelAngle = (index: number) => {
  const angle = ((index + 0.5) * 360) / options.value.length;
  return angle > 180 ? angle - 270 : angle - 90;
};
async function load() {
  loading.value = true;
  error.value = '';
  try {
    options.value = (await apiClient.get('/dinner')).data.data.options;
  } catch (e) {
    error.value = getErrorMessage(e, '菜单加载失败，请重试');
  } finally {
    loading.value = false;
  }
}
function openEditor() {
  draft.value = [...options.value];
  editing.value = true;
}
async function save() {
  const values = draft.value.map((value) => value.trim());
  if (
    values.length < 2 ||
    values.length > 16 ||
    values.some((value) => !value || Array.from(value).length > 12) ||
    new Set(values).size !== values.length
  ) {
    ElMessage.warning('请设置2–16个不同选项，每项1–12个字');
    return;
  }
  saving.value = true;
  try {
    options.value = (await apiClient.put('/dinner', { options: values })).data.data.options;
    result.value = '';
    rotation.value = 0;
    editing.value = false;
    ElMessage.success('晚餐选项已保存');
  } catch (e) {
    ElMessage.error(getErrorMessage(e, '保存失败，请重试'));
  } finally {
    saving.value = false;
  }
}
function spin() {
  if (spinning.value || loading.value || error.value) return;
  const random = new Uint32Array(1),
    limit = Math.floor(0x100000000 / options.value.length) * options.value.length;
  do {
    crypto.getRandomValues(random);
  } while (random[0] >= limit);
  const index = random[0] % options.value.length;
  spinning.value = true;
  result.value = '';
  duration.value = matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 4500;
  rotation.value =
    Math.ceil(rotation.value / 360) * 360 +
    360 * 6 +
    360 -
    ((index + 0.5) * 360) / options.value.length;
  timer = window.setTimeout(() => {
    result.value = options.value[index];
    spinning.value = false;
  }, duration.value + 80);
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));
</script>
<style scoped>
h1,
h2,
p {
  margin: 0;
}
.dinner-page > .el-alert {
  flex-shrink: 0;
}
.dinner-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(240px, 1fr);
  grid-template-rows: minmax(0, 1fr);
  flex: 1;
  min-width: 0;
  min-height: 0;
  gap: var(--app-space-6);
}
.wheel-stage {
  --wheel-chrome: 70px;
  container-type: size;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  gap: 14px;
  padding: 12px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.eyebrow {
  font-size: var(--app-font-caption-size);
  line-height: 16px;
  letter-spacing: 3px;
  color: var(--theme-muted);
}
.wheel-frame {
  position: relative;
  flex-shrink: 0;
  width: min(100%, max(0px, calc(100cqh - var(--wheel-chrome))), 500px);
  aspect-ratio: 1;
}
.dinner-wheel {
  display: block;
  width: 100%;
  height: 100%;
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.15, 0.7, 0.12, 1);
  filter: drop-shadow(0 8px 16px #00000012);
}
.dinner-wheel text {
  fill: #24313d;
  font-weight: 600;
  pointer-events: none;
}
.wheel-pointer {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: -7px;
  width: 20px;
  height: 32px;
  transform: translateX(-50%);
  background: var(--el-color-primary);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.spin-button {
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(52px, 22%, 88px);
  aspect-ratio: 1;
  padding: 0;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 4px solid var(--el-bg-color);
  background: var(--el-bg-color);
  box-shadow: 0 2px 16px #0002;
  color: var(--theme-text);
  cursor: pointer;
  font-size: clamp(14px, 4cqw, 20px);
  font-weight: 700;
  line-height: 1.2;
}
.spin-button span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  font-weight: 400;
  color: var(--theme-muted);
}
.spin-button:disabled {
  cursor: default;
}
.spin-button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 4px;
}
.wheel-caption {
  font-size: 12px;
  line-height: 18px;
  color: var(--theme-muted);
  text-align: center;
}
.dinner-details {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-self: center;
  width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  gap: 14px;
  padding: 8px 0;
}
.dinner-result {
  flex-shrink: 0;
}
.dinner-result > span {
  font-size: 12px;
  color: var(--theme-muted);
}
.dinner-result h2 {
  margin: 8px 0;
  font-size: 27px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.dinner-result p {
  font-size: 12px;
  line-height: 1.8;
  color: var(--theme-muted);
}
.options-heading {
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.options-heading h2 {
  font-size: 14px;
}
.options-heading span,
.save-note {
  font-size: 12px;
  color: var(--theme-muted);
}
.dinner-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(30px, max-content);
  align-content: start;
  flex: 0 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0 4px;
  gap: 6px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  list-style: none;
}
.dinner-options::-webkit-scrollbar {
  display: none;
}
.dinner-options:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
  border-radius: 6px;
}
.dinner-options li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  padding: 6px 0;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.dinner-options i {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dinner-options .chosen {
  color: var(--ui-accent-text);
  font-weight: 600;
}
.dinner-options li span {
  margin-left: auto;
  color: var(--ui-accent-text);
  font-size: var(--app-font-caption-size);
  font-weight: 400;
}
.save-note {
  flex-shrink: 0;
  line-height: 1.8;
}
.editor-hint {
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--theme-muted);
}
.option-row .el-input {
  min-width: 0;
}
.editor-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
}
@media (max-width: 760px) {
  .spin-button span {
    display: none;
  }
  .dinner-layout {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 18px;
  }
  .dinner-result h2 {
    font-size: 23px;
  }
}
@media (max-width: 760px) and (orientation: portrait) {
  .dinner-wheel text {
    font-size: 18px;
  }
  .dinner-wheel.many-options text {
    font-size: 15px;
  }
  .dinner-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 10px;
  }
  .wheel-stage {
    --wheel-chrome: 34px;
    gap: 10px;
    padding: 8px;
  }
  .eyebrow {
    display: none;
  }
  .dinner-details {
    align-self: stretch;
    gap: 10px;
    padding: 0;
  }
  .dinner-result h2 {
    margin: 4px 0;
    font-size: 22px;
  }
  .dinner-result p {
    font-size: var(--app-font-caption-size);
  }
  .dinner-options {
    flex: 1;
    gap: 4px 12px;
  }
  .dinner-options li {
    font-size: 12px;
  }
  .save-note {
    font-size: var(--app-font-caption-size);
  }
}
@media (max-width: 360px) {
  .dinner-details {
    gap: 8px;
  }
  .dinner-result p {
    display: none;
  }
  .save-note {
    font-size: var(--app-font-caption-size);
  }
}
@media (max-height: 500px) {
  .spin-button span {
    display: none;
  }
  .dinner-wheel text {
    font-size: 16px;
  }
  .dinner-wheel.many-options text {
    font-size: 13px;
  }
  .dinner-header p,
  .eyebrow,
  .save-note {
    display: none;
  }
  .wheel-stage {
    --wheel-chrome: 34px;
    gap: 10px;
    padding: 8px;
  }
  .dinner-details {
    gap: 10px;
  }
  .dinner-result h2 {
    margin: 4px 0;
    font-size: 22px;
  }
  .dinner-result p {
    display: none;
  }
}
</style>
