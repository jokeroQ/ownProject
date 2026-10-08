import type { AxiosInstance } from 'axios';

export interface CurrentUser { id: number; username: string; email: string }
export interface LoginResponse { token: string; expiresAt: string; user: CurrentUser }
export const getToken = () => localStorage.getItem('token');
export function saveLogin(response: LoginResponse) {
  localStorage.setItem('token', response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
  localStorage.removeItem('isLoggedIn');
}
export function clearLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isLoggedIn');
}
export function configureAuth(client: AxiosInstance) {
  client.interceptors.request.use(config => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  client.interceptors.response.use(response => response, error => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      clearLogin();
      // Reloading clears any in-memory data from the previous account.
      if (window.location.pathname !== '/') window.location.assign('/');
    }
    return Promise.reject(error);
  });
}
