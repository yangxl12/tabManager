/** chrome.storage.local 封装 + onChanged 广播 */
import { asArray } from '@/lib/validate';

/** chrome 扩展 API 是否可用（用纯浏览器打开 dev server 时为 false，仅渲染空壳） */
export function hasChromeApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome.storage &&
    !!chrome.tabs &&
    !!chrome.bookmarks
  );
}

export async function getLocal<T>(key: string, fallback: T): Promise<T> {
  if (!hasChromeApi()) return fallback;
  try {
    const res = await chrome.storage.local.get(key);
    const v = res[key] as T | undefined;
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

/**
 * 读数组型偏好。存储里可能是任何东西（旧版本形状 / 被手动改过 / 环境写坏），
 * 非数组一律回落到 fallback —— 绝不能让 `.filter` 之类的调用炸在初始化路径上。
 */
export async function getLocalArray<T>(key: string, fallback: T[] = []): Promise<T[]> {
  return asArray<T>(await getLocal<unknown>(key, fallback), fallback);
}

export async function setLocal(key: string, value: unknown): Promise<void> {
  if (!hasChromeApi()) return;
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch {
    /* 忽略写入失败（例如配额） */
  }
}

export const KEYS = {
  quickSites: 'tabnest.quickSites',
  collapsed: 'tabnest.collapsedFolders',
  currentFolder: 'tabnest.currentFolder',
  panelWidth: 'tabnest.panelWidth',
  helpOpen: 'tabnest.helpOpen',
  /** 主题模式；与 localStorage 镜像同一 key，见 lib/theme.ts */
  theme: 'tabnest.theme',
} as const;

export function subscribeLocal(
  handler: (changes: Record<string, chrome.storage.StorageChange>) => void,
): () => void {
  if (!hasChromeApi()) return () => {};
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local') handler(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
