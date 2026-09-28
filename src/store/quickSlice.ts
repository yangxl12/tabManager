import { uid } from '@/lib/id';
import { t } from '@/lib/i18n';
import { collectQuickSites, sanitizeQuickSites } from '@/lib/quickSite';
import { CURATED_QUICK_GROUPS, CURATED_QUICK_GROUP_IDS, FIRST_CURATED_SITE_URLS, RETIRED_CURATED_QUICK_GROUP_IDS } from '@/lib/curatedQuickSites';
import { KEYS, getLocal, getLocalArray, setLocal } from '@/services/storage';
import type { QuickGroup, QuickSite } from '@/lib/types';
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

export const DEFAULT_QUICK_GROUP_ID = 'default';

export function quickGroupOf(site: QuickSite): string {
  return site.groupId || DEFAULT_QUICK_GROUP_ID;
}

export function sanitizeQuickGroups(value: unknown): QuickGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const { id, name, hidden } = raw as { id?: unknown; name?: unknown; hidden?: unknown };
    if (typeof id !== 'string' || !id || id === DEFAULT_QUICK_GROUP_ID || seen.has(id)) return [];
    if (typeof name !== 'string' || !name.trim()) return [];
    seen.add(id);
    const curated = CURATED_QUICK_GROUPS.find((group) => group.id === id);
    return [{ id, name: curated?.name ?? name.trim().slice(0, 24), ...(hidden === true ? { hidden: true } : {}) }];
  });
}

/** 精选分类不允许删除；若旧存储中没有，则追加到原有分类之后。 */
export function ensureCuratedQuickGroups(groups: QuickGroup[]): QuickGroup[] {
  const kept = groups.filter((group) => !RETIRED_CURATED_QUICK_GROUP_IDS.has(group.id));
  const ids = new Set(kept.map((group) => group.id));
  return [
    ...kept,
    ...CURATED_QUICK_GROUPS.filter((group) => !ids.has(group.id)).map(({ id, name }) => ({ id, name })),
  ];
}

/** 已取消的精选分类及其他无效归属回到默认标签，保留用户站点。 */
export function rehomeQuickSites(sites: QuickSite[], groups: QuickGroup[]): QuickSite[] {
  const ids = new Set(groups.map((group) => group.id));
  return sites.map((site) => site.groupId && !ids.has(site.groupId)
    ? { ...site, groupId: DEFAULT_QUICK_GROUP_ID } : site);
}

export interface QuickSlice {
  quickSites: QuickSite[];
  quickGroups: QuickGroup[];
  activeQuickGroupId: string;
  quickLoaded: boolean;
  setActiveQuickGroup: (id: string) => void;
  addQuickGroup: (name: string) => void;
  renameQuickGroup: (id: string, name: string) => void;
  removeQuickGroup: (id: string) => void;
  setQuickGroupHidden: (id: string, hidden: boolean) => void;
  reorderQuickGroups: (desired: string[]) => void;
  addQuick: (name: string, url: string, groupId?: string) => void;
  /** 批量加入（拖拽落点用）：按 URL 去重，自动补名，结果用 toast 反馈 */
  addQuickSites: (items: Array<{ name: string; url: string }>, groupId?: string) => void;
  updateQuick: (id: string, name: string, url: string) => void;
  removeQuick: (id: string) => void;
  /** 拖拽排序：传「重排后的完整 id 顺序」，未列出的条目按原相对顺序追加在后 */
  reorderQuick: (desired: string[], groupId?: string) => void;
  initQuick: () => Promise<void>;
}

