import apiClient from './apiClient';

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface ManagedUsersPage {
  users: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
  adminCount: number;
}

export interface UpdateManagedUserResult {
  data: ManagedUser;
  requiresLogin: boolean;
  message: string;
}

export async function getManagedUsers(
  params: { keyword: string; page: number; pageSize: number },
  signal?: AbortSignal,
) {
  const response = await apiClient.get<{ data: ManagedUsersPage }>('/admin/users', {
    params,
    signal,
  });
  return response.data.data;
}

export async function updateManagedUser(
  id: number,
  input: Pick<ManagedUser, 'username' | 'email' | 'role'>,
) {
  const response = await apiClient.patch<UpdateManagedUserResult>(`/admin/users/${id}`, input);
  return response.data;
}

export async function resetManagedUserPassword(id: number, password: string) {
  const response = await apiClient.put<{
    data: { userId: number; requiresLogin: true };
    message: string;
  }>(`/admin/users/${id}/password`, { password });
  return response.data;
}
