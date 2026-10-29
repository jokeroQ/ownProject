import apiClient from './apiClient';
import type { ApiResponse } from '@/utils/types';
export type TodoRecurrence = 'none' | 'daily' | 'weekly';
export type TodoRecurrenceFilter = 'all' | TodoRecurrence;
export interface Todo {
  id: number;
  title: string;
  notes: string;
  recurrence: TodoRecurrence;
  periodKey: string | null;
  dueDate: string | null;
  important: boolean;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type TodoInput = Pick<Todo, 'title' | 'notes' | 'dueDate' | 'important' | 'recurrence'>;
export type TodoStatus = 'all' | 'open' | 'done';
export interface TodoQuery {
  status: TodoStatus;
  recurrence: TodoRecurrenceFilter;
  keyword: string;
  sort: 'recent' | 'due' | 'important';
  page: number;
}
export interface TodoPage {
  items: Todo[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  counts: Record<TodoStatus, number>;
  recurrenceCounts: Record<TodoRecurrenceFilter, Record<TodoStatus, number>>;
  clearableCount: number;
  calendar: {
    today: string;
    weekStart: string;
    timeZone: string;
    serverNow: string;
    nextResetAt: string;
  };
}
export const getTodos = async (query: TodoQuery, signal: AbortSignal) =>
  (await apiClient.get<ApiResponse<TodoPage>>('/todos', { params: query, signal })).data.data;
export const createTodo = async (input: TodoInput) =>
  (await apiClient.post<ApiResponse<Todo>>('/todos', input)).data.data;
export const updateTodo = async (
  id: number,
  input: Partial<TodoInput & Pick<Todo, 'completed' | 'periodKey'>>,
) => (await apiClient.patch<ApiResponse<Todo>>(`/todos/${id}`, input)).data.data;
export const deleteTodo = async (id: number) =>
  (await apiClient.delete<ApiResponse<{ id: number }>>(`/todos/${id}`)).data.data;
export const clearCompletedTodos = async () =>
  (await apiClient.delete<ApiResponse<{ removed: number }>>('/todos/completed')).data.data;
