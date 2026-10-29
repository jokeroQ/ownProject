<template>
  <div class="admin-users-page app-page">
    <div class="app-page__content">
      <header class="admin-header app-page__header">
        <PageBackButton label="返回首页" @click="goBack" />
        <div class="admin-heading app-page__heading">
          <h1 class="app-page__title">用户管理</h1>
          <p class="app-page__description">管理账号资料、角色与密码</p>
        </div>
        <span class="admin-badge">管理员专用</span>
      </header>
      <p class="account-notice">
        修改账号信息、角色或重置密码后，对应用户需要重新登录。支持多位管理员，最后一位管理员不可降级。
      </p>

      <section v-if="accessDenied" class="access-message" role="alert">
        <h2>当前账号没有用户管理权限</h2>
        <p>已清除页面中的用户信息，正在返回首页。</p>
        <PageBackButton label="返回首页" @click="goBack" />
      </section>
      <section v-else class="users-card app-panel" aria-label="用户列表">
        <div class="users-toolbar app-toolbar app-panel__toolbar">
          <form class="user-search app-search" role="search" @submit.prevent="searchUsers">
            <label class="sr-only" for="admin-user-search">按用户名或邮箱搜索用户</label>
            <input
              id="admin-user-search"
              class="app-input"
              v-model="keyword"
              data-admin-search
              type="search"
              maxlength="255"
              autocomplete="off"
              placeholder="搜索用户名或邮箱"
              @input="scheduleSearch"
            />
            <el-button type="primary" native-type="submit">搜索</el-button>
          </form>
          <div class="user-count" aria-live="polite">
            共 {{ total }} 位用户 · {{ adminCount }} 位管理员
          </div>
          <el-button class="refresh-button" :loading="loading" :disabled="busy" @click="loadUsers()"
            >刷新</el-button
          >
        </div>
        <div v-if="listError" class="list-state" role="alert" data-admin-list-error>
          <p>{{ listError }}</p>
          <el-button data-admin-retry @click="loadUsers()">重新加载</el-button>
        </div>
        <div v-else-if="loading" class="list-state" role="status" data-admin-loading>
          正在读取用户列表…
        </div>
        <div v-else-if="!users.length" class="list-state" data-admin-empty>
          <h2>{{ keyword.trim() ? '没有找到匹配的用户' : '暂无用户' }}</h2>
          <p>
            {{ keyword.trim() ? '试试其他用户名或邮箱，或清空搜索条件。' : '可以稍后刷新列表。' }}
          </p>
        </div>
        <div v-else class="users-table-scroll" data-admin-list tabindex="0" aria-label="用户列表">
          <table class="users-table" role="table">
            <caption class="sr-only">
              现有用户的账号资料、角色和管理操作
            </caption>
            <colgroup>
              <col class="user-column" />
              <col class="email-column" />
              <col class="role-column" />
              <col class="date-column" />
              <col class="actions-column" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">用户</th>
                <th scope="col">邮箱</th>
                <th scope="col">角色</th>
                <th scope="col">注册时间</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id" :data-admin-user="user.id">
                <td class="user-cell">
                  <div class="user-name">
                    <span class="user-avatar" aria-hidden="true">{{ initial(user.username) }}</span>
                    <div>
                      <strong data-admin-user-name :title="user.username">{{
                        user.username
                      }}</strong
                      ><span class="user-id"
                        >ID {{ user.id
                        }}<span v-if="user.id === currentUser?.id"> · 当前账号</span></span
                      >
                    </div>
                  </div>
                </td>
                <td class="email-cell">
                  <span :title="user.email">{{ user.email }}</span>
                </td>
                <td class="role-cell">
                  <span class="role-tag" :class="user.role">{{
                    user.role === 'admin' ? '管理员' : '普通用户'
                  }}</span>
                </td>
                <td class="created-at">
                  <time :datetime="user.createdAt">{{ formatCreatedAt(user.createdAt) }}</time>
                </td>
                <td class="actions-cell">
                  <div class="row-actions">
                    <el-tooltip
                      content="编辑用户"
                      placement="top"
                      :show-after="250"
                      :trigger-keys="[]"
                    >
                      <el-button
                        data-admin-edit
                        class="admin-icon-button app-icon-button"
                        type="primary"
                        :icon="Edit"
                        aria-label="编辑用户"
                        :disabled="busy"
                        @click="openEdit(user)"
                      />
                    </el-tooltip>
                    <el-tooltip
                      content="重置密码"
                      placement="top"
                      :show-after="250"
                      :trigger-keys="[]"
                    >
                      <el-button
                        data-admin-reset-password
                        class="admin-icon-button app-icon-button"
                        :icon="Key"
                        aria-label="重置密码"
                        :disabled="busy"
                        @click="openPassword(user)"
                      />
                    </el-tooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer class="users-pagination" aria-label="用户列表分页">
          <label for="admin-page-size"
            >每页
            <el-select
              id="admin-page-size"
              v-model="pageSize"
              class="admin-page-size"
              data-admin-page-size
              aria-label="每页条数"
              :disabled="loading || busy"
              @change="loadUsers(1)"
            >
              <el-option
                v-for="size in [10, 20, 50]"
                :key="size"
                :value="size"
                :label="`${size} 条`"
              /> </el-select
          ></label>
          <div class="page-controls">
            <el-tooltip content="上一页" placement="top" :show-after="250" :trigger-keys="[]">
              <span class="icon-tooltip-target">
                <el-button
                  data-admin-prev
                  class="admin-icon-button app-icon-button"
                  :icon="ArrowLeft"
                  aria-label="上一页"
                  :disabled="loading || busy || page <= 1"
                  @click="loadUsers(page - 1)"
                />
              </span>
            </el-tooltip>
            <span role="status">{{ page }} / {{ pageCount }}</span>
            <el-tooltip content="下一页" placement="top" :show-after="250" :trigger-keys="[]">
              <span class="icon-tooltip-target">
                <el-button
                  data-admin-next
                  class="admin-icon-button app-icon-button"
                  :icon="ArrowRight"
                  aria-label="下一页"
                  :disabled="loading || busy || page >= pageCount"
                  @click="loadUsers(page + 1)"
                />
              </span>
            </el-tooltip>
          </div>
        </footer>
      </section>

      <el-dialog
        v-model="editOpen"
        class="admin-user-dialog"
        title="编辑用户"
        width="520px"
        append-to-body
        :close-on-click-modal="!editBusy"
        :close-on-press-escape="!editBusy"
        :show-close="!editBusy"
        :before-close="beforeEditClose"
        @closed="clearEdit"
      >
        <el-form
          v-if="editUser"
          :model="editForm"
          label-width="calc(var(--app-form-label-width) + var(--app-form-column-gap))"
          label-position="right"
          class="admin-form app-form"
          @submit.prevent="saveEdit"
        >
          <div class="dialog-subject">
            <span class="user-avatar" aria-hidden="true">{{ initial(editUser.username) }}</span>
            <div class="dialog-subject-info">
              <strong :title="editUser.username">{{ editUser.username }}</strong>
              <span
                >ID {{ editUser.id
                }}{{ editUser.id === currentUser?.id ? ' · 当前账号' : '' }}</span
              >
            </div>
          </div>
          <el-form-item label="用户名" prop="username" for="admin-edit-username">
            <el-input
              id="admin-edit-username"
              v-model="editForm.username"
              maxlength="255"
              autocomplete="off"
              :disabled="editBusy"
            />
          </el-form-item>
          <el-form-item label="邮箱" prop="email" for="admin-edit-email">
            <el-input
              id="admin-edit-email"
              v-model="editForm.email"
              type="email"
              maxlength="255"
              autocomplete="off"
              :disabled="editBusy"
            />
          </el-form-item>
          <el-form-item label="角色" prop="role" for="admin-edit-role">
            <el-select
              id="admin-edit-role"
              v-model="editForm.role"
              popper-class="admin-role-dropdown"
              :disabled="editBusy"
              aria-label="角色"
            >
              <el-option label="普通用户" value="user" :disabled="editingLastAdmin" />
              <el-option label="管理员" value="admin" />
            </el-select>
            <p v-if="editingLastAdmin" class="form-hint field-hint">
              这是最后一位管理员，必须保留管理员角色。
            </p>
          </el-form-item>
          <p class="form-hint">
            保存变更后，该用户所有已登录设备都需要重新登录。{{
              editUser.id === currentUser?.id ? '你也将退出当前账号。' : ''
            }}
          </p>
          <p v-if="editError" class="form-error" role="alert">{{ editError }}</p>
        </el-form>
        <template #footer
          ><el-button :disabled="editBusy" @click="editOpen = false">取消</el-button
          ><el-button
            data-admin-save
            type="primary"
            :loading="editBusy"
            :disabled="!editChanged"
            @click="saveEdit"
            >保存修改</el-button
          ></template
        >
      </el-dialog>
      <el-dialog
        v-model="passwordOpen"
        class="admin-user-dialog"
        title="重置用户密码"
        width="520px"
        append-to-body
        :close-on-click-modal="!passwordBusy"
        :close-on-press-escape="!passwordBusy"
        :show-close="!passwordBusy"
        :before-close="beforePasswordClose"
        @closed="clearPassword"
      >
        <el-form
          v-if="passwordUser"
          :model="passwordForm"
          label-width="calc(var(--app-form-label-width) + var(--app-form-column-gap))"
          label-position="right"
          class="admin-form app-form"
          @submit.prevent="savePassword"
        >
          <div class="dialog-subject">
            <span class="user-avatar" aria-hidden="true">{{ initial(passwordUser.username) }}</span>
            <div class="dialog-subject-info">
              <strong :title="passwordUser.username">{{ passwordUser.username }}</strong>
              <span
                >ID {{ passwordUser.id
                }}{{ passwordUser.id === currentUser?.id ? ' · 当前账号' : '' }}</span
              >
            </div>
          </div>
          <el-form-item label="新密码" prop="password" for="admin-reset-password">
            <el-input
              id="admin-reset-password"
              v-model="passwordForm.password"
              type="password"
              show-password
              autocomplete="new-password"
              aria-describedby="admin-password-rules"
              :disabled="passwordBusy"
            />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirm" for="admin-reset-confirm">
            <el-input
              id="admin-reset-confirm"
              v-model="passwordForm.confirm"
              type="password"
              show-password
              autocomplete="new-password"
              :disabled="passwordBusy"
            />
          </el-form-item>
          <div id="admin-password-rules" class="password-rules">
            <p class="password-length" :class="{ 'form-error': passwordBytes > 72 }">
              <span>密码长度</span><span>{{ passwordBytes }} / 72 字节</span>
            </p>
            <p class="form-hint">手动设置新密码，无需旧密码。密码不能为空，前后空格也会保留。</p>
            <p class="form-hint">
              最多 72 个 UTF-8 字节；纯英文字母或数字最多 72 位，常见汉字最多 24
              个。没有强制字符组合要求。
            </p>
          </div>
          <p v-if="passwordValidation" class="form-error" role="status">{{ passwordValidation }}</p>
          <p class="form-hint">
            重置成功后，该用户所有已登录设备都会退出，需使用新密码登录。{{
              passwordUser.id === currentUser?.id ? '你将退出当前账号。' : ''
            }}
          </p>
          <p v-if="passwordError" class="form-error" role="alert">{{ passwordError }}</p>
        </el-form>
        <template #footer
          ><el-button :disabled="passwordBusy" @click="passwordOpen = false">取消</el-button
          ><el-button
            data-admin-password-save
            type="primary"
            :loading="passwordBusy"
            :disabled="!passwordValid"
            @click="savePassword"
            >确认重置</el-button
          ></template
        >
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isAxiosError } from 'axios';
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTooltip,
} from 'element-plus';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import { ArrowLeft, ArrowRight, Edit, Key } from '@element-plus/icons-vue';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/form/style/css';
import 'element-plus/es/components/form-item/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/select/style/css';
import 'element-plus/es/components/tooltip/style/css';
import '@/assets/styles/admin-dialog.css';
import apiClient from '@/api/apiClient';
import {
  getManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
  type ManagedUser,
} from '@/api/adminUsers';
import {
  clearLogin,
  getCurrentUser,
  getToken,
  updateCurrentUser,
  type CurrentUser,
} from '@/utils/auth';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'AdminUsersPage' });
const router = useRouter();
const route = useRoute();
const currentUser = ref(getCurrentUser());
const users = ref<ManagedUser[]>([]);
const total = ref(0);
const adminCount = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const loading = ref(false);
const listError = ref('');
const accessDenied = ref(false);
const editOpen = ref(false);
const editUser = ref<ManagedUser | null>(null);
const editBusy = ref(false);
const editError = ref('');
const editForm = reactive({ username: '', email: '', role: 'user' as ManagedUser['role'] });
const passwordOpen = ref(false);
const passwordUser = ref<ManagedUser | null>(null);
const passwordBusy = ref(false);
const passwordError = ref('');
const passwordForm = reactive({ password: '', confirm: '' });
const busy = computed(() => editBusy.value || passwordBusy.value);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const editingLastAdmin = computed(() => editUser.value?.role === 'admin' && adminCount.value <= 1);
const editChanged = computed(
  () =>
    !!editUser.value &&
    (editForm.username.trim() !== editUser.value.username ||
      editForm.email.trim() !== editUser.value.email ||
      editForm.role !== editUser.value.role),
);
const passwordBytes = computed(() => new TextEncoder().encode(passwordForm.password).length);
const passwordValidation = computed(() =>
  passwordBytes.value > 72
    ? '新密码不能超过 72 个 UTF-8 字节。'
    : passwordForm.confirm && passwordForm.password !== passwordForm.confirm
      ? '两次输入的新密码不一致。'
      : '',
);
const passwordValid = computed(
  () => !!passwordForm.password && !!passwordForm.confirm && !passwordValidation.value,
);
let requestSequence = 0;
let listController: AbortController | null = null;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let sessionToken = getToken();
let sessionUserId = currentUser.value?.id;
let disposed = false;
let leaving = false;
let handlingForbidden = false;

