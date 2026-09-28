import { uid } from '@/lib/id';
import { t } from '@/lib/i18n';
import { collectQuickSites, sanitizeQuickSites } from '@/lib/quickSite';
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
    const { id, name } = raw as { id?: unknown; name?: unknown };
    if (typeof id !== 'string' || !id || id === DEFAULT_QUICK_GROUP_ID || seen.has(id)) return [];
    if (typeof name !== 'string' || !name.trim()) return [];
    seen.add(id);
    return [{ id, name: name.trim().slice(0, 24) }];
  });
}

/**
 * 当前分类 id 的白名单校验：不在分组表里（分组被删 / 存储被改坏 / 跨版本残留）一律回落默认分类。
 * 存储里的值当外部输入处理，绝不能让 UI 停在一个查不到的分组上。
 */
function normalizeActiveGroup(id: unknown, groups: QuickGroup[]): string {
  if (typeof id !== 'string' || !id) return DEFAULT_QUICK_GROUP_ID;
  if (id === DEFAULT_QUICK_GROUP_ID) return id;
  return groups.some((g) => g.id === id) ? id : DEFAULT_QUICK_GROUP_ID;
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
    if (id !== DEFAULT_QUICK_GROUP_ID && !get().quickGroups.some((g) => g.id === id)) return;
    set((s) => { s.activeQuickGroupId = id; });
    // 记住这次点击：刷新 / 重开新标签页后仍停在这个分类
    void setLocal(KEYS.quickGroup, id);
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
    // 新建后自动切到新分组，这份「上次点的是哪一栏」也要落盘
    void setLocal(KEYS.quickGroup, id);
  },

  renameQuickGroup(id, name) {
    const clean = name.trim().slice(0, 24);
    if (!clean || id === DEFAULT_QUICK_GROUP_ID) return;
    if (get().quickGroups.some((g) => g.id !== id && g.name.toLowerCase() === clean.toLowerCase())) return;
    set((s) => {
      const group = s.quickGroups.find((g) => g.id === id);
      if (group) group.name = clean;
    });
    void setLocal(KEYS.quickGroups, get().quickGroups);
  },

  removeQuickGroup(id) {
    if (id === DEFAULT_QUICK_GROUP_ID || !get().quickGroups.some((g) => g.id === id)) return;
    const wasActive = get().activeQuickGroupId === id;
    set((s) => {
      s.quickGroups = s.quickGroups.filter((g) => g.id !== id);
      s.quickSites = s.quickSites.filter((q) => quickGroupOf(q) !== id);
      if (s.activeQuickGroupId === id) s.activeQuickGroupId = DEFAULT_QUICK_GROUP_ID;
    });
    void setLocal(KEYS.quickGroups, get().quickGroups);
    void setLocal(KEYS.quickSites, get().quickSites);
    // 删掉的正是在看的那一栏时，落盘的记忆也要跟着回落，别留死 id
    if (wasActive) void setLocal(KEYS.quickGroup, DEFAULT_QUICK_GROUP_ID);
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
    const [storedSites, storedGroups, storedActive] = await Promise.all([
      getLocal<unknown>(KEYS.quickSites, null),
      getLocalArray<unknown>(KEYS.quickGroups),
      getLocal<unknown>(KEYS.quickGroup, DEFAULT_QUICK_GROUP_ID),
    ]);
    const groups = sanitizeQuickGroups(storedGroups);
    const groupIds = new Set(groups.map((g) => g.id));
    const stored = sanitizeQuickSites(storedSites).map((q) =>
      q.groupId && !groupIds.has(q.groupId) ? { ...q, groupId: DEFAULT_QUICK_GROUP_ID } : q,
    );
    const active = normalizeActiveGroup(storedActive, groups);
    set((s) => {
      if (Array.isArray(storedSites) && (stored.length || storedSites.length === 0)) {
        s.quickSites = stored;
      }
      s.quickGroups = groups;
      s.activeQuickGroupId = active;
      s.quickLoaded = true;
    });
    // 存储里是脏值（分组已删）时顺手订正回去，避免每次启动都要回落一次
    if (active !== storedActive) void setLocal(KEYS.quickGroup, active);
  },
});
