import { reactive } from 'vue';
import apiClient from '@/api/apiClient';
import { getToken } from '@/utils/auth';

export interface ColorCard {
  label: string;
  variable: string;
  light?: string;
  dark?: string;
}
export interface ThemeSettings {
  colorCards?: ColorCard[];
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
  colorCards: [],
});
export const defaultThemeSettings = defaults;
export const themeState = reactive({
  settings: defaults(),
  backgroundUrl: '',
  loading: false,
  error: '',
});
let generation = 0;
const appliedColorVariables = new Set<string>();
const colorAliases: Record<string, string[]> = {
  '--background-main': ['--theme-page', '--el-bg-color-page'],
  '--font-primary': ['--theme-text', '--el-text-color-primary', '--el-text-color-regular'],
  '--font-highlight': ['--ui-accent-text'],
};
const mix = (color: string, target: number, amount: number) => {
  const rgb = [1, 3, 5].map((start) =>
    Math.round(parseInt(color.slice(start, start + 2), 16) * (1 - amount) + target * amount),
  );
  return '#' + rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('');
};
export function applyTheme(settings: ThemeSettings, backgroundUrl = themeState.backgroundUrl) {
  const root = document.documentElement;
  for (const name of appliedColorVariables) root.style.removeProperty(name);
  appliedColorVariables.clear();
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
  for (const card of settings.colorCards || []) {
    const value = card[settings.mode];
    if (value) {
      for (const variable of [card.variable, ...(colorAliases[card.variable] || [])]) {
        root.style.setProperty(variable, value);
        appliedColorVariables.add(variable);
      }
    }
  }
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
  const settings = response.data.data;
  let background: string | undefined;
  if (reloadImage && settings.hasBackground) {
    const image = await apiClient.get('/theme/background', { responseType: 'blob' });
    if (token !== getToken() || revision !== generation) throw new Error('登录状态已改变');
    background = URL.createObjectURL(image.data);
  } else if (!settings.hasBackground) background = '';
  themeState.settings = settings;
  themeState.error = '';
  if (background !== undefined) setBackground(background);
  applyTheme(themeState.settings);
}
export const saveTheme = (settings: ThemeSettings, background?: File | null) =>
  background instanceof File
    ? changeTheme(
        () =>
          apiClient.put('/theme/background', background, {
            params: { settings: JSON.stringify(settings) },
            headers: { 'Content-Type': background.type },
          }),
        true,
      )
    : changeTheme(() =>
        apiClient.put('/theme', {
          ...settings,
          ...(background === null ? { removeBackground: true } : {}),
        }),
      );
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
