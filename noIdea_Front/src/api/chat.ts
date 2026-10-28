import apiClient from './apiClient';

export interface ChatUser {
  id: number;
  username: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  clientMessageId: string;
  content: string;
  createdAt: string;
}

export interface ChatConversation {
  id: number;
  peer: ChatUser;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastReadMessageId: number;
  peerLastReadMessageId: number;
  updatedAt: string;
}

export interface ReadReceipt {
  conversationId: number;
  userId: number;
  lastReadMessageId: number;
}

export interface MessagePage {
  data: ChatMessage[];
  hasMore: boolean;
}

export async function searchChatUsers(keyword: string) {
  const response = await apiClient.get<{ data: ChatUser[] }>('/chat/users', {
    params: { keyword },
  });
  return response.data.data;
}

export async function createConversation(userId: number) {
  const response = await apiClient.post<{ data: ChatConversation }>('/chat/conversations', {
    userId,
  });
  return response.data.data;
}

export async function getConversations() {
  const response = await apiClient.get<{ data: ChatConversation[] }>('/chat/conversations');
  return response.data.data;
}

export async function getChatMessages(
  conversationId: number,
  params: { beforeId?: number; afterId?: number; limit?: number } = {},
) {
  const response = await apiClient.get<MessagePage>(
    `/chat/conversations/${conversationId}/messages`,
    { params: { limit: 50, ...params } },
  );
  return response.data;
}

export async function sendChatMessage(
  conversationId: number,
  message: { clientMessageId: string; content: string },
) {
  const response = await apiClient.post<{ data: ChatMessage }>(
    `/chat/conversations/${conversationId}/messages`,
    message,
  );
  return response.data.data;
}

export async function readConversation(conversationId: number, messageId: number) {
  const response = await apiClient.put<{ data: ReadReceipt }>(
    `/chat/conversations/${conversationId}/read`,
    { messageId },
  );
  return response.data.data;
}
