<template>
  <div class="chat-page app-page app-page--workspace">
    <div class="app-page__content app-page__content--workspace">
      <header class="page-header app-page__header">
        <PageBackButton @click="goBack" />
        <div class="page-title app-page__heading">
          <h1 class="app-page__title">聊天社区</h1>
          <p class="app-page__description">一对一私聊，让交流随时发生</p>
        </div>
        <div class="account-state">
          <span class="current-user">{{ currentUser?.username || '登录已失效' }}</span>
          <span class="connection-state" :class="connectionState" role="status">
            <i aria-hidden="true"></i>{{ connectionLabel }}
          </span>
        </div>
      </header>

      <div v-if="notice" class="notice" role="alert">
        <span>{{ notice }}</span>
        <el-button text class="text-button" native-type="button" @click="notice = ''"
          >关闭</el-button
        >
      </div>

      <div class="chat-layout app-panel" :class="{ 'conversation-open': selectedId !== null }">
        <aside class="conversation-sidebar" aria-label="私聊会话">
          <div class="sidebar-top">
            <h2>
              消息 <span v-if="totalUnread" class="total-unread">{{ totalUnread }}</span>
            </h2>
            <el-button
              text
              class="text-button"
              :disabled="listLoading || !currentUser"
              @click="synchronize"
            >
              {{ listLoading ? '同步中…' : '刷新' }}
            </el-button>
          </div>
          <form class="user-search app-search" @submit.prevent="searchUsers">
            <label class="sr-only" for="chat-user-search">搜索用户名，开始私聊</label>
            <input
              id="chat-user-search"
              class="app-input"
              v-model="keyword"
              data-chat-search
              autocomplete="off"
              maxlength="80"
              placeholder="搜索用户名，开始私聊"
              :disabled="!currentUser"
              @input="scheduleSearch"
            />
            <el-button
              text
              class="text-button"
              native-type="submit"
              :disabled="!currentUser || searching"
            >
              搜索
            </el-button>
          </form>
          <div v-if="keyword.trim()" class="search-results" aria-live="polite">
            <p class="section-caption">{{ searching ? '正在查找…' : '搜索结果' }}</p>
            <p v-if="searchError" class="inline-error">{{ searchError }}</p>
            <p v-else-if="!searching && searched && !searchResults.length" class="empty-caption">
              没有找到其他用户，试试完整用户名。
            </p>
            <button
              v-for="user in searchResults"
              :key="user.id"
              :data-chat-user="user.id"
              class="search-result"
              :disabled="creatingUserId !== null"
              @click="startConversation(user)"
            >
              <span class="avatar">{{ initial(user.username) }}</span>
              <span class="search-name">{{ user.username }}</span>
              <span class="start-label">{{
                creatingUserId === user.id ? '打开中…' : '发消息 →'
              }}</span>
            </button>
          </div>
          <div class="conversation-list">
            <div v-if="listError" class="sidebar-empty" role="alert">
              <p>{{ listError }}</p>
              <el-button text class="text-button" @click="synchronize">重新加载</el-button>
            </div>
            <p v-else-if="listLoading && !conversations.length" class="sidebar-empty">
              正在加载会话…
            </p>
            <div v-else-if="!conversations.length" class="sidebar-empty">
              <p>还没有会话</p>
              <span>搜索一个用户名，开启第一段对话。</span>
            </div>
            <button
              v-for="conversation in sortedConversations"
              :key="conversation.id"
              :data-chat-conversation="conversation.id"
              :data-chat-unread="conversation.unreadCount"
              class="conversation-item"
              :class="{ selected: selectedId === conversation.id }"
              :aria-current="selectedId === conversation.id ? 'true' : undefined"
              @click="selectConversation(conversation.id)"
            >
              <span class="avatar">{{ initial(conversation.peer.username) }}</span>
              <span class="conversation-copy">
                <span class="conversation-name">{{ conversation.peer.username }}</span>
                <span class="last-message">{{ preview(conversation) }}</span>
              </span>
              <span class="conversation-meta">
                <time>{{
                  shortTime(conversation.lastMessage?.createdAt || conversation.updatedAt)
                }}</time>
                <span v-if="conversation.unreadCount" class="unread-badge">
                  {{ conversation.unreadCount > 99 ? '99+' : conversation.unreadCount }}
                </span>
              </span>
            </button>
          </div>
        </aside>

        <main class="conversation-panel">
          <template v-if="selectedConversation">
            <header class="conversation-header">
              <el-tooltip content="返回会话列表" :trigger-keys="[]"
                ><el-button
                  class="mobile-back app-icon-button"
                  :icon="Back"
                  data-chat-back-list
                  aria-label="返回会话列表"
                  @click="closeConversation"
                >
                </el-button
              ></el-tooltip>
              <span class="avatar">{{ initial(selectedConversation.peer.username) }}</span>
              <div>
                <h2 :title="selectedConversation.peer.username">
                  {{ selectedConversation.peer.username }}
                </h2>
                <p>一对一私聊</p>
              </div>
            </header>
            <div class="message-scroll-area">
              <div
                ref="messageList"
                class="message-list"
                aria-label="聊天消息"
                @scroll="onMessageScroll"
              >
                <p v-if="viewLoading" class="messages-placeholder" role="status">正在加载消息…</p>
                <div v-else-if="messageError" class="messages-placeholder" role="alert">
                  <p>{{ messageError }}</p>
                  <el-button
                    text
                    class="text-button"
                    @click="selectConversation(selectedConversation.id, true)"
                  >
                    重新加载
                  </el-button>
                </div>
                <template v-else>
                  <div v-if="historyAvailable[selectedId!]" class="history-control">
                    <el-button
                      text
                      class="text-button"
                      data-chat-more
                      :disabled="historyLoading"
                      @click="loadHistory"
                    >
                      {{ historyLoading ? '正在加载…' : '加载更早的消息' }}
                    </el-button>
                  </div>
                  <p v-else-if="displayMessages.length" class="history-start">对话从这里开始</p>
                  <div v-if="!displayMessages.length" class="messages-placeholder">
                    <span class="empty-symbol" aria-hidden="true">✦</span>
                    <p>向 {{ selectedConversation.peer.username }} 打个招呼吧</p>
                  </div>
                  <article
                    v-for="message in displayMessages"
                    :key="message.key"
                    :data-chat-message="message.id"
                    :data-chat-message-client="message.clientMessageId"
                    class="message-row"
                    :class="{ mine: message.senderId === currentUser?.id }"
                  >
                    <span class="message-avatar avatar" aria-hidden="true">{{
                      initial(
                        message.senderId === currentUser?.id
                          ? currentUser.username
                          : selectedConversation.peer.username,
                      )
                    }}</span>
                    <div class="message-content">
                      <p class="message-bubble">{{ message.content }}</p>
                      <div class="message-meta">
                        <time :datetime="message.createdAt">{{
                          messageTime(message.createdAt)
                        }}</time>
                        <template v-if="message.senderId === currentUser?.id">
                          <span v-if="message.status === 'sending'">发送中…</span>
                          <template v-else-if="message.status === 'failed'">
                            <span class="send-error">发送失败</span>
                            <el-button
                              link
                              class="text-button"
                              data-chat-retry
                              @click="retryMessage(message.clientMessageId)"
                            >
                              重试
                            </el-button>
                          </template>
                          <span v-else>{{
                            message.id && message.id <= selectedConversation.peerLastReadMessageId
                              ? '已读'
                              : '已发送'
                          }}</span>
                        </template>
                      </div>
                      <p v-if="message.error" class="message-error">{{ message.error }}</p>
                    </div>
                  </article>
                </template>
              </div>
              <el-button
                type="primary"
                plain
                v-if="!nearBottom && !viewLoading"
                class="latest-button"
                @click="showLatest"
              >
                ↓ 回到最新消息
              </el-button>
            </div>
            <form class="composer" @submit.prevent="sendMessage">
              <label class="sr-only" for="chat-draft">输入消息</label>
              <textarea
                id="chat-draft"
                class="app-textarea"
                ref="draftInput"
                v-model="draft"
                data-chat-composer
                rows="3"
                maxlength="2000"
                placeholder="写下你想说的话…"
                :disabled="!currentUser || viewLoading || !!messageError"
                @keydown="onComposerKeydown"
                @compositionstart="composing = true"
                @compositionend="composing = false"
              ></textarea>
              <div class="composer-footer">
                <span class="keyboard-hint">Enter 发送 · Shift + Enter 换行</span>
                <span class="character-count" :class="{ 'at-limit': draft.length >= 2000 }"
                  >{{ draft.length }}/2000</span
                >
                <el-button type="primary" data-chat-send native-type="submit" :disabled="!canSend"
                  >发送</el-button
                >
              </div>
            </form>
          </template>
          <div v-else class="welcome-state">
            <span class="welcome-icon" aria-hidden="true"><i-ep-chatDotRound /></span>
            <h2>{{ currentUser ? '让交流从这里开始' : '请重新登录' }}</h2>
            <p>
              {{
                currentUser
                  ? '选择左侧会话，或搜索用户开始新的对话。'
                  : '当前登录状态已失效，重新登录后即可继续聊天。'
              }}
            </p>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io, type Socket } from 'socket.io-client';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import { Back } from '@element-plus/icons-vue';
