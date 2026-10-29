<template>
  <div class="todo-page app-page">
    <div class="todo-content app-page__content">
      <header class="todo-header app-page__header">
        <PageBackButton @click="goBack" />
        <div class="todo-heading app-page__heading">
          <h1 class="app-page__title">待办清单</h1>
          <p class="app-page__description">安排每天、每周的小事，也记下随时想做的事。</p>
        </div>
        <el-tooltip content="刷新清单" :trigger-keys="[]"
          ><el-button
            class="app-icon-button todo-icon"
            :icon="Refresh"
            aria-label="刷新清单"
            :disabled="loading"
            @click="load"
        /></el-tooltip>
      </header>

      <nav class="todo-recurrence app-tabs" aria-label="待办类型筛选">
        <button
          v-for="tab in recurrenceTabs"
          :key="tab.value"
          type="button"
          :aria-pressed="query.recurrence === tab.value"
          :disabled="adding || saving || clearing"
          @click="chooseRecurrence(tab.value)"
        >
          {{ tab.label }}<span>{{ data?.recurrenceCounts[tab.value].all || 0 }}</span>
        </button>
      </nav>
      <p class="todo-period-note">{{ recurrenceHint }}</p>
      <section class="todo-overview" aria-label="待办概况">
        <div>
          <strong class="app-stat-value">{{ data?.counts.open ?? '—' }}</strong
          ><span>件事，等你去完成</span>
        </div>
        <span v-if="data" class="progress-text"
          >已完成 {{ data.counts.done }} / {{ data.counts.all }} 项</span
        >
      </section>
      <form class="quick-add app-toolbar" aria-label="快速添加待办" @submit.prevent="submitAdd">
        <el-input
          v-model="newTitle"
          :placeholder="addPlaceholder"
          aria-label="新增待办内容"
          maxlength="120"
          :disabled="adding"
          @keydown.enter="addFromEnter"
        />
        <el-button
          type="primary"
          :icon="Plus"
          native-type="submit"
          :loading="adding"
          :disabled="adding || saving"
          >添加</el-button
        >
      </form>

      <section class="todo-panel app-panel" aria-label="待办事项">
        <div class="todo-toolbar app-toolbar app-panel__toolbar">
          <nav class="todo-tabs app-tabs" aria-label="待办状态筛选">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              type="button"
              :class="{ active: query.status === tab.value }"
              :aria-pressed="query.status === tab.value"
              @click="chooseStatus(tab.value)"
            >
              {{ tab.label }}<span>{{ data?.counts[tab.value] || 0 }}</span>
            </button>
          </nav>
          <div class="todo-tools app-toolbar__actions">
            <form class="todo-search app-search" @submit.prevent="apply">
              <el-input
                v-model="query.keyword"
                :prefix-icon="Search"
                placeholder="搜索待办"
                aria-label="搜索待办"
                maxlength="120"
                clearable
                @clear="apply"
              /><el-button
                class="app-icon-button todo-icon"
                :icon="Search"
                native-type="submit"
                aria-label="搜索清单"
              />
            </form>
            <el-select v-model="query.sort" class="todo-sort" aria-label="待办排序" @change="apply"
              ><el-option value="recent" label="最近添加" /><el-option
                value="due"
                label="计划日期" /><el-option value="important" label="优先处理"
            /></el-select>
            <el-tooltip content="清理已完成的普通待办，每日和每周事项会保留" :trigger-keys="[]"
              ><el-button
                class="app-icon-button todo-icon"
                :icon="Delete"
                aria-label="清理已完成"
                :disabled="!data?.clearableCount || clearing || loading"
                :loading="clearing"
                @click="clearDone"
            /></el-tooltip>
          </div>
        </div>
        <div v-if="error" class="todo-error" role="alert">
          <el-icon><Warning /></el-icon><span>{{ error }}</span
          ><el-button text @click="load">重试</el-button>
        </div>
        <div class="todo-results" :aria-busy="loading">
          <div v-if="loading && !data" class="todo-loading app-loading-state" role="status">
            <el-icon class="is-loading"><Loading /></el-icon>正在读取清单…
          </div>
          <ul
            v-else-if="data?.items.length"
            class="todo-list"
            :class="{ updating: loading }"
            aria-label="待办列表"
          >
            <li
              v-for="item in data.items"
              :key="item.id"
              :data-todo-id="item.id"
              :class="['todo-item', { completed: item.completed, busy: busy.has(item.id) }]"
            >
              <button
                class="todo-check"
                type="button"
                role="checkbox"
                :aria-checked="item.completed"
                :aria-label="`${item.completed ? '恢复待办' : '完成待办'}：${item.title}`"
                :disabled="busy.has(item.id) || loading || clearing"
                @click="toggle(item)"
              >
                <el-icon v-if="item.completed"><Check /></el-icon>
              </button>
              <div class="todo-body">
                <button
                  type="button"
                  class="todo-title"
                  :disabled="busy.has(item.id) || loading"
                  :aria-label="`编辑待办：${item.title}`"
                  @click="openEditor(item)"
                >
                  {{ item.title }}
                </button>
                <p v-if="item.notes" class="todo-notes">{{ item.notes }}</p>
                <div
                  v-if="item.important || item.dueDate || item.recurrence !== 'none'"
                  class="todo-meta"
                >
                  <span v-if="item.recurrence !== 'none'" class="recurrence-badge">
                    <el-icon><Refresh /></el-icon
                    >{{ item.recurrence === 'daily' ? '每日 · 今天' : '每周 · 本周' }}
                  </span>
                  <span v-if="item.important" class="important-badge"
                    ><el-icon><Flag /></el-icon>优先处理</span
                  ><span
                    v-if="item.dueDate"
                    :class="{
                      overdue: isOverdue(item),
                      today: item.dueDate === today && !item.completed,
                    }"
                    ><el-icon><Calendar /></el-icon>{{ dueText(item) }}</span
                  >
                </div>
              </div>
              <div class="todo-actions">
                <el-tooltip content="编辑" :trigger-keys="[]"
                  ><el-button
                    class="app-icon-button todo-icon"
                    :icon="Edit"
                    :aria-label="`编辑：${item.title}`"
                    :disabled="busy.has(item.id) || loading"
                    @click="openEditor(item)" /></el-tooltip
                ><el-tooltip content="删除" :trigger-keys="[]"
                  ><el-button
                    class="app-icon-button todo-icon delete-icon"
                    :icon="Delete"
                    :aria-label="`删除：${item.title}`"
                    :disabled="busy.has(item.id) || loading || clearing"
                    @click="remove(item)"
                /></el-tooltip>
              </div>
            </li>
          </ul>
          <div v-else-if="!loading && !error" class="todo-empty app-empty">
            <el-icon class="app-empty__icon"><Finished /></el-icon>
            <h2 class="app-empty__title">{{ emptyTitle }}</h2>
            <p class="app-empty__description">
              {{
                query.keyword
                  ? '换个关键词试试，或清空搜索查看全部事项。'
                  : query.status === 'done'
                    ? '完成一件小事后，来这里看看自己的进展。'
                    : '在上方写下最近想做的事，按 Enter 就能添加。'
              }}
            </p>
          </div>
        </div>
        <footer v-if="data && data.total" class="todo-footer">
          <span
            >{{ query.keyword ? `找到 ${data.total} 项` : `共 ${data.total} 项`
            }}<span v-if="data.total > data.pageSize">
              · 第 {{ query.page }} / {{ Math.ceil(data.total / data.pageSize) }} 页</span
            ></span
          >
          <div class="todo-pagination" aria-label="待办翻页">
            <el-tooltip content="上一页" :trigger-keys="[]"
              ><el-button
                class="app-icon-button todo-icon"
                :icon="ArrowLeft"
                aria-label="待办上一页"
                :disabled="loading || query.page <= 1"
                @click="turnPage(-1)" /></el-tooltip
            ><el-tooltip content="下一页" :trigger-keys="[]"
              ><el-button
                class="app-icon-button todo-icon"
                :icon="ArrowRight"
                aria-label="待办下一页"
                :disabled="loading || !data.hasMore"
                @click="turnPage(1)"
            /></el-tooltip>
          </div>
        </footer>
      </section>
      <p class="todo-save-note">
        <el-icon><Lock /></el-icon>仅自己可见，自动保存到当前账号。
      </p>
    </div>
    <el-dialog
      v-model="editorVisible"
      :title="editing ? '编辑待办' : '添加待办'"
      width="500"
      class="todo-editor"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      @opened="titleInput?.focus()"
    >
      <form class="todo-edit-form app-form" @submit.prevent="saveEditor">
        <div class="editor-field app-form-row">
          <label for="todo-title">事项</label
          ><el-input
            id="todo-title"
            ref="titleInput"
            v-model="draft.title"
            aria-label="待办事项内容"
            maxlength="120"
            :disabled="saving"
            placeholder="准备做些什么？"
          />
        </div>
        <div class="editor-field app-form-row">
          <label for="todo-recurrence">待办类型</label>
          <el-select
            id="todo-recurrence"
            v-model="draft.recurrence"
            aria-label="待办类型"
            :disabled="saving"
            @change="changeDraftRecurrence"
          >
            <el-option
              v-for="option in recurrenceOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            />
          </el-select>
        </div>
        <div class="editor-field app-form-row">
          <label for="todo-notes">备注</label
          ><el-input
            id="todo-notes"
            v-model="draft.notes"
            type="textarea"
            :rows="3"
            resize="vertical"
            aria-label="待办备注"
            maxlength="2000"
            :disabled="saving"
            placeholder="补充一些想法或具体步骤（选填）"
          />
        </div>
        <div v-if="draft.recurrence === 'none'" class="editor-field app-form-row">
          <label for="todo-due-date">计划日期</label
          ><el-date-picker
            id="todo-due-date"
            v-model="draft.dueDate"
            type="date"
            popper-class="app-date-popper todo-date-popper"
            :popper-options="datePickerPopperOptions"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            aria-label="待办计划日期"
            placeholder="选个日期（选填）"
            clearable
            :disabled="saving"
            :disabled-date="outOfRange"
          />
        </div>
        <div class="editor-field app-form-row">
          <label for="todo-important">优先处理</label>
          <div class="priority-control app-form-control app-form-control--between">
            <span class="field-hint app-form-inline-text">设为重要事项</span>
            <el-switch
              id="todo-important"
              v-model="draft.important"
              aria-label="标记优先处理"
              :disabled="saving"
            />
          </div>
        </div>
        <p class="todo-editor-hint">
          {{ recurrenceDescriptions[draft.recurrence]
          }}{{
            editing && draft.recurrence !== editing.recurrence
              ? '切换类型后，完成状态会重新开始。'
              : ''
          }}
        </p>
        <button type="submit" class="hidden-submit" tabindex="-1" aria-hidden="true"></button>
      </form>
      <template #footer
        ><el-button :disabled="saving" @click="editorVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="!draft.title.trim()"
          @click="saveEditor"
          >{{ editing ? '保存' : '添加' }}</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Delete,
  Edit,
  Finished,
  Flag,
  Loading,
  Lock,
  Plus,
  Refresh,
  Search,
  Warning,
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { InputInstance } from 'element-plus';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import {
  clearCompletedTodos,
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
  type Todo,
  type TodoInput,
  type TodoPage,
  type TodoQuery,
  type TodoStatus,
  type TodoRecurrence,
  type TodoRecurrenceFilter,
} from '@/api/todos';
import { getErrorMessage } from '@/utils/errors';
import { datePickerPopperOptions } from '@/utils/ui';
defineOptions({ name: 'TodoListPage' });
const route = useRoute(),
  router = useRouter();
