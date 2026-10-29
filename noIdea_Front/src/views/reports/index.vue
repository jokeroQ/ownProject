<template>
  <div class="report-page app-page" tabindex="0" aria-label="工作日报页面">
    <div class="app-page__content">
      <header class="app-page__header report-header">
        <PageBackButton @click="goBack" />
        <div class="app-page__heading">
          <h1 class="app-page__title">工作日报</h1>
          <p class="app-page__description">记下每天的进展，也为每一周留一份总结。</p>
        </div>
        <div class="app-toolbar__actions report-header-actions">
          <el-tooltip content="刷新报告" :trigger-keys="[]"
            ><el-button
              class="app-icon-button"
              :icon="Refresh"
              aria-label="刷新报告"
              :disabled="loading"
              @click="load"
          /></el-tooltip>
          <el-button :icon="Download" @click="openExport">导出报告</el-button>
          <el-button type="primary" :icon="Plus" @click="openEditor()">{{
            query.type === 'weekly' ? '写周报' : '写日报'
          }}</el-button>
        </div>
      </header>

      <section class="app-panel" aria-label="我的工作报告">
        <div class="app-toolbar app-panel__toolbar report-toolbar">
          <nav class="app-tabs" aria-label="报告类型筛选">
            <button
              v-for="tab in typeTabs"
              :key="tab.value"
              type="button"
              :aria-pressed="query.type === tab.value"
              @click="chooseType(tab.value)"
            >
              {{ tab.label }}
            </button>
          </nav>
          <form class="app-search report-search" @submit.prevent="applyFilters">
            <el-input
              v-model="searchText"
              :prefix-icon="Search"
              placeholder="搜索报告内容"
              aria-label="搜索报告内容"
              maxlength="120"
              clearable
              @clear="applyFilters"
            />
            <el-tooltip content="搜索" :trigger-keys="[]"
              ><el-button
                class="app-icon-button"
                :icon="Search"
                native-type="submit"
                aria-label="搜索报告"
            /></el-tooltip>
          </form>
          <div class="report-date-filters">
            <div class="report-date-field">
              <label for="report-filter-from">开始日期</label>
              <div class="report-date-control">
                <el-date-picker
                  id="report-filter-from"
                  v-model="query.from"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="不限"
                  aria-label="筛选开始日期"
                  :disabled-date="outOfRange"
                  popper-class="app-date-popper"
                  :popper-options="datePickerPopperOptions"
                  @change="applyFilters"
                />
              </div>
            </div>
            <div class="report-date-field">
              <label for="report-filter-to">结束日期</label>
              <div class="report-date-control">
                <el-date-picker
                  id="report-filter-to"
                  v-model="query.to"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="不限"
                  aria-label="筛选结束日期"
                  :disabled-date="outOfRange"
                  popper-class="app-date-popper"
                  :popper-options="datePickerPopperOptions"
                  @change="applyFilters"
                />
              </div>
            </div>
            <el-button
              text
              :disabled="!query.from && !query.to && !searchText"
              @click="resetFilters"
              >重置</el-button
            >
          </div>
        </div>
        <p v-if="error" class="report-error" role="alert">
          {{ error }}<el-button text @click="load">重试</el-button>
        </p>
        <div class="report-results" :aria-busy="loading">
          <div v-if="loading && !data" class="app-loading-state" role="status">
            <el-icon class="is-loading"><Loading /></el-icon>正在读取报告…
          </div>
          <ul
            v-else-if="data?.items.length"
            class="report-list"
            aria-label="报告列表"
            :class="{ updating: loading }"
          >
            <li
              v-for="item in data.items"
              :key="item.id"
              class="report-item"
              :data-report-id="item.id"
            >
              <div class="report-item-header">
                <span class="report-type">{{ item.type === 'daily' ? '日报' : '周报' }}</span>
                <h2>
                  {{ item.startDate
                  }}<span v-if="item.type === 'weekly'"> — {{ item.endDate }}</span>
                </h2>
                <div class="report-item-actions">
                  <el-tooltip content="查看与编辑" :trigger-keys="[]"
                    ><el-button
                      class="app-icon-button"
                      :icon="Edit"
                      :aria-label="`编辑${reportName(item)}`"
                      :disabled="busy.has(item.id)"
                      @click="openEditor(item)"
                  /></el-tooltip>
                  <el-tooltip content="删除" :trigger-keys="[]"
                    ><el-button
                      class="app-icon-button report-delete"
                      :icon="Delete"
                      :aria-label="`删除${reportName(item)}`"
                      :disabled="busy.has(item.id)"
                      @click="remove(item)"
                  /></el-tooltip>
                </div>
              </div>
              <p class="report-summary">{{ item.accomplishments }}</p>
              <div v-if="item.plans || item.blockers" class="report-extras">
                <span v-if="item.plans"
                  ><el-icon><Calendar /></el-icon>有后续计划</span
                ><span v-if="item.blockers"
                  ><el-icon><ChatLineSquare /></el-icon>有问题备注</span
                >
              </div>
              <button class="report-read" type="button" @click="openEditor(item)">
                查看完整内容 <el-icon><ArrowRight /></el-icon>
              </button>
            </li>
          </ul>
          <div v-else-if="!loading && !error" class="app-empty">
            <el-icon class="app-empty__icon"><Document /></el-icon>
            <h2 class="app-empty__title">
              {{ hasFilters ? '没有找到匹配的报告' : '从今天的第一份记录开始' }}
            </h2>
            <p class="app-empty__description">
              {{
                hasFilters
                  ? '调整日期或关键词，再看看其他记录。'
                  : '点击上方写日报，也可以切换到周报总结这一周。'
              }}
            </p>
          </div>
        </div>
        <footer v-if="data?.total" class="report-footer">
          <span
            >共 {{ data.total }} 篇<span v-if="data.total > data.pageSize">
              · 第 {{ query.page }} / {{ Math.ceil(data.total / data.pageSize) }} 页</span
            ></span
          >
          <div class="app-toolbar__actions">
            <el-tooltip content="上一页" :trigger-keys="[]"
              ><el-button
                class="app-icon-button"
                :icon="ArrowLeft"
                aria-label="报告上一页"
                :disabled="loading || query.page <= 1"
                @click="turnPage(-1)"
            /></el-tooltip>
            <el-tooltip content="下一页" :trigger-keys="[]"
              ><el-button
                class="app-icon-button"
                :icon="ArrowRight"
                aria-label="报告下一页"
                :disabled="loading || !data.hasMore"
                @click="turnPage(1)"
            /></el-tooltip>
          </div>
        </footer>
      </section>
      <p class="report-note">
        <el-icon><Lock /></el-icon
        >仅自己可见。同一天保留一份日报，同一周保留一份周报，可随时编辑补充。
      </p>
    </div>

    <el-dialog
      v-model="editorVisible"
      :title="editing ? '编辑报告' : '新建报告'"
      width="620"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      :before-close="closeEditor"
    >
      <form class="app-form" @submit.prevent="save">
        <div class="app-form-row">
          <label for="report-type">报告类型</label
          ><el-select id="report-type" v-model="draft.type" aria-label="报告类型" :disabled="saving"
            ><el-option label="日报" value="daily" /><el-option label="周报" value="weekly"
          /></el-select>
        </div>
        <div class="app-form-row">
          <label for="report-date">{{ draft.type === 'daily' ? '报告日期' : '所属周' }}</label
          ><el-date-picker
            id="report-date"
            v-model="draft.date"
            type="date"
            value-format="YYYY-MM-DD"
            aria-label="报告日期"
            :disabled-date="outOfRange"
            :disabled="saving"
            :clearable="false"
            popper-class="app-date-popper"
            :popper-options="datePickerPopperOptions"
          />
        </div>
        <p class="report-form-hint">
          {{
            draft.type === 'weekly'
              ? `本周范围：${draftPeriod}（周一至周日）`
              : '可补写过去的日报，修改后点击保存生效。'
          }}
        </p>
        <div class="app-form-row">
          <label for="report-work">完成工作</label
          ><el-input
            id="report-work"
            v-model="draft.accomplishments"
            type="textarea"
            :rows="5"
            resize="vertical"
            aria-label="完成工作"
            placeholder="记录完成的工作、取得的进展…"
            maxlength="10000"
            :disabled="saving"
          />
        </div>
        <div class="app-form-row">
          <label for="report-plans">后续计划</label
          ><el-input
            id="report-plans"
            v-model="draft.plans"
            type="textarea"
            :rows="3"
            resize="vertical"
            aria-label="后续计划"
            placeholder="接下来准备做什么（选填）"
            maxlength="10000"
            :disabled="saving"
          />
        </div>
        <div class="app-form-row">
          <label for="report-blockers">问题备注</label
          ><el-input
            id="report-blockers"
            v-model="draft.blockers"
            type="textarea"
            :rows="3"
            resize="vertical"
            aria-label="问题备注"
            placeholder="遇到的阻碍、需要协助的事（选填）"
            maxlength="10000"
            :disabled="saving"
          />
        </div>
      </form>
      <template #footer
        ><el-button :disabled="saving" @click="closeEditor()">取消</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="!draft.date || !draft.accomplishments.trim()"
          @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="exportVisible"
      title="导出工作报告"
      width="500"
      :close-on-click-modal="!exporting"
      :show-close="!exporting"
      :close-on-press-escape="!exporting"
    >
      <form class="app-form" @submit.prevent="download">
        <div class="app-form-row">
          <label for="report-export-format">文件格式</label>
          <el-select
            id="report-export-format"
            v-model="exportQuery.format"
            aria-label="导出文件格式"
            :disabled="exporting"
          >
            <el-option
              v-for="option in exportFormats"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
        <div class="app-form-row">
          <label for="report-export-type">报告类型</label
          ><el-select
            id="report-export-type"
            v-model="exportQuery.type"
            aria-label="导出报告类型"
            :disabled="exporting"
            ><el-option
              v-for="tab in typeTabs"
              :key="tab.value"
              :label="tab.label"
              :value="tab.value"
          /></el-select>
        </div>
        <div class="app-form-row">
          <label for="report-export-from">开始日期</label
          ><el-date-picker
            id="report-export-from"
            v-model="exportQuery.from"
            type="date"
            value-format="YYYY-MM-DD"
            aria-label="导出开始日期"
            :disabled="exporting"
            :disabled-date="outOfRange"
            :clearable="false"
            popper-class="app-date-popper"
            :popper-options="datePickerPopperOptions"
          />
        </div>
        <div class="app-form-row">
          <label for="report-export-to">结束日期</label
          ><el-date-picker
            id="report-export-to"
            v-model="exportQuery.to"
            type="date"
            value-format="YYYY-MM-DD"
            aria-label="导出结束日期"
            :disabled="exporting"
            :disabled-date="outOfRange"
            :clearable="false"
            popper-class="app-date-popper"
            :popper-options="datePickerPopperOptions"
          />
        </div>
        <p class="report-form-hint">
          导出该范围内全部报告，包含首尾日期。周报按时间交集纳入；保留当前搜索关键词{{
            exportQuery.keyword ? `“${exportQuery.keyword}”` : '（无）'
          }}。
        </p>
        <p class="report-form-hint">
          {{ exportFormatHint }}
        </p>
      </form>
      <template #footer
        ><el-button :disabled="exporting" @click="exportVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="exporting"
          :disabled="!exportQuery.from || !exportQuery.to"
          @click="download"
          >导出</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChatLineSquare,
  Delete,
  Document,
  Download,
  Edit,
  Loading,
  Lock,
  Plus,
  Refresh,
  Search,
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import {
  createReport,
  deleteReport,
  exportReports,
  getReports,
  updateReport,
  type ReportInput,
  type ReportPage,
  type ReportQuery,
  type ReportExportFormat,
  type WorkReport,
} from '@/api/reports';
import { getErrorMessage } from '@/utils/errors';
import { datePickerPopperOptions } from '@/utils/ui';