import apiClient from '@/api/apiClient';
import {
  createConversation,
  getChatMessages,
  getConversations,
  readConversation,
  searchChatUsers,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatUser,
  type ReadReceipt,
} from '@/api/chat';
import { clearLogin, getCurrentUser, getToken } from '@/utils/auth';

defineOptions({ name: 'PrivateChat' });

interface PendingMessage {
  conversationId: number;
  clientMessageId: string;
  senderId: number;
  content: string;
  createdAt: string;
  status: 'sending' | 'failed';
  error?: string;
}
interface DisplayMessage {
  key: string;
  id?: number;
  clientMessageId: string;
  senderId: number;
  content: string;
  createdAt: string;
  status: 'sent' | 'sending' | 'failed';
  error?: string;
}

const router = useRouter();
const route = useRoute();
const currentUser = ref(getCurrentUser());
const conversations = ref<ChatConversation[]>([]);
const messages = ref<Record<number, ChatMessage[]>>({});
const pendingMessages = ref<PendingMessage[]>([]);
const historyAvailable = ref<Record<number, boolean>>({});
const selectedId = ref<number | null>(null);
const keyword = ref('');
const searchResults = ref<ChatUser[]>([]);
const searching = ref(false);
const searched = ref(false);
const searchError = ref('');
const creatingUserId = ref<number | null>(null);
const listLoading = ref(false);
const listError = ref('');
const viewLoading = ref(false);
const historyLoading = ref(false);
const messageError = ref('');
const notice = ref('');
const connectionState = ref<'connecting' | 'connected' | 'disconnected' | 'expired'>('connecting');
const draft = ref('');
const composing = ref(false);
const nearBottom = ref(true);
const messageList = ref<HTMLElement | null>(null);
const draftInput = ref<HTMLTextAreaElement | null>(null);
const loadedConversations = new Set<number>();
const seenMessageIds = new Set<number>();
const conversationVersions = new Map<number, number>();
const readRequests = new Map<number, number>();
const fetchedThrough = new Map<number, number>();
const drafts = new Map<number, string>();
let socket: Socket | null = null;
let sessionToken: string | null = null;
let sessionEpoch = 0;
let selectionEpoch = 0;
let searchEpoch = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let listRefreshPromise: Promise<boolean> | null = null;
let listCorrectionTimer: ReturnType<typeof setTimeout> | undefined;
let listCorrectionInFlight = false;
let listCorrectionNeeded = false;
let syncPromise: Promise<void> | null = null;
let syncAgain = false;
let synchronizing = false;
let disposed = false;

