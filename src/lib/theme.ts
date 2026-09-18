/** 主题（明亮 / 暗黑 / 跟随系统）—— 纯逻辑，不 import chrome / React */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** 菜单里的展示顺序 */
export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

export const THEME_LABEL: Record<ThemeMode, string> = {
  light: '明亮',
  dark: '暗黑',
  system: '跟随系统',
};

/**
 * localStorage 镜像 key（与 services/storage.ts 的 KEYS.theme 同名）。
 * 真源是 chrome.storage.local —— 但它是异步的，React 首次渲染时还没回来，
 * 那一帧会先按「跟随系统」画，用户上次选的「暗黑」就会闪一下。
 * 这里镜像一份同步可读的值，专门喂给 store 的初始 state。
 * （首屏更早的那一帧由 CSS 的 @media (prefers-color-scheme: dark) 兜底，见 styles/theme.css）
 */
export const THEME_MIRROR_KEY = 'tabnest.theme';

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** 非法值（含 null / undefined）一律回落到跟随系统 */
export function normalizeTheme(v: unknown): ThemeMode {
  return isThemeMode(v) ? v : 'system';
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean = systemPrefersDark()): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

/** 读镜像（localStorage 不可用时按跟随系统处理） */
export function readMirrorTheme(): ThemeMode {
  try {
    return normalizeTheme(localStorage.getItem(THEME_MIRROR_KEY));
  } catch {
    return 'system';
  }
}

/**
 * 把主题写到 <html>：data-theme 驱动 CSS，data-theme-mode 给「首屏兜底」那条
 * 媒体查询当开关（选了明亮就不许它插手），顺便刷新 localStorage 镜像。
 */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document !== 'undefined') {
    const el = document.documentElement;
    el.dataset.theme = resolved;
    el.dataset.themeMode = mode;
  }
  try {
    localStorage.setItem(THEME_MIRROR_KEY, mode);
  } catch {
    /* 无 localStorage / 配额满，忽略 */
  }
  return resolved;
}