export const createQuickSlice: SliceCreator<QuickSlice> = (set, get) => ({
  quickSites: DEFAULT_SITES.map((s) => ({ id: uid('q'), ...s })),
  quickGroups: [],
  activeQuickGroupId: DEFAULT_QUICK_GROUP_ID,
  quickLoaded: false,

  setActiveQuickGroup(id) {
    if (id !== DEFAULT_QUICK_GROUP_ID && !get().quickGroups.some((g) => g.id === id && !g.hidden)) return;
    set((s) => { s.activeQuickGroupId = id; });
  },

  addQuickGroup(name) {
    const clean = name.trim().slice(0, 24);
    if (!clean || get().quickGroups.some((g) => g.name.toLowerCase() === clean.toLowerCase())) return;
    const id = uid('qg');
    set((s) => {
      s.quickGroups.push({ id, name: clean });
      s.activeQuickGroupId = id;
    });
    void setLocal(KEYS.quickGroups, get().quickGroups);
  },

  renameQuickGroup(id, name) {
    const clean = name.trim().slice(0, 24);
    if (!clean || id === DEFAULT_QUICK_GROUP_ID || CURATED_QUICK_GROUP_IDS.has(id)) return;
    if (get().quickGroups.some((g) => g.id !== id && g.name.toLowerCase() === clean.toLowerCase())) return;
    set((s) => {
      const group = s.quickGroups.find((g) => g.id === id);
      if (group) group.name = clean;
    });
    void setLocal(KEYS.quickGroups, get().quickGroups);
  },

  removeQuickGroup(id) {
    if (id === DEFAULT_QUICK_GROUP_ID || CURATED_QUICK_GROUP_IDS.has(id) || !get().quickGroups.some((g) => g.id === id)) return;
    set((s) => {
      s.quickGroups = s.quickGroups.filter((g) => g.id !== id);
      s.quickSites = s.quickSites.filter((q) => quickGroupOf(q) !== id);
      if (s.activeQuickGroupId === id) s.activeQuickGroupId = DEFAULT_QUICK_GROUP_ID;
    });
    void setLocal(KEYS.quickGroups, get().quickGroups);
    void setLocal(KEYS.quickSites, get().quickSites);
  },

  setQuickGroupHidden(id, hidden) {
    if (id === DEFAULT_QUICK_GROUP_ID || !get().quickGroups.some((g) => g.id === id)) return;
    set((s) => {
      const group = s.quickGroups.find((g) => g.id === id);
      if (group) group.hidden = hidden;
      if (hidden && s.activeQuickGroupId === id) s.activeQuickGroupId = DEFAULT_QUICK_GROUP_ID;
    });
    void setLocal(KEYS.quickGroups, get().quickGroups);
  },

  reorderQuickGroups(desired) {
    const groups = get().quickGroups;
    const byId = new Map(groups.map((group) => [group.id, group]));
    const seen = new Set<string>();
    const ordered: QuickGroup[] = [];
    for (const id of desired) {
      const group = byId.get(id);
      if (group && !seen.has(id)) {
        ordered.push(group);
        seen.add(id);
      }
    }
    for (const group of groups) if (!seen.has(group.id)) ordered.push(group);
    if (ordered.every((group, index) => group.id === groups[index].id)) return;
    set((s) => { s.quickGroups = ordered; });
    void setLocal(KEYS.quickGroups, get().quickGroups);
  },

  // 快捷访问不设数量上限：多了由用户自己删，别用软上限拦人（拖拽批量加入时尤其别扭）
  addQuick(name, url, groupId = get().activeQuickGroupId) {
    if (!name.trim() || !url.trim()) return;
    if (groupId !== DEFAULT_QUICK_GROUP_ID && !get().quickGroups.some((g) => g.id === groupId)) return;
    set((s) => {
      s.quickSites.push({ id: uid('q'), name: name.trim(), url: url.trim(), groupId });
    });
    void setLocal(KEYS.quickSites, get().quickSites);
  },

  addQuickSites(items, groupId = get().activeQuickGroupId) {
    if (groupId !== DEFAULT_QUICK_GROUP_ID && !get().quickGroups.some((g) => g.id === groupId)) return;
    const res = collectQuickSites(get().quickSites.filter((q) => quickGroupOf(q) === groupId), items);
    if (res.add.length) {
      set((s) => {
        for (const it of res.add) s.quickSites.push({ id: uid('q'), ...it, groupId });
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

  reorderQuick(desired, groupId = get().activeQuickGroupId) {
    const groupSites = get().quickSites.filter((q) => quickGroupOf(q) === groupId);
    const byId = new Map(groupSites.map((q) => [q.id, q]));
    const next: QuickSite[] = [];
    const used = new Set<string>();
    for (const id of desired) {
      const item = byId.get(id);
      if (item && !used.has(id)) {
        used.add(id);
        next.push(item);
      }
    }
    // 兜底：desired 没覆盖到的（并发写入 / 脏顺序）按原顺序补在后面，绝不丢条目
    for (const q of groupSites) {
      if (!used.has(q.id)) next.push(q);
    }
    if (next.length !== groupSites.length) return;
    set((s) => {
      let index = 0;
      s.quickSites = s.quickSites.map((q) => quickGroupOf(q) === groupId ? next[index++] : q);
    });
    void setLocal(KEYS.quickSites, get().quickSites);
  },

  async initQuick() {
    // 未存过时显示默认站点；用户清空后存下的 [] 必须保持为空。
    const [storedSites, storedGroups, curatedSeededV1, curatedSeededV2] = await Promise.all([
      getLocal<unknown>(KEYS.quickSites, null),
      getLocalArray<unknown>(KEYS.quickGroups),
      getLocal<boolean>(KEYS.curatedQuickSeeded, false),
      getLocal<boolean>(KEYS.curatedQuickSeededV2, false),
    ]);
    const existingGroups = sanitizeQuickGroups(storedGroups);
    const groups = ensureCuratedQuickGroups(existingGroups);
    const rawSites = sanitizeQuickSites(storedSites);
    const stored = rehomeQuickSites(rawSites, groups);
    const sites: QuickSite[] = Array.isArray(storedSites) && (stored.length || storedSites.length === 0)
      ? stored : DEFAULT_SITES.map((site) => ({ id: uid('q'), ...site }));
    if (!curatedSeededV2) {
      for (const group of CURATED_QUICK_GROUPS) {
        const candidates = curatedSeededV1
          ? group.sites.filter((site) => !FIRST_CURATED_SITE_URLS[group.id]?.has(site.url))
          : group.sites;
        const additions = collectQuickSites(
          sites.filter((site) => quickGroupOf(site) === group.id), [...candidates],
        ).add;
        for (const site of additions) sites.push({ id: uid('q'), ...site, groupId: group.id });
      }
    }
    set((s) => {
      s.quickSites = sites;
      s.quickGroups = groups;
      s.quickLoaded = true;
    });
    if (JSON.stringify(groups) !== JSON.stringify(existingGroups)) await setLocal(KEYS.quickGroups, groups);
    if (!curatedSeededV2 || JSON.stringify(stored) !== JSON.stringify(rawSites)) {
      await setLocal(KEYS.quickSites, sites);
    }
    if (!curatedSeededV2) {
      await setLocal(KEYS.curatedQuickSeededV2, true);
    }
  },
});
