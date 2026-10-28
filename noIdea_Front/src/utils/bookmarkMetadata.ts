import type { Router } from 'vue-router';

export const bookmarkInitial = (name: string) => Array.from(name.trim())[0] || '?';
export const isTextBookmarkIcon = (icon: string) => Array.from(icon.trim()).length === 1;

export function resolveBookmarkTarget(value: string, router: Router, origin: string) {
  const input = value.trim();
  if (!input) throw new Error('请先输入目标网址或站内路由地址');
  if (input.startsWith('//') || (!input.startsWith('/') && !/^https?:\/\//i.test(input)))
    throw new Error('请输入 /chat 这样的站内路由，或完整的 http(s) 网址');
  let url: URL;
  try {
    url = new URL(input, origin);
  } catch {
    throw new Error('目标地址格式不正确');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('请输入不含账号密码的 http(s) 网址');
  if (input.startsWith('/') && url.origin !== origin) throw new Error('站内路由地址格式不正确');
  if (url.origin === origin) {
    const route = router.resolve(url.pathname + url.search + url.hash);
    const title = typeof route.meta.title === 'string' ? route.meta.title.trim() : '';
    const name = typeof route.name === 'string' ? route.name.trim() : '';
    return { internal: true, title: route.matched.length ? title || name : '', url: url.href };
  }
  url.hash = '';
  return { internal: false, title: '', url: url.href };
}
