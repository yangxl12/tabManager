import { crushCards } from '@/lib/fx';
import { truncate } from '@/lib/colors';
import { movePlan } from '@/lib/bookmarkTree';
import { hostOf, isInternalUrl } from '@/lib/url';
import * as Tabs from '@/services/chromeTabs';
import { hasChromeApi } from '@/services/storage';
import type { TabItem } from '@/lib/types';
import type { SliceCreator } from './slice';

export interface TabsSlice {
  tabs: TabItem[];
  selfTabId: number | null;
  /** 新标签页自身所在窗口，标签列表只显示这个窗口 */
  selfWindowId: number | null;
  tabsReady: boolean;
  selectedTabs: number[];
  closingTabs: number[];
  lastTabIdx: number | null;

  initTabs: () => Promise<void>;
  syncTabs: () => Promise<void>;
  toggleTabSel: (
    id: number,
    mod?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
  ) => void;
  selectAllTabs: (ids: number[]) => void;
  clearTabSel: () => void;
  closeTabsByIds: (ids: number[]) => Promise<void>;
  openTab: (url: string) => Promise<void>;
  activateTab: (id: number) => Promise<void>;
  reorderTabs: (desiredIds: number[]) => Promise<void>;
}

let syncTimer: number | null = null;

function debouncedSync(run: () => void, ms = 70) {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    run();
  }, ms);
}

/**
 * chrome.tabs.move 的 index 位于「当前窗口完整标签序列（含新标签页自身）」，
 * 而 store.tabs 里没有自身。自身不在末尾时，直接套用列表坐标会整体错位
 * ——「往后拖一格」恰好被抵消，表现为拖了没反应。
 * 这里把目标顺序映射回完整序列，再重算移动计划。
 */
async function moveStepsOnChrome(
  selfId: number | null,
  desiredIds: number[],
  fallback: Array<{ id: number; index: number }>,
): Promise<Array<{ id: number; index: number }>> {
  if (selfId == null) return fallback;
  try {
    const self = await Tabs.getTab(selfId);
    if (!self || typeof self.windowId !== 'number') return fallback;
    const full = await Tabs.queryTabsInWindow(self.windowId);
    if (!full.some((t) => t.id === selfId)) return fallback;
    // 「透明标签」= 本扩展自己的页面（当前这个新标签页 + 其他新标签页），卡片里不显示它们。
    // 它们占着真实 index，重排时必须原地不动，只有其余标签按目标顺序填充 ——
    // 否则 store 坐标与窗口真实坐标整体错位，表现为拖了没反应或顺序乱。
    const visible = full.filter((t) => !Tabs.isSelfTab(t, selfId));
    if (visible.length !== desiredIds.length) return fallback;
    const pool = new Set(visible.map((t) => t.id));
    if (!desiredIds.every((id) => pool.has(id))) return fallback;
    const queue = [...desiredIds];
    const target = full.map((t) => (Tabs.isSelfTab(t, selfId) ? t.id : (queue.shift() as number)));
    return movePlan(
      full.map((t) => t.id),
      target,
    );
  } catch {
    return fallback;
  }
}

