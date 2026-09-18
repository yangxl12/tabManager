/** chrome.storage.local 封装 + onChanged 广播 */

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