function sameSession(token = sessionToken) {
  return (
    !disposed &&
    !leaving &&
    !!token &&
    token === getToken() &&
    getCurrentUser()?.id === sessionUserId
  );
}
function invalidateData() {
  requestSequence++;
  listController?.abort();
  clearTimeout(searchTimer);
  users.value = [];
  total.value = 0;
  adminCount.value = 0;
  loading.value = false;
  editOpen.value = false;
  passwordOpen.value = false;
  clearEdit();
  clearPassword();
}
function homeLocation() {
  return {
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  };
}
function goBack() {
  void router.push(homeLocation());
}
async function denyAccess() {
  if (handlingForbidden || disposed) return;
  handlingForbidden = true;
  const token = sessionToken;
  invalidateData();
  accessDenied.value = true;
  ElMessage.warning('当前账号已无管理员权限，正在返回首页。');
  try {
    const response = await apiClient.get<{ user: CurrentUser }>('/users/me');
    if (token && token === getToken()) updateCurrentUser(response.data.user, token);
  } catch {
    /* The auth interceptor handles an expired session. */
  }
  if (sameSession(token)) {
    leaving = true;
    await router.replace(homeLocation());
  }
}
async function failureMessage(error: unknown, fallback: string) {
  if (isAxiosError(error) && error.response?.status === 403) {
    await denyAccess();
    return '';
  }
  return getErrorMessage(error, fallback);
}
async function loadUsers(targetPage = page.value) {
  if (!sameSession() || accessDenied.value || busy.value) return;
  const sequence = ++requestSequence;
  const token = sessionToken;
  listController?.abort();
  listController = new AbortController();
  loading.value = true;
  listError.value = '';
  users.value = [];
  try {
    const result = await getManagedUsers(
      { keyword: keyword.value.trim(), page: targetPage, pageSize: pageSize.value },
      listController.signal,
    );
    if (!sameSession(token) || sequence !== requestSequence) return;
    const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
    if (!result.users.length && result.total && targetPage > lastPage) {
      await loadUsers(lastPage);
      return;
    }
    users.value = result.users;
    total.value = result.total;
    adminCount.value = result.adminCount;
    page.value = result.page;
    pageSize.value = result.pageSize;
  } catch (error) {
    if (sameSession(token) && sequence === requestSequence && !listController.signal.aborted)
      listError.value = await failureMessage(error, '用户列表加载失败，请重试。');
  } finally {
    if (sameSession(token) && sequence === requestSequence) loading.value = false;
  }
}
function scheduleSearch() {
  clearTimeout(searchTimer);
  // Invalidate the previous response as soon as the keyword changes, before debounce completes.
  requestSequence++;
  listController?.abort();
  loading.value = true;
  listError.value = '';
  users.value = [];
  searchTimer = setTimeout(searchUsers, 300);
}
function searchUsers() {
  clearTimeout(searchTimer);
  void loadUsers(1);
}
function openEdit(user: ManagedUser) {
  if (busy.value || accessDenied.value) return;
  editUser.value = { ...user };
  Object.assign(editForm, { username: user.username, email: user.email, role: user.role });
  editError.value = '';
  editOpen.value = true;
}
function clearEdit() {
  editUser.value = null;
  editError.value = '';
  Object.assign(editForm, { username: '', email: '', role: 'user' });
}
function beforeEditClose(done: () => void) {
  if (!editBusy.value) done();
}
function openPassword(user: ManagedUser) {
  if (busy.value || accessDenied.value) return;
  clearPassword();
  passwordUser.value = { ...user };
  passwordOpen.value = true;
}
function clearPassword() {
  passwordUser.value = null;
  passwordForm.password = '';
  passwordForm.confirm = '';
  passwordError.value = '';
}
function beforePasswordClose(done: () => void) {
  if (!passwordBusy.value) done();
}
async function requireLogin(message: string) {
  leaving = true;
  invalidateData();
  clearLogin();
  ElMessage.warning({ message, duration: 6000 });
  await router.replace({ name: 'login', query: { reason: 'account-updated' } });
}
async function saveEdit() {
  if (busy.value || !editOpen.value || !editUser.value || !editChanged.value || !sameSession())
    return;
  const input = {
    username: editForm.username.trim(),
    email: editForm.email.trim(),
    role: editForm.role,
  };
  if (!input.username || input.username.length > 255) {
    editError.value = '请输入 1–255 个字符的用户名。';
    return;
  }
  if (!input.email || input.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    editError.value = '请输入有效邮箱，且不超过 255 个字符。';
    return;
  }
  if (editingLastAdmin.value && input.role !== 'admin') {
    editError.value = '必须保留至少一位管理员。';
    return;
  }
  const userId = editUser.value.id;
  const token = sessionToken;
  editBusy.value = true;
  editError.value = '';
  try {
    const result = await updateManagedUser(userId, input);
    if (!sameSession(token)) return;
    editOpen.value = false;
    if (userId === sessionUserId) {
      await requireLogin('账号信息或角色已更新，请重新登录。');
      return;
    }
    ElMessage.success(result.message || '用户资料已更新，该用户需要重新登录。');
    editBusy.value = false;
    await loadUsers();
  } catch (error) {
    if (sameSession(token))
      editError.value = await failureMessage(error, '用户资料保存失败，请重试。');
  } finally {
    if (sameSession(token)) editBusy.value = false;
  }
}
async function savePassword() {
  if (
    busy.value ||
    !passwordOpen.value ||
    !passwordUser.value ||
    !passwordValid.value ||
    !sameSession()
  )
    return;
  const userId = passwordUser.value.id;
  const token = sessionToken;
  passwordBusy.value = true;
  passwordError.value = '';
  try {
    const result = await resetManagedUserPassword(userId, passwordForm.password);
    if (!sameSession(token)) return;
    passwordOpen.value = false;
    clearPassword();
    if (userId === sessionUserId) {
      await requireLogin('密码已重置，请使用新密码重新登录。');
      return;
    }
    ElMessage.success(result.message || '密码已重置，该用户需要重新登录。');
  } catch (error) {
    if (sameSession(token))
      passwordError.value = await failureMessage(error, '密码重置失败，请重试。');
  } finally {
    if (sameSession(token)) passwordBusy.value = false;
  }
}
function onSessionChange() {
  const nextUser = getCurrentUser();
  if (!sameSession()) {
    invalidateData();
    if (!disposed && !leaving) {
      leaving = true;
      void router.replace(getToken() ? homeLocation() : { name: 'login' });
    }
    return;
  }
  currentUser.value = nextUser;
  if (nextUser?.role !== 'admin' && !handlingForbidden) void denyAccess();
}
function onStorage(event: StorageEvent) {
  if (!event.key || event.key === 'token' || event.key === 'user') onSessionChange();
}
function initial(name: string) {
  return [...name.trim()][0]?.toLocaleUpperCase() || '?';
}
function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}
onMounted(() => {
  window.addEventListener('auth-changed', onSessionChange);
  window.addEventListener('user-changed', onSessionChange);
  window.addEventListener('storage', onStorage);
  if (currentUser.value?.role !== 'admin') void denyAccess();
  else void loadUsers();
});
onBeforeUnmount(() => {
  disposed = true;
  invalidateData();
  window.removeEventListener('auth-changed', onSessionChange);
  window.removeEventListener('user-changed', onSessionChange);
  window.removeEventListener('storage', onStorage);
  sessionToken = null;
  sessionUserId = undefined;
});
</script>