const selectedConversation = computed(() =>
  conversations.value.find((item) => item.id === selectedId.value),
);
const sortedConversations = computed(() =>
  [...conversations.value].sort((a, b) => {
    const difference = (b.lastMessage?.id || 0) - (a.lastMessage?.id || 0);
    return difference || Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id - a.id;
  }),
);
const totalUnread = computed(() =>
  conversations.value.reduce((total, item) => total + item.unreadCount, 0),
);
const connectionLabel = computed(
  () =>
    ({
      connecting: '正在连接',
      connected: '实时连接',
      disconnected: '连接中断，正在重连',
      expired: '登录已失效',
    })[connectionState.value],
);
const displayMessages = computed<DisplayMessage[]>(() => {
  if (selectedId.value === null) return [];
  const saved = (messages.value[selectedId.value] || []).map((message) => ({
    ...message,
    key: `message-${message.id}`,
    status: 'sent' as const,
  }));
  const pending = pendingMessages.value
    .filter((item) => item.conversationId === selectedId.value)
    .map((message) => ({
      ...message,
      key: `pending-${message.clientMessageId}`,
    }));
  return [...saved, ...pending];
});
const canSend = computed(
  () =>
    !!currentUser.value &&
    selectedId.value !== null &&
    !viewLoading.value &&
    !messageError.value &&
    !!draft.value.trim() &&
    draft.value.length <= 2000,
);

