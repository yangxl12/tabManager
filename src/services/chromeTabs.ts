/** chrome.tabs 封装 */
import type { TabItem } from '@/lib/types';
import { pickNewTabSurvivor } from '@/lib/tabDedupe';
import { isInternalUrl } from '@/lib/url';

export function toTabItem(t: chrome.tabs.Tab): TabItem {
  return {
    id: t.id ?? -1,
    windowId: t.windowId ?? -1,
    index: t.index ?? 0,
    title: t.title || t.url || '新标签页',
    url: t.url || '',
    favIconUrl: t.favIconUrl,
    active: !!t.active,
    pinned: !!t.pinned,
  };
}

const QUERY: chrome.tabs.QueryInfo = {};

export async function queryTabs(): Promise<TabItem[]> {
  const list = await chrome.tabs.query(QUERY);
  return list
    .filter((t) => typeof t.id === 'number' && t.id >= 0)
    .map(toTabItem)
    .sort((a, b) => (a.windowId === b.windowId ? a.index - b.index : a.windowId - b.windowId));
}

/** 单个窗口内的标签，按真实 index 排序（chrome.tabs.move 的坐标系） */
export async function queryTabsInWindow(windowId: number): Promise<TabItem[]> {
  const list = await chrome.tabs.query({ windowId });
  return list
    .filter((t) => typeof t.id === 'number' && t.id >= 0)
    .map(toTabItem)
    .sort((a, b) => a.index - b.index);
}

export async function getTab(id: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await chrome.tabs.get(id);
  } catch {
    return undefined;
  }
}

export async function createTab(url: string, active = true): Promise<void> {
  if (!url || isInternalUrl(url)) return;
  await chrome.tabs.create({ url, active });
}

export async function closeTabs(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await chrome.tabs.remove(ids);
}

export async function moveTab(id: number, index: number): Promise<void> {
  await chrome.tabs.move(id, { index });
}

export async function activateTab(id: number): Promise<void> {
  await chrome.tabs.update(id, { active: true });
}

export async function focusWindow(windowId: number): Promise<void> {
  try {
    await chrome.windows.update(windowId, { focused: true });
  } catch {
    /* 忽略 */
  }
}

/** 本扩展页面的 URL 前缀（chrome-extension://<id>/）；非扩展环境返回 '' */
export function extensionUrlPrefix(): string {
  try {
    return chrome.runtime?.getURL ? chrome.runtime.getURL('') : '';
  } catch {
    return '';
  }
}

/**
 * 是否本扩展自己的页面（新标签页覆盖页等）。
 * `chrome.tabs.getCurrent()` 在某些时机拿不到 id，只靠 id 过滤会漏，
 * 所以这里用 URL 前缀兜底 —— 双保险才不会再把自己的新标签页列进卡片。
 */
export function isSelfExtensionUrl(url: string): boolean {
  const prefix = extensionUrlPrefix();
  return !!prefix && !!url && url.startsWith(prefix);
}

/** 是否应该从标签列表里隐藏自身标签页 */
export function isSelfTab(tab: { id: number; url: string }, selfTabId: number | null): boolean {
  return (selfTabId != null && tab.id === selfTabId) || isSelfExtensionUrl(tab.url);
}

/**
 * 本扩展新标签页入口的绝对地址（取自 manifest，别在别处再写一份路径）。
 * 取不到返回 ''。
 */
export function selfNewTabUrl(): string {
  try {
    const rel = chrome.runtime?.getManifest?.()?.chrome_url_overrides?.newtab;
    return rel ? chrome.runtime.getURL(rel) : '';
  } catch {
    return '';
  }
}

/**
 * 新标签页去重：同窗口里已经有 TabNest 页面时，让新建的这个自我了结，
 * 并把焦点交回已经打开的那个（不再越开越多）。
 *
 * 拦截「+」按钮没有 API，只能在页面自己被加载后自检，所以这里用
 * 「id 最小者留下」这种由数据决定的规则，避免多个页面互相关闭。
 *
 * 返回 true = 当前页面已经被关掉，调用方不要再渲染。
 */
export async function collapseDuplicateNewTab(): Promise<boolean> {
  try {
    const me = await chrome.tabs.getCurrent();
    if (!me || typeof me.id !== 'number' || typeof me.windowId !== 'number') return false;
    const list = await chrome.tabs.query({ windowId: me.windowId });
    const survivorId = pickNewTabSurvivor(
      list
        .filter((t) => typeof t.id === 'number')
        .map((t) => ({ id: t.id as number, url: t.url ?? '', windowId: t.windowId })),
      { id: me.id, windowId: me.windowId },
      // 自身地址的两个候选：当前页面地址（dev 下是 dev server 地址）+ manifest 里的入口地址
      [location.href, selfNewTabUrl()],
    );
    if (survivorId == null) return false;
    // 先把焦点交回去，再关自己：反过来的话焦点会先落到旁边一个无关标签上
    await chrome.tabs.update(survivorId, { active: true });
    await chrome.tabs.remove(me.id);
    return true;
  } catch {
    // 拿不到自身标签 / 关不掉时静默降级：多开一个页面总好过白屏
    return false;
  }
}
