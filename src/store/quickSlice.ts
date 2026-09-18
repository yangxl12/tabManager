import { uid } from '@/lib/id';
import { KEYS, getLocal, setLocal } from '@/services/storage';
import type { QuickSite } from '@/lib/types';
import type { SliceCreator } from './slice';

/** 快捷站点软上限 */
export const QUICK_LIMIT = 16;

const DEFAULT_SITES: Array<{ name: string; url: string }> = [
  { name: '百度', url: 'https://www.baidu.com' },
  { name: '哔哩哔哩', url: 'https://www.bilibili.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: '知乎', url: 'https://www.zhihu.com' },
  { name: '掘金', url: 'https://juejin.cn' },
  { name: '微博', url: 'https://weibo.com' },
  { name: '淘宝', url: 'https://www.taobao.com' },
  { name: 'ChatGPT', url: 'https://chat.openai.com' },
];

export interface QuickSlice {
  quickSites: QuickSite[];
  quickLoaded: boolean;
  addQuick: (name: string, url: string) => void;
  updateQuick: (id: string, name: string, url: string) => void;
  removeQuick: (id: string) => void;
  initQuick: () => Promise<void>;
}

export const createQuickSlice: SliceCreator<QuickSlice> = (set, get) => ({
  quickSites: DEFAULT_SITES.map((s) => ({ id: uid('q'), ...s })),
  quickLoaded: false,

  addQuick(name, url) {
    if (!name.trim() || !url.trim()) return;
    if (get().quickSites.length >= QUICK_LIMIT) {
      get().toast(`快捷站点最多 ${QUICK_LIMIT} 个，先删掉一些再添加`, { tone: 'warn' });
      return;
    }
    set((s) => {
      s.quickSites.push({ id: uid('q'), name: name.trim(), url: url.trim() });
    });
    void setLocal(KEYS.quickSites, get().quickSites);
  },

  updateQuick(id, name, url) {
    set((s) => {
      const item = s.quickSites.find((q) => q.id === id);
      if (item) {
        item.name = name.trim();
        item.url = url.trim();
      }
    });
    void setLocal(KEYS.quickSites, get().quickSites);
  },

  removeQuick(id) {
    set((s) => {
      s.quickSites = s.quickSites.filter((q) => q.id !== id);
    });
    void setLocal(KEYS.quickSites, get().quickSites);
  },

  async initQuick() {
    const stored = await getLocal<QuickSite[] | null>(KEYS.quickSites, null);
    set((s) => {
      if (Array.isArray(stored) && stored.length) s.quickSites = stored;
      s.quickLoaded = true;
    });
  },
});