function errorMessage(error: unknown, fallback: string) {
  const response = (error as { response?: { data?: { message?: unknown } } })?.response;
  return typeof response?.data?.message === 'string' ? response.data.message : fallback;
}
function isCurrent(epoch: number) {
  return !disposed && epoch === sessionEpoch && !!sessionToken && getToken() === sessionToken;
}
function touchConversation(id: number) {
  conversationVersions.set(id, (conversationVersions.get(id) || 0) + 1);
}
function lastMessage(id: number) {
  const items = messages.value[id];
  return items?.[items.length - 1];
}
function mergeConversation(incoming: ChatConversation, preserveUnread = false) {
  const previous = conversations.value.find((item) => item.id === incoming.id);
  const newerLocalMessage =
    previous?.lastMessage && previous.lastMessage.id > (incoming.lastMessage?.id || 0);
  const lastReadMessageId = Math.max(
    previous?.lastReadMessageId || 0,
    incoming.lastReadMessageId || 0,
  );
  const merged: ChatConversation = {
    ...incoming,
    lastMessage: newerLocalMessage ? previous.lastMessage : incoming.lastMessage,
    updatedAt: newerLocalMessage ? previous.updatedAt : incoming.updatedAt,
    lastReadMessageId,
    peerLastReadMessageId: Math.max(
      previous?.peerLastReadMessageId || 0,
      incoming.peerLastReadMessageId || 0,
    ),
    unreadCount: preserveUnread && previous ? previous.unreadCount : incoming.unreadCount,
  };
  if (merged.lastMessage && lastReadMessageId >= merged.lastMessage.id) merged.unreadCount = 0;
  if (previous)
    conversations.value = conversations.value.map((item) =>
      item.id === merged.id ? merged : item,
    );
  else conversations.value.push(merged);
  if (incoming.lastMessage) seenMessageIds.add(incoming.lastMessage.id);
}
function mergeMessages(id: number, incoming: ChatMessage[]) {
  const byId = new Map((messages.value[id] || []).map((message) => [message.id, message]));
  for (const message of incoming) {
    if (message.conversationId !== id) continue;
    byId.set(message.id, message);
    seenMessageIds.add(message.id);
    pendingMessages.value = pendingMessages.value.filter(
      (pending) =>
        !(
          pending.conversationId === id &&
          pending.senderId === message.senderId &&
          pending.clientMessageId === message.clientMessageId
        ),
    );
    const conversation = conversations.value.find((item) => item.id === id);
    if (conversation && message.id > (conversation.lastMessage?.id || 0)) {
      conversation.lastMessage = message;
      conversation.updatedAt = message.createdAt;
      touchConversation(id);
    }
  }
  messages.value[id] = [...byId.values()].sort((a, b) => a.id - b.id);
}
async function refreshConversations(epoch: number) {
  if (listRefreshPromise) return listRefreshPromise;
  const task = (async () => {
    const versions = new Map(conversationVersions);
    listLoading.value = true;
    try {
      const data = await getConversations();
      if (!isCurrent(epoch)) return false;
      let raced = false;
      for (const conversation of data) {
        const changed =
          (versions.get(conversation.id) || 0) !== (conversationVersions.get(conversation.id) || 0);
        mergeConversation(conversation, changed);
        raced ||= changed;
      }
      listError.value = '';
      return raced;
    } catch (error) {
      if (isCurrent(epoch)) listError.value = errorMessage(error, '会话加载失败，请稍后重试。');
      return false;
    } finally {
      if (isCurrent(epoch)) listLoading.value = false;
    }
  })();
  listRefreshPromise = task;
  try {
    return await task;
  } finally {
    if (listRefreshPromise === task) listRefreshPromise = null;
  }
}
function scheduleListCorrection(delay = 120) {
  listCorrectionNeeded = true;
  if (listCorrectionTimer || listCorrectionInFlight || !sessionToken) return;
  const epoch = sessionEpoch;
  listCorrectionTimer = setTimeout(() => {
    listCorrectionTimer = undefined;
    if (!isCurrent(epoch)) return;
    listCorrectionNeeded = false;
    listCorrectionInFlight = true;
    void refreshConversations(epoch).then((raced) => {
      if (!isCurrent(epoch)) return;
      listCorrectionInFlight = false;
      // A busy conversation retries at most once per second, then settles after traffic stops.
      if (raced || listCorrectionNeeded) scheduleListCorrection(1000);
    });
  }, delay);
}
async function catchUp(id: number, epoch: number) {
  // Socket events can arrive before REST catches up; they must not advance this cursor.
  let afterId = fetchedThrough.get(id) || 0;
  let hasMore = true;
  while (hasMore && isCurrent(epoch)) {
    const page = await getChatMessages(id, { afterId });
    if (!isCurrent(epoch)) return;
    mergeMessages(id, page.data);
    const nextId = page.data[page.data.length - 1]?.id || afterId;
    if (nextId <= afterId) break;
    afterId = nextId;
    fetchedThrough.set(id, Math.max(fetchedThrough.get(id) || 0, afterId));
    hasMore = page.hasMore;
  }
}
async function synchronize() {
  if (!sessionToken || !currentUser.value) return;
  if (syncPromise) {
    syncAgain = true;
    return syncPromise;
  }
  const epoch = sessionEpoch;
  synchronizing = true;
  const task = (async () => {
    do {
      syncAgain = false;
      const raced = await refreshConversations(epoch);
      if (raced && isCurrent(epoch)) scheduleListCorrection();
      for (const id of [...loadedConversations]) {
        if (!isCurrent(epoch)) return;
        try {
          await catchUp(id, epoch);
        } catch (error) {
          if (isCurrent(epoch))
            notice.value = errorMessage(error, '有消息尚未同步，请点击刷新重试。');
        }
      }
      if (isCurrent(epoch) && nearBottom.value) {
        await scrollToBottom();
        void markRead();
      }
    } while (syncAgain && isCurrent(epoch));
  })();
  syncPromise = task;
  try {
    await task;
  } finally {
    if (syncPromise === task) {
      syncPromise = null;
      synchronizing = false;
      if (isCurrent(epoch)) void markRead();
    }
  }
}
async function selectConversation(id: number, force = false) {
  if (!currentUser.value) return;
  if (selectedId.value === id && !force && !messageError.value) return;
  if (selectedId.value !== null) drafts.set(selectedId.value, draft.value);
  selectedId.value = id;
  draft.value = drafts.get(id) || '';
  nearBottom.value = true;
  messageError.value = '';
  historyLoading.value = false;
  const selection = ++selectionEpoch;
  const epoch = sessionEpoch;
  viewLoading.value = true;
  try {
    if (loadedConversations.has(id)) {
      await catchUp(id, epoch);
    } else {
      const page = await getChatMessages(id);
      if (!isCurrent(epoch)) return;
      mergeMessages(id, page.data);
      fetchedThrough.set(id, page.data[page.data.length - 1]?.id || 0);
      loadedConversations.add(id);
      historyAvailable.value[id] = page.hasMore;
      // Reconnection can happen while the first snapshot is still in flight.
      await catchUp(id, epoch);
    }
    if (!isCurrent(epoch)) return;
    if (selection !== selectionEpoch) return;
    viewLoading.value = false;
    await scrollToBottom();
    if (!isCurrent(epoch) || selection !== selectionEpoch) return;
    void markRead();
    if (window.matchMedia('(min-width: 761px)').matches) draftInput.value?.focus();
  } catch (error) {
    if (isCurrent(epoch) && selection === selectionEpoch)
      messageError.value = errorMessage(error, '消息加载失败，请重试。');
  } finally {
    if (isCurrent(epoch) && selection === selectionEpoch) viewLoading.value = false;
  }
}
function closeConversation() {
  if (selectedId.value !== null) drafts.set(selectedId.value, draft.value);
  selectedId.value = null;
  selectionEpoch++;
  draft.value = '';
}
async function loadHistory() {
  const id = selectedId.value;
  if (id === null || historyLoading.value) return;
  const beforeId = messages.value[id]?.[0]?.id;
  if (!beforeId) return;
  const epoch = sessionEpoch;
  const selection = selectionEpoch;
  const oldHeight = messageList.value?.scrollHeight || 0;
  const oldTop = messageList.value?.scrollTop || 0;
  historyLoading.value = true;
  try {
    const page = await getChatMessages(id, { beforeId });
    if (!isCurrent(epoch)) return;
    mergeMessages(id, page.data);
    historyAvailable.value[id] = page.hasMore;
    await nextTick();
    if (isCurrent(epoch) && selection === selectionEpoch && messageList.value) {
      messageList.value.scrollTop = oldTop + messageList.value.scrollHeight - oldHeight;
    }
  } catch (error) {
    if (isCurrent(epoch) && selection === selectionEpoch)
      notice.value = errorMessage(error, '历史消息加载失败，请重试。');
  } finally {
    if (isCurrent(epoch) && selection === selectionEpoch) historyLoading.value = false;
  }
}
function scheduleSearch() {
  clearTimeout(searchTimer);
  searchEpoch++;
  searching.value = false;
  searched.value = false;
  searchResults.value = [];
  searchError.value = '';
  if (keyword.value.trim())
    searchTimer = setTimeout(() => {
      void searchUsers();
    }, 300);
}
async function searchUsers() {
  clearTimeout(searchTimer);
  const query = keyword.value.trim();
  if (!query || !currentUser.value) return;
  const epoch = sessionEpoch;
  const request = ++searchEpoch;
  searching.value = true;
  searchError.value = '';
  try {
    const users = await searchChatUsers(query);
    if (isCurrent(epoch) && request === searchEpoch) {
      searchResults.value = users.filter((user) => user.id !== currentUser.value?.id);
      searched.value = true;
    }
  } catch (error) {
    if (isCurrent(epoch) && request === searchEpoch)
      searchError.value = errorMessage(error, '搜索失败，请重试。');
  } finally {
    if (isCurrent(epoch) && request === searchEpoch) searching.value = false;
  }
}
async function startConversation(user: ChatUser) {
  if (creatingUserId.value !== null) return;
  const epoch = sessionEpoch;
  creatingUserId.value = user.id;
  try {
    const conversation = await createConversation(user.id);
    if (!isCurrent(epoch)) return;
    mergeConversation(conversation);
    keyword.value = '';
    scheduleSearch();
    await selectConversation(conversation.id);
  } catch (error) {
    if (isCurrent(epoch)) notice.value = errorMessage(error, '暂时无法打开会话，请重试。');
  } finally {
    if (isCurrent(epoch)) creatingUserId.value = null;
  }
}
async function submitPending(pending: PendingMessage) {
  const epoch = sessionEpoch;
  pending.status = 'sending';
  pending.error = undefined;
  try {
    const message = await sendChatMessage(pending.conversationId, {
      clientMessageId: pending.clientMessageId,
      content: pending.content,
    });
    if (!isCurrent(epoch)) return;
    mergeMessages(pending.conversationId, [message]);
    if (selectedId.value === pending.conversationId && nearBottom.value) await scrollToBottom();
  } catch (error) {
    if (!isCurrent(epoch)) return;
    const stillPending = pendingMessages.value.find(
      (item) => item.clientMessageId === pending.clientMessageId,
    );
    if (stillPending) {
      stillPending.status = 'failed';
      stillPending.error = errorMessage(error, '发送未确认，点击重试继续发送。');
    }
  }
}
function sendMessage() {
  if (!canSend.value || !currentUser.value || selectedId.value === null || composing.value) return;
  const pending: PendingMessage = {
    conversationId: selectedId.value,
    clientMessageId: newClientMessageId(),
    senderId: currentUser.value.id,
    content: draft.value.trim(),
    createdAt: new Date().toISOString(),
    status: 'sending',
  };
  pendingMessages.value.push(pending);
  draft.value = '';
  drafts.delete(selectedId.value);
  void scrollToBottom();
  void submitPending(pending);
}
function newClientMessageId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function retryMessage(clientMessageId: string) {
  const pending = pendingMessages.value.find((item) => item.clientMessageId === clientMessageId);
  if (pending && pending.status === 'failed') void submitPending(pending);
}
function onComposerKeydown(event: KeyboardEvent) {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing &&
    !composing.value &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    sendMessage();
  }
}
async function scrollToBottom() {
  await nextTick();
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
  nearBottom.value = true;
}
function onMessageScroll() {
  const list = messageList.value;
  if (!list) return;
  nearBottom.value = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
  if (nearBottom.value) void markRead();
}
async function showLatest() {
  await scrollToBottom();
  void markRead();
}
function canRead(id: number) {
  return (
    selectedId.value === id &&
    !viewLoading.value &&
    !messageError.value &&
    !synchronizing &&
    nearBottom.value &&
    document.visibilityState === 'visible' &&
    document.hasFocus()
  );
}
function applyReceipt(receipt: ReadReceipt) {
  const conversation = conversations.value.find((item) => item.id === receipt.conversationId);
  if (!conversation) return;
  if (receipt.userId === currentUser.value?.id) {
    const before = conversation.lastReadMessageId || 0;
    const after = Math.max(before, receipt.lastReadMessageId);
    if (after === before) return;
    conversation.lastReadMessageId = after;
    if ((conversation.lastMessage?.id || 0) <= after) {
      conversation.unreadCount = 0;
    } else {
      const cached = messages.value[conversation.id] || [];
      const readCount = cached.filter(
        (message) =>
          message.senderId === conversation.peer.id && message.id > before && message.id <= after,
      ).length;
      conversation.unreadCount = Math.max(0, conversation.unreadCount - readCount);
      const complete =
        loadedConversations.has(conversation.id) &&
        (!historyAvailable.value[conversation.id] || (cached[0]?.id || Infinity) <= before) &&
        (fetchedThrough.get(conversation.id) || 0) >= after;
      if (!complete) scheduleListCorrection();
    }
  } else if (receipt.userId === conversation.peer.id) {
    const before = conversation.peerLastReadMessageId || 0;
    if (receipt.lastReadMessageId <= before) return;
    conversation.peerLastReadMessageId = receipt.lastReadMessageId;
  } else {
    return;
  }
  touchConversation(conversation.id);
}
async function markRead() {
  const id = selectedId.value;
  if (id === null || !canRead(id)) return;
  const last = lastMessage(id);
  const conversation = conversations.value.find((item) => item.id === id);
  if (
    !last ||
    !conversation ||
    last.id <= (conversation.lastReadMessageId || 0) ||
    readRequests.has(id)
  )
    return;
  const epoch = sessionEpoch;
  readRequests.set(id, last.id);
  try {
    const receipt = await readConversation(id, last.id);
    if (isCurrent(epoch)) applyReceipt(receipt);
  } catch (error) {
    if (isCurrent(epoch))
      notice.value = errorMessage(error, '已读状态同步失败，重新聚焦会话或点击刷新可重试。');
  } finally {
    if (isCurrent(epoch)) {
      readRequests.delete(id);
      const latest = lastMessage(id)?.id || 0;
      if (latest > last.id && canRead(id)) void markRead();
    }
  }
}
function onIncomingMessage(message: ChatMessage, epoch: number) {
  if (!isCurrent(epoch)) return;
  const seen = seenMessageIds.has(message.id);
  const conversation = conversations.value.find((item) => item.id === message.conversationId);
  const follow = selectedId.value === message.conversationId && nearBottom.value;
  mergeMessages(message.conversationId, [message]);
  if (
    conversation &&
    !seen &&
    message.senderId !== currentUser.value?.id &&
    message.id > (conversation.lastReadMessageId || 0)
  ) {
    conversation.unreadCount++;
    touchConversation(conversation.id);
  }
  if (!conversation) void synchronize();
  if (follow)
    void scrollToBottom().then(() => {
      if (isCurrent(epoch)) void markRead();
    });
}
function resetSession() {
  sessionEpoch++;
  selectionEpoch++;
  searchEpoch++;
  clearTimeout(searchTimer);
  clearTimeout(listCorrectionTimer);
  listCorrectionTimer = undefined;
  listCorrectionInFlight = false;
  listCorrectionNeeded = false;
  listRefreshPromise = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  syncPromise = null;
  syncAgain = false;
  synchronizing = false;
  conversations.value = [];
  messages.value = {};
  pendingMessages.value = [];
  historyAvailable.value = {};
  selectedId.value = null;
  searchResults.value = [];
  keyword.value = '';
  draft.value = '';
  notice.value = '';
  listError.value = '';
  messageError.value = '';
  searchError.value = '';
  searching.value = false;
  searched.value = false;
  creatingUserId.value = null;
  listLoading.value = false;
  viewLoading.value = false;
  historyLoading.value = false;
  nearBottom.value = true;
  composing.value = false;
  loadedConversations.clear();
  seenMessageIds.clear();
  conversationVersions.clear();
  readRequests.clear();
  fetchedThrough.clear();
  drafts.clear();
}
function startSession() {
  resetSession();
  sessionToken = getToken();
  currentUser.value = getCurrentUser();
  if (!sessionToken || !currentUser.value) {
    connectionState.value = 'expired';
    return;
  }
  const epoch = sessionEpoch;
  connectionState.value = 'connecting';
  const origin = new URL(apiClient.defaults.baseURL || '/api', window.location.origin).origin;
  socket = io(origin, { autoConnect: false, auth: { token: sessionToken } });
  socket.on('connect', () => {
    if (!isCurrent(epoch)) return;
    connectionState.value = 'connected';
    void synchronize();
  });
  socket.on('disconnect', () => {
    if (isCurrent(epoch)) connectionState.value = 'disconnected';
  });
  socket.on('connect_error', (error: Error & { data?: { status?: number; code?: string } }) => {
    if (!isCurrent(epoch)) return;
    if (error.data?.status === 401 || error.data?.code === 'UNAUTHORIZED') {
      expireSession();
      return;
    }
    connectionState.value = 'disconnected';
  });
  socket.on('chat:message', (message: ChatMessage) => onIncomingMessage(message, epoch));
  socket.on('chat:read', (receipt: ReadReceipt) => {
    if (isCurrent(epoch)) applyReceipt(receipt);
  });
  socket.on('chat:unauthorized', () => {
    if (!isCurrent(epoch)) return;
    expireSession();
  });
  socket.connect();
  void synchronize();
}
function expireSession() {
  const redirect = route.fullPath;
  clearLogin();
  void router.replace({ name: 'login', query: { redirect } });
}
function onAuthChange() {
  const nextUser = getCurrentUser();
  if (getToken() !== sessionToken || nextUser?.id !== currentUser.value?.id) startSession();
  else currentUser.value = nextUser;
}
function onStorage(event: StorageEvent) {
  if (!event.key || event.key === 'token' || event.key === 'user') onAuthChange();
}
function onVisibility() {
  if (document.visibilityState === 'visible' && document.hasFocus()) {
    void synchronize();
    void markRead();
  }
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
function initial(name: string) {
  return [...name.trim()][0]?.toLocaleUpperCase() || '?';
}
function preview(conversation: ChatConversation) {
  const message = conversation.lastMessage;
  if (!message) return '还没有消息，打个招呼吧';
  return `${message.senderId === currentUser.value?.id ? '我：' : ''}${message.content}`;
}
function shortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date().toDateString() === date.toDateString();
  return date.toLocaleString(
    'zh-CN',
    today
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { month: 'numeric', day: 'numeric' },
  );
}
function messageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
onMounted(() => {
  window.addEventListener('auth-changed', onAuthChange);
  window.addEventListener('user-changed', onAuthChange);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onVisibility);
  document.addEventListener('visibilitychange', onVisibility);
  startSession();
});
onBeforeUnmount(() => {
  disposed = true;
  resetSession();
  sessionToken = null;
  window.removeEventListener('auth-changed', onAuthChange);
  window.removeEventListener('user-changed', onAuthChange);
  window.removeEventListener('storage', onStorage);
  window.removeEventListener('focus', onVisibility);
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<style scoped>
button,
input,
textarea {
  font: inherit;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}
h1,
h2,
p {
  margin: 0;
}
.conversation-header p {
  margin-top: 5px;
  color: var(--theme-muted);
}
.account-state {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  font-size: 13px;
  min-width: 0;
  max-width: min(38vw, 200px);
}
.current-user {
  font-weight: 600;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-state {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.connection-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-warning);
}
.connection-state.connected i {
  background: var(--el-color-success);
}
.connection-state.expired i {
  background: var(--el-color-danger);
}
.notice {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 10px;
  color: var(--theme-text);
  background: var(--el-color-warning-light-9);
  font-size: 13px;
  max-height: min(96px, 18vh);
  overflow-y: auto;
  overflow-wrap: anywhere;
}
.notice > span {
  min-width: 0;
}
.notice > button {
  flex-shrink: 0;
}
.chat-layout {
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.conversation-sidebar {
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border-right: 1px solid var(--el-border-color-lighter);
}
.sidebar-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 18px 16px;
}
.sidebar-top h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}
.total-unread {
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
  font-weight: 400;
}
.user-search {
  display: flex;
  align-items: center;
  margin: 0 14px 14px;
  gap: 6px;
}
.search-results {
  flex-shrink: 0;
  max-height: 40%;
  overflow: auto;
  padding: 0 12px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.section-caption {
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
  padding: 0 8px 8px;
}
.empty-caption,
.inline-error {
  padding: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--theme-muted);
}
.inline-error {
  color: var(--el-color-danger);
}
.search-result {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  background: transparent;
  border: 0;
  border-radius: 9px;
  color: var(--theme-text);
  padding: 9px 8px;
  text-align: left;
}
.search-result:hover,
.conversation-item:hover {
  background: var(--el-fill-color-light);
}
.search-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--app-font-body-size);
  white-space: nowrap;
}
.start-label {
  flex-shrink: 0;
  font-size: var(--app-font-caption-size);
  color: var(--el-color-primary);
}
.conversation-list {
  overflow-y: auto;
  min-height: 0;
  padding: 4px 9px 12px;
}
.sidebar-empty {
  text-align: center;
  padding: 36px 15px;
  color: var(--theme-muted);
  font-size: 13px;
  line-height: 1.8;
}
.sidebar-empty span {
  font-size: var(--app-font-caption-size);
}
.conversation-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 10px;
  width: 100%;
  border: 0;
  border-radius: 9px;
  text-align: left;
  background: transparent;
  color: var(--theme-text);
  margin-bottom: 4px;
}
.conversation-item.selected {
  background: var(--el-color-primary-light-9);
}
.avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 39px;
  height: 39px;
  border-radius: 13px;
  background: var(--el-fill-color);
  color: var(--el-color-primary);
  font-weight: 600;
  font-size: 15px;
}
.conversation-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.conversation-name {
  font-size: var(--app-font-body-size);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.last-message {
  font-size: var(--app-font-caption-size);
  color: var(--theme-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-height: 37px;
}
.conversation-meta time {
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.unread-badge {
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  box-sizing: border-box;
  line-height: 17px;
  text-align: center;
  border-radius: 9px;
  background: var(--el-color-primary);
  color: var(--el-color-white, #fff);
  font-size: var(--app-font-caption-size);
}
.conversation-panel {
  background: var(--el-fill-color-lighter);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  position: relative;
}
.conversation-header {
  background: var(--el-bg-color);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding: 16px 24px;
}
.conversation-header h2 {
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-header > div {
  min-width: 0;
}
.conversation-header .avatar {
  width: 35px;
  height: 35px;
  border-radius: 11px;
}
.mobile-back {
  display: none;
}
.message-scroll-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}
.message-list {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 28px;
  overscroll-behavior: contain;
}
.messages-placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 100px;
  gap: 14px;
  text-align: center;
  color: var(--theme-muted);
  font-size: 13px;
}
.empty-symbol {
  font-size: 32px;
  color: var(--el-color-primary-light-5);
}
.history-control {
  text-align: center;
  margin-bottom: 18px;
}
.history-start {
  text-align: center;
  font-size: var(--app-font-caption-size);
  color: var(--theme-muted);
  margin: 8px 0 22px;
}
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 20px;
}
.message-row.mine {
  flex-direction: row-reverse;
}
.message-avatar {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  font-size: 12px;
}
.message-content {
  max-width: min(75%, 640px);
  min-width: 0;
}
.message-bubble {
  padding: 11px 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 0 12px 12px;
  color: var(--theme-text);
  font-size: var(--app-font-body-size);
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.mine .message-bubble {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-8);
  border-radius: 12px 0 12px 12px;
}
.message-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 6px;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.message-meta .text-button {
  font-size: var(--app-font-caption-size);
  padding: 0;
}
.mine .message-meta {
  justify-content: flex-end;
}
.send-error,
.message-error {
  color: var(--el-color-danger);
}
.message-error {
  font-size: var(--app-font-caption-size);
  margin-top: 5px;
}
.latest-button {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  white-space: nowrap;
}
.composer {
  background: var(--el-bg-color);
  flex-shrink: 0;
  padding: 12px 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.composer textarea {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  height: clamp(48px, calc(var(--app-height, 100dvh) * 0.11), 96px);
  display: block;
}
.composer-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 9px;
}
.keyboard-hint,
.character-count {
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.character-count {
  margin-left: auto;
}
.at-limit {
  color: var(--el-color-warning);
}
.welcome-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 36px;
  text-align: center;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-wrap: anywhere;
}
.welcome-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 74px;
  height: 74px;
  background: var(--el-color-primary-light-9);
  border-radius: 25px;
  font-size: 38px;
  color: var(--el-color-primary);
  margin-bottom: 25px;
}
.welcome-state h2 {
  font-size: 16px;
  font-weight: 600;
}
.welcome-state p {
  margin-top: 13px;
  color: var(--theme-muted);
  font-size: 12px;
  line-height: 1.8;
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
.user-search:focus-within {
  border-color: var(--el-color-primary);
}
.message-list,
.conversation-list,
.search-results {
  scrollbar-width: none;
}
.message-list::-webkit-scrollbar,
.conversation-list::-webkit-scrollbar,
.search-results::-webkit-scrollbar {
  display: none;
}
@media (max-width: 1000px) {
  .chat-layout {
    grid-template-columns: 270px minmax(0, 1fr);
  }
  .message-list {
    padding: 18px;
  }
  .keyboard-hint {
    display: none;
  }
}
@media (max-width: 760px) {
  .current-user {
    max-width: min(100px, 28vw);
    font-size: var(--app-font-caption-size);
  }
  .connection-state {
    font-size: var(--app-font-caption-size);
  }
  .chat-layout {
    display: flex;
  }
  .conversation-sidebar {
    width: 100%;
    border-right: 0;
  }
  .conversation-panel {
    display: none;
  }
  .conversation-open .conversation-sidebar {
    display: none;
  }
  .conversation-open .conversation-panel {
    display: flex;
    width: 100%;
  }
  .conversation-header {
    padding: 13px 15px;
    gap: 10px;
  }
  .mobile-back {
    display: inline-flex;
  }
  .message-list {
    padding: 16px 12px;
  }
  .message-content {
    max-width: 79%;
  }
  .message-row {
    gap: 7px;
  }
  .message-avatar {
    width: 25px;
    height: 25px;
    border-radius: 8px;
  }
  .message-bubble {
    padding: 9px 11px;
  }
  .composer {
    padding: 12px 14px max(12px, env(safe-area-inset-bottom));
  }
  .user-search input,
  .composer textarea {
    font-size: 16px;
  }
}
@media (max-height: 500px) {
  .page-title p,
  .conversation-header p {
    display: none;
  }
  .conversation-header {
    padding: 8px 12px;
  }
  .sidebar-top {
    padding: 12px 16px;
  }
  .user-search {
    margin-bottom: 10px;
    padding-block: 4px;
  }
  .message-list {
    padding: 12px;
  }
  .composer {
    padding: 8px 12px;
  }
  .composer textarea {
    height: 40px;
  }
  .composer-footer {
    margin-top: 4px;
  }
  .composer .button {
    padding-block: 0;
  }
  .welcome-state {
    padding: 16px;
  }
  .welcome-icon {
    display: none;
  }
}
.user-search .app-input {
  width: 100%;
}
.message-meta .text-button {
  min-height: auto;
}
</style>