export const createTabsSlice: SliceCreator<TabsSlice> = (set, get) => {
  const scheduleSync = () => debouncedSync(() => void get().syncTabs());

  return {
    tabs: [],
    selfTabId: null,
    selfWindowId: null,
    tabsReady: false,
    selectedTabs: [],
    closingTabs: [],
    lastTabIdx: null,

    async initTabs() {
      if (!hasChromeApi()) {
        set((s) => void (s.tabsReady = true));
        return;
      }
      try {
        const current = await chrome.tabs.getCurrent();
        set((s) => {
          s.selfTabId = current?.id ?? null;
          s.selfWindowId = typeof current?.windowId === 'number' ? current.windowId : null;
        });
      } catch {
        set((s) => {
          s.selfTabId = null;
          s.selfWindowId = null;
        });
      }
      await get().syncTabs();
      set((s) => void (s.tabsReady = true));

      chrome.tabs.onCreated.addListener((tab) => {
        const item = Tabs.toTabItem(tab);
        if (item.id < 0 || Tabs.isSelfTab(item, get().selfTabId)) return;
        const winId = get().selfWindowId;
        if (winId != null && item.windowId !== winId) return;
        set((s) => {
          if (s.tabs.some((t) => t.id === item.id)) return;
          s.tabs.push(item);
          s.tabs.sort((a, b) => a.index - b.index);
        });
        // 新项的 index 是真实的，但列表里其他项的 index 可能已经陈旧
        // （关闭过标签、有被过滤掉的隐形标签时尤其明显），拉一次全量校正顺序
        scheduleSync();
      });

      chrome.tabs.onRemoved.addListener((id) => {
        set((s) => {
          s.tabs = s.tabs.filter((t) => t.id !== id);
          s.selectedTabs = s.selectedTabs.filter((x) => x !== id);
          s.closingTabs = s.closingTabs.filter((x) => x !== id);
        });
      });

      chrome.tabs.onUpdated.addListener((id, info, tab) => {
        if (info.status && info.status !== 'complete' && !info.title && !info.url) return;
        const item = Tabs.toTabItem(tab);
        set((s) => {
          const t = s.tabs.find((x) => x.id === id);
          if (!t) {
            if (Tabs.isSelfTab(item, get().selfTabId)) return;
            const winId = get().selfWindowId;
            if (winId != null && item.windowId !== winId) return;
            s.tabs.push(item);
            s.tabs.sort((a, b) => a.index - b.index);
            return;
          }
          t.title = item.title;
          t.url = item.url;
          t.favIconUrl = item.favIconUrl;
          t.active = item.active;
        });
      });

      chrome.tabs.onMoved.addListener(() => scheduleSync());
      chrome.tabs.onReplaced.addListener(() => scheduleSync());
      chrome.tabs.onAttached.addListener(() => scheduleSync());
      chrome.tabs.onDetached.addListener(() => scheduleSync());
      chrome.tabs.onActivated.addListener((info) => {
        set((s) => {
          for (const t of s.tabs) t.active = t.id === info.tabId;
        });
      });
    },

    async syncTabs() {
      if (!hasChromeApi()) return;
      const selfId = get().selfTabId;
      const winId = get().selfWindowId;
      const list = winId == null ? await Tabs.queryTabs() : await Tabs.queryTabsInWindow(winId);
      set((s) => {
        // 自身标签页（本扩展的新标签页）永远不列出来
        s.tabs = list.filter((t) => !Tabs.isSelfTab(t, selfId));
        s.selectedTabs = s.selectedTabs.filter((id) => s.tabs.some((t) => t.id === id));
        s.closingTabs = s.tabs.filter((t) => s.closingTabs.includes(t.id)).map((t) => t.id);
      });
    },

    toggleTabSel(id, mod) {
      const list = get().tabs;
      const idx = list.findIndex((t) => t.id === id);
      set((s) => {
        if (mod?.shiftKey && s.lastTabIdx != null && s.lastTabIdx >= 0 && idx >= 0) {
          const a = Math.min(s.lastTabIdx, idx);
          const b = Math.max(s.lastTabIdx, idx);
          for (let i = a; i <= b; i++) {
            const tid = list[i]?.id;
            if (tid != null && !s.selectedTabs.includes(tid)) s.selectedTabs.push(tid);
          }
          s.lastTabIdx = idx;
          return;
        }
        const at = s.selectedTabs.indexOf(id);
        if (at > -1) s.selectedTabs.splice(at, 1);
        else s.selectedTabs.push(id);
        s.lastTabIdx = idx >= 0 ? idx : null;
      });
    },

    selectAllTabs(ids) {
      set((s) => {
        s.selectedTabs = [...ids];
        s.lastTabIdx = null;
      });
    },

    clearTabSel() {
      set((s) => {
        s.selectedTabs = [];
        s.lastTabIdx = null;
      });
    },

    async closeTabsByIds(ids) {
      const state = get();
      const valid = ids.filter((id) => state.tabs.some((t) => t.id === id));
      if (!valid.length) return;

      const cards = valid
        .map((id) => document.querySelector<HTMLElement>(`[data-tab-card="${id}"]`))
        .filter((el): el is HTMLElement => !!el);
      const colorOf = (el: HTMLElement) => el.getAttribute('data-color') || '#2C6FDB';
      const wait = crushCards(cards, colorOf);

      const first = state.tabs.find((t) => t.id === valid[0]);
      const count = valid.length;
      const singleTitle = truncate(first?.title || '', 16);

      set((s) => {
        for (const id of valid) if (!s.closingTabs.includes(id)) s.closingTabs.push(id);
      });

      window.setTimeout(() => {
        void Tabs.closeTabs(valid)
          .then(() => {
            set((s) => {
              s.selectedTabs = s.selectedTabs.filter((id) => !valid.includes(id));
            });
            get().toast(
              count === 1 ? `已关闭标签「${singleTitle}」` : `已关闭 ${count} 个标签`,
            );
          })
          .catch((err: Error) => {
            set((s) => {
              s.closingTabs = s.closingTabs.filter((id) => !valid.includes(id));
            });
            get().toast(`关闭失败：${err.message}`, { tone: 'warn' });
          });
      }, wait || 10);
    },

    async openTab(url) {
      if (!url) return;
      if (isInternalUrl(url)) {
        get().toast('浏览器内部页面无法通过插件打开', { tone: 'warn' });
        return;
      }
      try {
        await Tabs.createTab(url, true);
      } catch (err) {
        get().toast(`打开失败：${(err as Error).message}`, { tone: 'warn' });
      }
    },

    async activateTab(id) {
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab) return;
      try {
        await Tabs.activateTab(id);
        await Tabs.focusWindow(tab.windowId);
      } catch {
        /* 忽略 */
      }
    },

    async reorderTabs(desiredIds) {
      const before = get().tabs.map((t) => t.id);
      if (before.length !== desiredIds.length) return;
      const plan = movePlan(before, desiredIds);
      if (!plan.length) return;

      // 乐观更新
      set((s) => {
        const map = new Map(s.tabs.map((t) => [t.id, t]));
        s.tabs = desiredIds.map((id) => map.get(id)!).filter(Boolean);
        s.tabs.forEach((t, i) => void (t.index = i));
      });

      try {
        const steps = await moveStepsOnChrome(get().selfTabId, desiredIds, plan);
        for (const step of steps) await Tabs.moveTab(step.id, step.index);
      } catch (err) {
        get().toast(`排序失败，已回滚：${(err as Error).message}`, { tone: 'warn' });
        await get().syncTabs();
      }
    },
  };
};

export function tabSeed(t: TabItem): string {
  return hostOf(t.url) || t.title || '?';
}
