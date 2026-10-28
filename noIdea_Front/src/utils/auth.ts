import type { AxiosInstance } from 'axios';

export interface CurrentUser {
  role: 'admin' | 'user';
  id: number;
  username: string;
  email: string;
}
export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: CurrentUser;
}
export const getToken = () => localStorage.getItem('token');
export function getCurrentUser(): CurrentUser | null {
  if (!getToken()) return null;
  try {
    const user: unknown = JSON.parse(localStorage.getItem('user') || 'null');
    if (
      user &&
      typeof user === 'object' &&
      'id' in user &&
      Number.isSafeInteger(user.id) &&
      'username' in user &&
      typeof user.username === 'string' &&
      user.username.trim() &&
      'email' in user &&
      typeof user.email === 'string' &&
      'role' in user &&
      (user.role === 'admin' || user.role === 'user')
    )
      return user as CurrentUser;
  } catch {
    /* The authenticated profile request repairs a missing or invalid cache. */
  }
  return null;
}
export function updateCurrentUser(user: CurrentUser, token: string) {
  if (getToken() !== token) return;
  const value = JSON.stringify(user);
  if (localStorage.getItem('user') === value) return;
  localStorage.setItem('user', value);
  window.dispatchEvent(new Event('user-changed'));
}
export function saveLogin(response: LoginResponse) {
  localStorage.setItem('token', response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
  localStorage.removeItem('isLoggedIn');
  window.dispatchEvent(new Event('auth-changed'));
}
export function clearLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isLoggedIn');
  window.dispatchEvent(new Event('auth-changed'));
}
export function configureAuth(client: AxiosInstance) {
  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const currentToken = getToken();
      if (
        error.response?.status === 401 &&
        currentToken &&
        error.config?.headers?.Authorization === `Bearer ${currentToken}`
      ) {
        clearLogin();
        // Reloading clears any in-memory data from the previous account.
        if (window.location.pathname !== '/') window.location.assign('/');
      }
      return Promise.reject(error);
    },
  );
}
