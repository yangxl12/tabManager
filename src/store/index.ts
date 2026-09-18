import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { KEYS, subscribeLocal } from '@/services/storage';
import { normalizeTheme } from '@/lib/theme';
import { normalizeLang, setLangMirror, t } from '@/lib/i18n';
import type { QuickSite } from '@/lib/types';
import { createBookmarksSlice, type BookmarksSlice } from './bookmarksSlice';
import { QUICK_LIMIT, createQuickSlice, type QuickSlice } from './quickSlice';
import { createTabsSlice, type TabsSlice } from './tabsSlice';
import { createUiSlice, type UiSlice } from './uiSlice';

export { QUICK_LIMIT };

/** 组件里的 t()：订阅 s.lang，切语言时触发重渲染（非 React 代码直接用 lib/i18n 的 t） */
export function useT() {
  useStore((s) => s.lang);
  return t;
}

export type Store = UiSlice & TabsSlice & BookmarksSlice & QuickSlice;

export const useStore = create<Store>()(
  immer((...a) => ({
    ...createUiSlice(...a),
    ...createTabsSlice(...a),
    ...createBookmarksSlice(...a),
    ...createQuickSlice(...a),
  })),
);

// dev 下挂到 window，方便在浏览器控制台/自动化脚本里直接查状态
// （带 typeof 判定：模块要能在没有 DOM 的环境里被 import，例如 vitest 的 node 环境）
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __tabnest: unknown }).__tabnest = useStore;
}

let booted = false;

export async function bootstrapStore(): Promise<void> {
  if (booted) return;
  booted = true;
  const s = useStore.getState();
  await Promise.all([s.initUi(), s.initQuick()]);
  await Promise.all([s.initTabs(), s.initBookmarks()]);

  // 多开新标签页时保持同步
  subscribeLocal((changes) => {
    if (changes[KEYS.quickSites]) {
      const next = changes[KEYS.quickSites].newValue as QuickSite[] | undefined;
      if (Array.isArray(next)) useStore.setState((st) => void (st.quickSites = next));
    }
    if (changes[KEYS.collapsed]) {
      const next = changes[KEYS.collapsed].newValue as string[] | undefined;
      if (Array.isArray(next)) useStore.setState((st) => void (st.collapsed = next));
    }
    if (changes[KEYS.helpOpen]) {
      const next = changes[KEYS.helpOpen].newValue as boolean | undefined;
      if (typeof next === 'boolean') useStore.setState((st) => void (st.helpOpen = next));
    }
    if (changes[KEYS.theme]) {
      const next = normalizeTheme(changes[KEYS.theme].newValue);
      useStore.setState((st) => void (st.theme = next));
    }
    if (changes[KEYS.lang]) {
      const next = normalizeLang(changes[KEYS.lang].newValue);
      useStore.setState((st) => void (st.lang = next));
      setLangMirror(next);
    }
  });
}