const tabs: { value: TodoStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '未完成' },
  { value: 'done', label: '已完成' },
];
const recurrenceOptions: { value: TodoRecurrence; label: string }[] = [
  { value: 'daily', label: '每日待办' },
  { value: 'weekly', label: '每周待办' },
  { value: 'none', label: '普通待办' },
];
const recurrenceTabs: { value: TodoRecurrenceFilter; label: string }[] = [
  { value: 'all', label: '全部事项' },
  ...recurrenceOptions,
];
const recurrenceDescriptions: Record<TodoRecurrence, string> = {
  daily: '每天重复，完成只对当天有效；次日 0 点自动恢复未完成。',
  weekly: '每周重复，完成只对本周有效；下周一 0 点自动恢复未完成。',
  none: '一次性事项，不要求时间；计划日期选填，完成状态一直保留。',
};
const query = reactive<TodoQuery>({
  recurrence: recurrenceTabs.some((tab) => tab.value === route.query.recurrence)
    ? (route.query.recurrence as TodoRecurrenceFilter)
    : 'all',
  status: tabs.some((tab) => tab.value === route.query.status)
    ? (route.query.status as TodoStatus)
    : 'all',
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword : '',
  sort: ['recent', 'due', 'important'].includes(String(route.query.sort))
    ? (route.query.sort as TodoQuery['sort'])
    : 'recent',
  page:
    /^[1-9]\d{0,3}$/.test(String(route.query.page)) && Number(route.query.page) <= 1000
      ? Number(route.query.page)
      : 1,
});
const data = ref<TodoPage | null>(null),
  loading = ref(false),
  error = ref(''),
  newTitle = ref(''),
  adding = ref(false),
  clearing = ref(false),
  busy = ref(new Set<number>());