defineOptions({ name: 'WorkReportsPage' });
const route = useRoute(),
  router = useRouter();
const typeTabs: { value: ReportQuery['type']; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'daily', label: '日报' },
  { value: 'weekly', label: '周报' },
];
const exportFormats: { value: ReportExportFormat; label: string; hint: string }[] = [
  {
    value: 'xlsx',
    label: 'Excel（.xlsx）',
    hint: '按列整理全部报告，可使用 Excel / WPS 编辑和筛选。',
  },
  {
    value: 'docx',
    label: 'Word（.docx）',
    hint: '按篇整理为可编辑文档，包含完成工作、后续计划及问题备注。单次最多500篇。',
  },
  {
    value: 'csv',
    label: 'CSV（.csv）',
    hint: '通用表格格式，保留中文和多行内容，可用 Excel / WPS 打开。',
  },
];
const validDate = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '1900-01-01' ||
    value > '2100-12-31'
  )
    return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const query = reactive<ReportQuery>({
  type: typeTabs.some((tab) => tab.value === route.query.type)
    ? (route.query.type as ReportQuery['type'])
    : 'all',
  from: validDate(route.query.from) ? route.query.from : '',
  to: validDate(route.query.to) ? route.query.to : '',
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword.slice(0, 120) : '',
  page:
    /^[1-9]\d{0,3}$/.test(String(route.query.page)) && Number(route.query.page) <= 1000
      ? Number(route.query.page)
      : 1,
});
const searchText = ref(query.keyword),
  data = ref<ReportPage | null>(null),
  loading = ref(false),
  error = ref(''),
  busy = ref(new Set<number>());