<style scoped>
.admin-header > .el-button {
  margin: 0;
}
.icon-tooltip-target {
  display: inline-flex;
}
.admin-badge {
  margin-left: auto;
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-size: 12px;
  white-space: nowrap;
}
.account-notice {
  flex-shrink: 0;
  margin: 0 0 var(--app-space-4);
  padding: 12px 16px;
  color: var(--theme-muted);
  background: var(--theme-surface);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.users-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 300px;
  overflow: hidden;
}
.users-toolbar {
  flex-shrink: 0;
}
.user-search {
  display: flex;
  flex: 1 1 280px;
  min-width: 200px;
  max-width: 520px;
  gap: 8px;
}
.user-search > .el-button,
.refresh-button {
  margin: 0;
}
.user-count {
  margin-left: auto;
  color: var(--theme-muted);
  font-size: 13px;
  white-space: nowrap;
}
.users-table-scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.users-table {
  width: 100%;
  min-width: 860px;
  table-layout: fixed;
  border-collapse: collapse;
  text-align: left;
  font-size: var(--app-font-body-size);
}
.user-column {
  width: 28%;
}
.role-column {
  width: 96px;
}
.date-column {
  width: 166px;
}
.actions-column {
  width: 112px;
}
.users-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--el-fill-color-light);
  color: var(--theme-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 14px 16px;
  white-space: nowrap;
}
.users-table td {
  padding: 16px;
  vertical-align: middle;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.users-table tr:last-child td {
  border-bottom: 0;
}
.users-table tbody tr:hover {
  background: var(--el-fill-color-lighter);
}
.user-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.user-name > div {
  flex: 1;
  min-width: 0;
}
.user-name strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.user-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.user-id {
  display: block;
  margin-top: 4px;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.email-cell > span {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-tag {
  display: inline-block;
  padding: 4px 9px;
  border-radius: 6px;
  color: var(--theme-muted);
  background: var(--el-fill-color);
  font-size: var(--app-font-caption-size);
  white-space: nowrap;
}
.role-tag.admin {
  color: var(--ui-accent-text, var(--el-color-primary));
  background: var(--el-color-primary-light-9);
}
.created-at {
  color: var(--theme-muted);
  white-space: nowrap;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.users-pagination {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 14px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--theme-muted);
  font-size: 12px;
}
.users-pagination label {
  display: flex;
  align-items: center;
  gap: 7px;
}
.admin-page-size {
  width: 96px;
}
.page-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  font-variant-numeric: tabular-nums;
}
.page-controls .el-button {
  margin: 0;
}
.list-state,
.access-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px 20px;
  text-align: center;
  color: var(--theme-muted);
  font-size: 13px;
  line-height: 1.8;
}
.list-state p,
.access-message p {
  margin: 0;
}
.list-state h2,
.access-message h2 {
  margin: 0;
  color: var(--theme-text);
  font-size: 18px;
  font-weight: 600;
}
.form-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--theme-muted);
}
.form-error {
  margin: 0;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
input:focus-visible,
select:focus-visible,
.users-table-scroll:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
@media (max-width: 900px) {
  .admin-badge {
    font-size: var(--app-font-caption-size);
    padding: 5px 7px;
  }
  .account-notice {
    padding: 9px 12px;
    font-size: var(--app-font-caption-size);
  }
  .users-card {
    flex: none;
    min-height: 0;
  }
  .user-search {
    flex-basis: 100%;
    min-width: 0;
    max-width: none;
  }
  .user-count {
    margin-left: 0;
    margin-right: auto;
    font-size: 12px;
  }
  .users-table-scroll {
    flex: none;
    overflow: visible;
    padding: 12px;
  }
  .users-table {
    display: block;
    min-width: 0;
  }
  .users-table colgroup,
  .users-table thead {
    display: none;
  }
  .users-table tbody {
    display: grid;
    gap: 12px;
  }
  .users-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    background: var(--el-bg-color);
  }
  .users-table tbody tr:hover {
    background: var(--el-bg-color);
  }
  .users-table td {
    min-width: 0;
    padding: 0;
    border: 0;
  }
  .user-cell {
    grid-column: 1;
    grid-row: 1;
  }
  .user-name {
    align-items: flex-start;
  }
  .user-name strong {
    display: -webkit-box;
    overflow-wrap: anywhere;
    white-space: normal;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.5;
  }
  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 9px;
  }
  .role-cell {
    grid-column: 2;
    grid-row: 1;
    align-self: start;
  }
  .email-cell {
    grid-column: 1 / -1;
    grid-row: 2;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 8px;
    font-size: 12px;
    line-height: 1.6;
  }
  .email-cell::before {
    content: '邮箱';
    color: var(--theme-muted);
  }
  .email-cell > span {
    display: -webkit-box;
    overflow-wrap: anywhere;
    white-space: normal;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .created-at {
    grid-column: 1 / -1;
    grid-row: 3;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .created-at::before {
    content: '注册时间';
  }
  .actions-cell {
    grid-column: 1 / -1;
    grid-row: 4;
  }
  .row-actions {
    padding-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
  .users-pagination {
    padding: 12px;
    gap: 10px;
  }
}
@media (max-width: 380px) {
  .admin-badge {
    display: none;
  }
  .users-pagination {
    justify-content: center;
  }
  .page-controls {
    width: 100%;
    justify-content: space-between;
    gap: 8px;
  }
}
</style>