const editorVisible = ref(false),
  editing = ref<Todo | null>(null),
  saving = ref(false),
  titleInput = ref<InputInstance>();
const draft = reactive<TodoInput>({
  title: '',
  notes: '',
  dueDate: null,
  important: false,
  recurrence: 'none',
});
const newRecurrence = computed<TodoRecurrence>(() =>
  query.recurrence === 'all' ? 'none' : query.recurrence,
);
const recurrenceHint = computed(() =>
  query.recurrence === 'all'
    ? '每日、每周按北京时间重复；全部视图快速添加为普通待办，可在编辑中调整类型。'
    : `${recurrenceDescriptions[query.recurrence]}${query.recurrence === 'none' ? '' : '（北京时间）'}`,
);
const addPlaceholder = computed(() =>
  newRecurrence.value === 'daily'
    ? '每天想坚持做什么？'
    : newRecurrence.value === 'weekly'
      ? '每周想完成什么？'
      : '最近想做什么？写下来吧',
);
let controller: AbortController | undefined,
  active = true;
let periodTimer: ReturnType<typeof setTimeout> | undefined;
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = ref(localDate(new Date()));
const emptyTitle = computed(() =>
  query.keyword
    ? '没有找到匹配的待办'
    : query.status === 'done'
      ? '还没有已完成的事项'
      : data.value?.counts.all
        ? '待办都完成了，做得不错'
        : '清单还是空的',
);
const outOfRange = (date: Date) => date.getFullYear() < 1900 || date.getFullYear() > 2100;
const isOverdue = (item: Todo) =>
  Boolean(!item.completed && item.dueDate && item.dueDate < today.value);
