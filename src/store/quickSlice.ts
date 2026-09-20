import { uid } from '@/lib/id';
import { t } from '@/lib/i18n';
import { collectQuickSites, sanitizeQuickSites } from '@/lib/quickSite';
import { KEYS, getLocalArray, setLocal } from '@/services/storage';
import type { QuickSite } from '@/lib/types';
import type { SliceCreator } from './slice';

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
  /** 批量加入（拖拽落点用）：按 URL 去重，自动补名，结果用 toast 反馈 */
  addQuickSites: (items: Array<{ name: string; url: string }>) => void;
  updateQuick: (id: string, name: string, url: string) => void;
  removeQuick: (id: string) => void;
  initQuick: () => Promise<void>;
}

export const createQuickSlice: SliceCreator<QuickSlice> = (set, get) => ({
  quickSites: DEFAULT_SITES.map((s) => ({ id: uid('q'), ...s })),
  quickLoaded: false,

  // 快捷访问不设数量上限：多了由用户自己删，别用软上限拦人（拖拽批量加入时尤其别扭）
  addQuick(name, url) {
    if (!name.trim() || !url.trim()) return;
    set((s) => {
      s.quickSites.push({ id: uid('q'), name: name.trim(), url: url.trim() });
    });
    void setLocal(KEYS.quickSites, get().quickSites);
  },

  addQuickSites(items) {
    const res = collectQuickSites(get().quickSites, items);
    if (res.add.length) {
      set((s) => {
        for (const it of res.add) s.quickSites.push({ id: uid('q'), ...it });
      });
      void setLocal(KEYS.quickSites, get().quickSites);
    }
    const skipped = res.dup + res.invalid;
    if (!res.add.length) {
      get().toast(t('quick.addNone'), { tone: 'warn' });
    } else if (skipped) {
      get().toast(t('quick.addedSkip', { n: res.add.length, s: skipped }));
    } else {
      get().toast(t('quick.added', { n: res.add.length }));
    }
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
    // 存储里非数组 / 条目残缺时按空表处理：空表 = 保留默认站点，与「没存过」表现一致
    const stored = sanitizeQuickSites(await getLocalArray<unknown>(KEYS.quickSites));
    set((s) => {
      if (stored.length) s.quickSites = stored;
      s.quickLoaded = true;
    });
  },
});
