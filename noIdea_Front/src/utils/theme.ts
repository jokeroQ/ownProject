import { reactive } from 'vue';
import apiClient from '@/api/apiClient';
import { getToken } from '@/utils/auth';

export interface ThemeSettings {
  mode: 'light' | 'dark';
  primaryColor: string;
  overlay: number;
  hasBackground: boolean;
}
const defaults = (): ThemeSettings => ({
  mode: 'light',
  primaryColor: '#409eff',
  overlay: 0.35,
  hasBackground: false,
});
export const themeState = reactive({
  settings: defaults(),
  backgroundUrl: '',
  loading: false,
  error: '',
});
let generation = 0;
const mix = (color: string, target: number, amount: number) => {
  const rgb = [1, 3, 5].map((start) =>
    Math.round(parseInt(color.slice(start, start + 2), 16) * (1 - amount) + target * amount),
  );
  return '#' + rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('');
};
export function applyTheme(settings: ThemeSettings, backgroundUrl = themeState.backgroundUrl) {
  const root = document.documentElement;
  root.dataset.theme = settings.mode;
  root.style.colorScheme = settings.mode;
  root.style.setProperty('--el-color-primary', settings.primaryColor);
  for (const level of [3, 5, 7, 8, 9]) {
    root.style.setProperty(
      `--el-color-primary-light-${level}`,
      mix(settings.primaryColor, settings.mode === 'dark' ? 20 : 255, level / 10),
    );
  }
  root.style.setProperty('--el-color-primary-dark-2', mix(settings.primaryColor, 0, 0.2));
  root.style.setProperty('--theme-overlay', String(settings.overlay));
  root.style.setProperty(
    '--theme-background-image',
    backgroundUrl ? `url("${backgroundUrl}")` : 'none',
  );
  root.dataset.hasBackground = String(Boolean(backgroundUrl));
}
function setBackground(url = '') {
  if (themeState.backgroundUrl) URL.revokeObjectURL(themeState.backgroundUrl);
  themeState.backgroundUrl = url;
}
function clearAppliedTheme() {
  setBackground();
  themeState.settings = defaults();
  themeState.error = '';
  applyTheme(themeState.settings);
}
export async function loadTheme() {
  const revision = ++generation;
  const token = getToken();
  clearAppliedTheme();
  if (!token) {
    themeState.loading = false;
    return;
  }
  themeState.loading = true;
  try {
    const result = await apiClient.get<{ data: ThemeSettings }>('/theme');
    if (revision !== generation || token !== getToken()) return;
    themeState.settings = result.data.data;
    if (themeState.settings.hasBackground) {
      try {
        const image = await apiClient.get('/theme/background', { responseType: 'blob' });
        if (revision !== generation || token !== getToken()) return;
        setBackground(URL.createObjectURL(image.data));
      } catch {
        if (revision === generation)
          themeState.error = '背景图片加载失败，可以重新上传或移除图片。';
      }
    }
    if (revision === generation) applyTheme(themeState.settings);
  } catch {
    if (revision === generation && token === getToken())
      themeState.error = '主题加载失败，请确认后端已升级，或点击重新加载。';
  } finally {
    if (revision === generation) themeState.loading = false;
  }
}
async function changeTheme(
  request: () => Promise<{ data: { data: ThemeSettings } }>,
  reloadImage = false,
) {
  const token = getToken();
  const revision = generation;
  const response = await request();
  if (!token || token !== getToken() || revision !== generation)
    throw new Error('登录状态已改变，请重新打开主题设置');
  themeState.settings = response.data.data;
  themeState.error = '';
  if (reloadImage && themeState.settings.hasBackground) {
    const image = await apiClient.get('/theme/background', { responseType: 'blob' });
    if (token !== getToken() || revision !== generation) throw new Error('登录状态已改变');
    setBackground(URL.createObjectURL(image.data));
  } else if (!themeState.settings.hasBackground) setBackground();
  applyTheme(themeState.settings);
}
export const saveTheme = (settings: ThemeSettings) =>
  changeTheme(() => apiClient.put('/theme', settings));
export const uploadBackground = (file: File) =>
  changeTheme(
    () =>
      apiClient.put('/theme/background', file, {
        headers: { 'Content-Type': file.type },
      }),
    true,
  );
export const removeBackground = () => changeTheme(() => apiClient.delete('/theme/background'));
export const resetTheme = () => changeTheme(() => apiClient.delete('/theme'));