function dueText(item: Todo) {
  if (item.dueDate === today.value) return '今天';
  const next = new Date(today.value + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  if (item.dueDate === next.toISOString().slice(0, 10)) return '明天';
  return `${isOverdue(item) ? '已逾期 · ' : ''}${item.dueDate}`;
}
async function load() {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  loading.value = true;
  error.value = '';
  void router.replace({
    query: {
      ...(typeof route.query.fromCategory === 'string'
        ? { fromCategory: route.query.fromCategory }
        : {}),
      status: query.status,
      recurrence: query.recurrence,
      ...(query.keyword ? { keyword: query.keyword } : {}),
      sort: query.sort,
      page: String(query.page),
    },
  });
  try {
    const result = await getTodos({ ...query, keyword: query.keyword.trim() }, request.signal);
    if (!request.signal.aborted) {
      if (!result.items.length && query.page > 1) {
        query.page = Math.max(1, Math.ceil(result.total / result.pageSize));
        void load();
        return;
      }
      data.value = result;
      today.value = result.calendar.today;
      clearTimeout(periodTimer);
      periodTimer = setTimeout(
        refreshIfIdle,
        Math.max(
          100,
          Date.parse(result.calendar.nextResetAt) - Date.parse(result.calendar.serverNow) + 100,
        ),
      );
    }
  } catch (e) {
    if (!request.signal.aborted) error.value = getErrorMessage(e, '清单读取失败，请重试');
  } finally {
    if (controller === request) loading.value = false;
  }
}
function apply() {
  query.page = 1;
  void load();
}
function chooseRecurrence(recurrence: TodoRecurrenceFilter) {
  if (query.recurrence === recurrence) return;
  query.recurrence = recurrence;
  query.status = 'all';
  apply();
}
function changeDraftRecurrence() {
  if (draft.recurrence !== 'none') draft.dueDate = null;
}
function chooseStatus(status: TodoStatus) {
  if (query.status !== status) {
    query.status = status;
    apply();
  }
}
function turnPage(direction: number) {
  query.page += direction;
  void load();
  document.querySelector('.todo-page')?.scrollTo({ top: 0, behavior: 'instant' });
}
function submitAdd() {
  if (adding.value || saving.value) return;
  if (newTitle.value.trim()) void add();
  else openEditor();
}
async function add() {
  const title = newTitle.value.trim();
  if (!title || adding.value || saving.value) return;
  adding.value = true;
  try {
    await createTodo({
      title,
      notes: '',
      dueDate: null,
      important: false,
      recurrence: newRecurrence.value,
    });
    if (!active) return;
    newTitle.value = '';
    query.status = 'open';
    query.keyword = '';
    query.page = 1;
    await load();
    ElMessage.success('待办已添加');
  } catch (e) {
    if (active) ElMessage.error(getErrorMessage(e, '添加失败，输入已保留'));
  } finally {
    adding.value = false;
  }
}
function addFromEnter(event: Event) {
  if (!(event instanceof KeyboardEvent) || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  void add();
}
function openEditor(item?: Todo) {
  editing.value = item || null;
  Object.assign(
    draft,
    item
      ? {
          title: item.title,
          notes: item.notes,
          dueDate: item.dueDate,
          important: item.important,
          recurrence: item.recurrence,
        }
      : {
          title: newTitle.value,
          notes: '',
          dueDate: null,
          important: false,
          recurrence: newRecurrence.value,
        },
  );
  editorVisible.value = true;
}
async function saveEditor() {
  if (saving.value || !draft.title.trim()) return;
  saving.value = true;
  try {
    const values = { ...draft, title: draft.title.trim(), dueDate: draft.dueDate || null };
    if (editing.value) await updateTodo(editing.value.id, values);
    else await createTodo(values);
    if (!active) return;
    if (query.recurrence !== 'all') query.recurrence = values.recurrence;
    if (!editing.value) {
      newTitle.value = '';
      query.status = 'open';
      query.keyword = '';
      query.page = 1;
    }
    editorVisible.value = false;
    await load();
    ElMessage.success('待办已保存');
  } catch (e) {
    if (active) ElMessage.error(getErrorMessage(e, '保存失败，输入已保留'));
  } finally {
    saving.value = false;
  }
}
async function toggle(item: Todo) {
  if (busy.value.has(item.id) || loading.value || clearing.value) return;
  busy.value.add(item.id);
  try {
    await updateTodo(item.id, { completed: !item.completed, periodKey: item.periodKey });
    if (active) await load();
  } catch (e) {
    if (active) {
      ElMessage.error(getErrorMessage(e, '状态保存失败，请重试'));
      await load();
    }
  } finally {
    busy.value.delete(item.id);
  }
}
async function remove(item: Todo) {
  if (busy.value.has(item.id)) return;
  try {
    await ElMessageBox.confirm(
      `确定删除“${item.title}”吗？${item.recurrence !== 'none' ? '删除后，后续周期也不会再显示此事项。' : ''}`,
      '删除待办',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    return;
  }
  if (!active) return;
  busy.value.add(item.id);
  try {
    await deleteTodo(item.id);
    if (active) {
      await load();
      ElMessage.success('待办已删除');
    }
  } catch (e) {
    if (active) ElMessage.error(getErrorMessage(e, '删除失败，请重试'));
  } finally {
    busy.value.delete(item.id);
  }
}
async function clearDone() {
  if (clearing.value || !data.value?.clearableCount) return;
  try {
    await ElMessageBox.confirm(
      `将清理当前账号已完成的普通待办（当前 ${data.value.clearableCount} 项）。每日、每周待办和未完成事项会保留。`,
      '清理已完成',
      { confirmButtonText: '清理', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  if (!active) return;
  clearing.value = true;
  try {
    const result = await clearCompletedTodos();
    if (active) {
      await load();
      ElMessage.success(`已清理 ${result.removed} 项`);
    }
  } catch (e) {
    if (active) ElMessage.error(getErrorMessage(e, '清理失败，请重试'));
  } finally {
    clearing.value = false;
  }
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
function refreshIfIdle() {
  if (!active || document.visibilityState === 'hidden') return;
  if (adding.value || saving.value || clearing.value || busy.value.size || loading.value) {
    clearTimeout(periodTimer);
    periodTimer = setTimeout(refreshIfIdle, 1000);
    return;
  }
  void load();
}
function onVisibilityChange() {
  if (document.visibilityState === 'visible') refreshIfIdle();
}
onMounted(() => {
  void load();
  window.addEventListener('focus', refreshIfIdle);
  document.addEventListener('visibilitychange', onVisibilityChange);
});
onBeforeUnmount(() => {
  active = false;
  controller?.abort();
  clearTimeout(periodTimer);
  window.removeEventListener('focus', refreshIfIdle);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>
<style scoped>
.todo-recurrence {
  margin-bottom: var(--app-space-2);
}
.todo-period-note,
.todo-editor-hint {
  margin: 0 0 var(--app-space-4);
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
  line-height: 1.8;
}
.todo-editor-hint {
  margin: 0;
  padding-left: calc(var(--app-form-label-width) + var(--app-form-column-gap));
}
.todo-overview {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--app-space-4);
  margin-bottom: var(--app-space-4);
}
.todo-overview > div {
  display: flex;
  align-items: baseline;
  gap: var(--app-space-2);
}
.todo-overview span {
  font-size: var(--app-font-caption-size);
  color: var(--theme-muted);
}
.todo-overview .progress-text {
  font-size: var(--app-font-caption-size);
  padding-bottom: 2px;
}
.quick-add {
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-4);
}
.quick-add .el-input {
  flex: 1;
  min-width: 0;
}
.todo-search {
  width: 225px;
}
.todo-search .el-input {
  min-width: 0;
}
.todo-sort {
  width: 115px;
}
.todo-list {
  margin: 0;
  padding: 0;
  list-style: none;
  transition: opacity 0.15s;
}
.todo-list.updating {
  opacity: 0.6;
}
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.todo-item:last-child {
  border-bottom: 0;
}
.todo-item:hover {
  background: var(--el-fill-color-extra-light);
}
.todo-item.busy {
  opacity: 0.6;
}
.todo-check {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 19px;
  width: 19px;
  height: 19px;
  padding: 0;
  margin-top: 3px;
  border: 1.5px solid var(--el-border-color-darker);
  border-radius: 6px;
  color: var(--el-color-white);
  background: transparent;
  cursor: pointer;
}
.todo-check:hover {
  border-color: var(--el-color-primary);
}
.completed .todo-check {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}
.todo-check .el-icon {
  font-size: 13px;
}
.todo-check:disabled {
  cursor: wait;
}
.todo-body {
  flex: 1;
  min-width: 0;
}
.todo-title {
  display: block;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: var(--theme-text);
  text-align: left;
  font: inherit;
  font-weight: 500;
  font-size: var(--app-font-body-size);
  line-height: 24px;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.todo-title:hover {
  color: var(--el-color-primary);
}
.completed .todo-title {
  text-decoration: line-through;
  color: var(--theme-muted);
}
.todo-notes {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  margin: var(--app-space-1) 0 0;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
  line-height: 1.7;
}
.todo-meta {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  flex-wrap: wrap;
  margin-top: var(--app-space-2);
  font-size: var(--app-font-caption-size);
  color: var(--theme-muted);
}
.todo-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.todo-meta .important-badge {
  color: var(--el-color-warning);
}
.todo-meta .overdue {
  color: var(--el-color-danger);
}
.todo-meta .today {
  color: var(--el-color-primary);
}
.completed .todo-meta {
  opacity: 0.65;
}
.todo-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--app-space-1);
  margin-top: calc(-1 * var(--app-space-1));
}
.delete-icon.el-button:hover {
  color: var(--el-color-danger);
}
.todo-error {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3) var(--app-space-4);
  font-size: var(--app-font-caption-size);
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.todo-error span {
  flex: 1;
}
.todo-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--app-space-2) var(--app-space-4);
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: var(--app-font-caption-size);
  color: var(--theme-muted);
  gap: var(--app-space-3);
}
.todo-pagination {
  display: flex;
  gap: var(--app-space-1);
}
.todo-save-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-1);
  margin-top: var(--app-space-4);
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.hidden-submit {
  display: none;
}
.todo-check:focus-visible,
.todo-title:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
@media (max-width: 700px) {
  .todo-search {
    flex: 1;
    width: auto;
  }
}
@media (max-width: 600px) {
  .todo-overview {
    gap: var(--app-space-2);
  }
  .todo-overview > div {
    gap: var(--app-space-2);
  }
  .todo-sort {
    width: 105px;
    flex-shrink: 0;
  }
  .todo-search > .el-button {
    display: none;
  }
  .todo-item {
    gap: var(--app-space-2);
    padding: var(--app-space-3);
  }
  .todo-actions {
    gap: var(--app-space-1);
  }
  .todo-meta {
    gap: var(--app-space-2);
  }
}
@media (prefers-reduced-motion: reduce) {
  .todo-list {
    transition: none;
  }
}
</style>