const editorVisible = ref(false),
  editing = ref<WorkReport | null>(null),
  saving = ref(false),
  exportVisible = ref(false),
  exporting = ref(false);
const draft = reactive<ReportInput>({
  type: 'daily',
  date: '',
  accomplishments: '',
  plans: '',
  blockers: '',
});
const exportQuery = reactive<ReportQuery & { format: ReportExportFormat }>({
  type: 'all',
  from: '',
  to: '',
  keyword: '',
  page: 1,
  format: 'xlsx',
});
const exportFormatHint = computed(
  () => exportFormats.find((option) => option.value === exportQuery.format)?.hint,
);
let draftSnapshot = '',
  active = true,
  controller: AbortController | undefined;
const hasFilters = computed(() => Boolean(query.keyword || query.from || query.to));
const dirty = computed(() => editorVisible.value && JSON.stringify(draft) !== draftSnapshot);
const outOfRange = (date: Date) => date.getFullYear() < 1900 || date.getFullYear() > 2100;
const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const draftPeriod = computed(() => {
  if (!validDate(draft.date)) return '请选择日期';
  const date = new Date(draft.date + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return `${start} — ${date.toISOString().slice(0, 10)}`;
});
function reportName(item: WorkReport) {
  return `${item.startDate}${item.type === 'daily' ? '日报' : '周报'}`;
}
async function load() {
  controller?.abort();
  if (query.from && query.to && query.from > query.to) {
    loading.value = false;
    error.value = '开始日期不能晚于结束日期';
    return;
  }
  const request = new AbortController();
  controller = request;
  loading.value = true;
  error.value = '';
  try {
    const result = await getReports(
      { ...query, from: query.from || '', to: query.to || '' },
      request.signal,
    );
    if (!active || request.signal.aborted) return;
    if (query.page > 1 && !result.items.length) {
      query.page = Math.max(1, Math.ceil(result.total / result.pageSize));
      await load();
      return;
    }
    data.value = result;
    await router.replace({
      query: {
        ...route.query,
        type: query.type,
        from: query.from || undefined,
        to: query.to || undefined,
        keyword: query.keyword || undefined,
        page: query.page > 1 ? String(query.page) : undefined,
      },
    });
  } catch (cause) {
    if (active && !request.signal.aborted)
      error.value = getErrorMessage(cause, '读取报告失败，请重试');
  } finally {
    if (controller === request) loading.value = false;
  }
}
function applyFilters() {
  query.keyword = searchText.value.trim();
  query.page = 1;
  void load();
}
function chooseType(type: ReportQuery['type']) {
  query.type = type;
  applyFilters();
}
function resetFilters() {
  searchText.value = '';
  query.from = '';
  query.to = '';
  applyFilters();
}
function turnPage(direction: number) {
  query.page += direction;
  void load();
}
function openEditor(item?: WorkReport) {
  editing.value = item || null;
  Object.assign(draft, {
    type: item?.type || (query.type === 'weekly' ? 'weekly' : 'daily'),
    date: item?.startDate || today(),
    accomplishments: item?.accomplishments || '',
    plans: item?.plans || '',
    blockers: item?.blockers || '',
  });
  draftSnapshot = JSON.stringify(draft);
  editorVisible.value = true;
}
async function allowDiscard() {
  if (!dirty.value) return true;
  try {
    await ElMessageBox.confirm('还有未保存的内容，确定放弃这次修改吗？', '放弃修改', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning',
    });
    return true;
  } catch {
    return false;
  }
}
async function closeEditor(done?: () => void) {
  if (saving.value || !(await allowDiscard())) return;
  if (done) done();
  else editorVisible.value = false;
}
async function save() {
  if (saving.value) return;
  if (!validDate(draft.date) || !draft.accomplishments.trim()) {
    ElMessage.warning('请选择有效日期并填写完成工作');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) await updateReport(editing.value.id, { ...draft });
    else await createReport({ ...draft });
    editorVisible.value = false;
    ElMessage.success('报告已保存');
    await load();
  } catch (cause) {
    ElMessage.error(getErrorMessage(cause, '保存失败，填写的内容已保留'));
  } finally {
    saving.value = false;
  }
}
async function remove(item: WorkReport) {
  if (busy.value.has(item.id)) return;
  try {
    await ElMessageBox.confirm(`确定删除 ${reportName(item)} 吗？删除后无法恢复。`, '删除报告', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }
  busy.value.add(item.id);
  try {
    await deleteReport(item.id);
    ElMessage.success('报告已删除');
    await load();
  } catch (cause) {
    ElMessage.error(getErrorMessage(cause, '删除失败，请重试'));
  } finally {
    busy.value.delete(item.id);
  }
}
function openExport() {
  const current = today();
  Object.assign(exportQuery, {
    ...query,
    from: query.from || current.slice(0, 7) + '-01',
    to: query.to || current,
    page: 1,
  });
  exportVisible.value = true;
}
async function download() {
  if (exporting.value) return;
  if (
    !validDate(exportQuery.from) ||
    !validDate(exportQuery.to) ||
    exportQuery.from > exportQuery.to
  ) {
    ElMessage.warning('请选择有效的开始和结束日期');
    return;
  }
  exporting.value = true;
  try {
    const blob = await exportReports({ ...exportQuery });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = `工作报告_${exportQuery.from}_${exportQuery.to}.${exportQuery.format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    exportVisible.value = false;
    ElMessage.success('报告已导出');
  } catch (cause) {
    ElMessage.error(getErrorMessage(cause, '导出失败，请重试'));
  } finally {
    exporting.value = false;
  }
}
function goBack() {
  const category =
    typeof route.query.fromCategory === 'string' ? route.query.fromCategory : undefined;
  void router.push({ name: 'home', query: category ? { category } : undefined });
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onBeforeRouteLeave(
  async (to) =>
    to.name === 'login' || (!saving.value && !exporting.value && (await allowDiscard())),
);
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
  active = false;
  controller?.abort();
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>
<style scoped>
.report-toolbar {
  align-items: center;
}
.report-search {
  width: min(100%, 300px);
}
.report-date-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 230px)) auto;
  align-items: center;
  gap: var(--app-space-2);
  flex-basis: 100%;
  justify-content: start;
}
.report-date-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--app-space-2);
  align-items: center;
  min-width: 0;
}
.report-date-control {
  min-width: 0;
}
.report-date-control :deep(.el-date-editor) {
  width: 100%;
  min-width: 0;
}
.report-date-filters label {
  color: var(--theme-muted);
  font-size: var(--app-font-control-size);
  white-space: nowrap;
}
.report-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--app-space-2);
  margin: 0;
  padding: var(--app-space-4);
  color: var(--el-color-danger);
}
.report-list {
  padding: 0;
  margin: 0;
  list-style: none;
}
.report-list.updating {
  opacity: 0.6;
  pointer-events: none;
}
.report-item {
  padding: var(--app-space-5) var(--app-space-6);
}
.report-item + .report-item {
  border-top: 1px solid var(--el-border-color-lighter);
}
.report-item-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}
.report-type {
  padding: 2px 8px;
  border-radius: var(--app-radius-control);
  background: var(--app-accent-soft);
  color: var(--ui-accent-text);
  font-size: var(--app-font-caption-size);
  white-space: nowrap;
}
.report-item h2 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: var(--app-font-body-size);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.report-item-actions {
  display: flex;
}
.report-delete {
  color: var(--el-color-danger);
}
.report-summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: var(--app-space-3) 0;
  color: var(--theme-text);
}
.report-extras {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-4);
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.report-extras > span,
.report-note {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
}
.report-read {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-1);
  margin-top: var(--app-space-3);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-accent-text);
  font: inherit;
  font-size: var(--app-font-control-size);
  cursor: pointer;
}
.report-read:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 4px;
}
.report-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--app-space-2);
  padding: var(--app-space-3) var(--app-space-6);
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.report-note {
  margin: var(--app-space-4) 0 0;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
  align-items: flex-start;
}
.report-note .el-icon {
  flex-shrink: 0;
  margin-top: 4px;
}
.report-form-hint {
  margin: 0;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .report-header {
    flex-wrap: wrap;
  }
  .report-header-actions {
    flex-basis: 100%;
    justify-content: flex-end;
  }
  .report-search {
    width: 100%;
  }
  .report-date-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .report-date-filters > .el-button {
    justify-self: end;
  }
  .report-item {
    padding: var(--app-space-4);
  }
  .report-item h2 span {
    display: block;
  }
  .report-footer {
    padding: var(--app-space-3) var(--app-space-4);
  }
}
</style>
