/**
 * 仅 dev 使用的 chrome.* 内存实现，让 `npm run dev` 在普通浏览器里也能完整交互。
 * 生产构建不会引用（main.tsx 里用 import.meta.env.DEV 包住）。
 */
import { DEV_TABS, DEV_TREE } from '@/store/devSeed';
import type { RawBmNode } from '@/lib/types';

interface Emitter<T extends unknown[]> {
  addListener(fn: (...args: T) => void): void;
  removeListener(fn: (...args: T) => void): void;
}

function makeEmitter<T extends unknown[]>() {
  const set = new Set<(...args: T) => void>();
  return {
    api: {
      addListener: (fn: (...args: T) => void) => void set.add(fn),
      removeListener: (fn: (...args: T) => void) => void set.delete(fn),
    } as Emitter<T>,
    emit: (...args: T) => {
      for (const fn of [...set]) fn(...args);
    },
  };
}

interface Node {
  id: string;
  parentId: string | null;
  title: string;
  url: string;
  children: string[];
  /** Chrome 新版才有：顶层特殊文件夹的类型与「账号 / 此设备」归属 */
  folderType?: string;
  syncing?: boolean;
}

interface TabRec {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  active: boolean;
  pinned: boolean;
  favIconUrl?: string;
}

export function installFakeChrome(): void {
  const nodes = new Map<string, Node>();
  const bookmarks = {
    onCreated: makeEmitter<[string, { id: string; node: unknown }]>(),
    onRemoved: makeEmitter<[string, { id: string; info: unknown }]>(),
    onChanged: makeEmitter<[string, { id: string; info: unknown }]>(),
    onMoved: makeEmitter<[string, { id: string; info: unknown }]>(),
    onChildrenReordered: makeEmitter<[string, { id: string; info: unknown }]>(),
    onImportBegan: makeEmitter<[]>(),
    onImportEnded: makeEmitter<[]>(),
  };
  const tabsEv = {
    onCreated: makeEmitter<[TabRec]>(),
    onRemoved: makeEmitter<[number]>(),
    onUpdated: makeEmitter<[{ id: number; info: unknown; tab: TabRec }]>(),
    onMoved: makeEmitter<[unknown]>(),
    onActivated: makeEmitter<[{ tabId: number; windowId: number }]>(),
    onReplaced: makeEmitter<[unknown]>(),
    onAttached: makeEmitter<[unknown]>(),
    onDetached: makeEmitter<[unknown]>(),
  };

  const install = (raw: RawBmNode[], parentId: string | null) => {
    for (const r of raw) {
      nodes.set(r.id, {
        id: r.id,
        parentId,
        title: r.title ?? '',
        url: r.url ?? '',
        children: (r.children ?? []).map((c) => c.id),
        folderType: r.folderType,
        syncing: typeof r.syncing === 'boolean' ? r.syncing : undefined,
      });
      if (r.children) install(r.children, r.id);
    }
  };
  install(DEV_TREE, null);

  const toRaw = (id: string): RawBmNode => {
    const n = nodes.get(id)!;
    const base = {
      id: n.id,
      parentId: n.parentId ?? undefined,
      title: n.title,
      folderType: n.folderType,
      syncing: n.syncing,
    };
    return n.url
      ? { ...base, url: n.url }
      : { ...base, children: n.children.map(toRaw) };
  };

  const parentOf = (id: string) => {
    const p = nodes.get(id)?.parentId;
    return p ? nodes.get(p) : undefined;
  };

  const detach = (id: string) => {
    const p = parentOf(id);
    if (!p) return -1;
    const i = p.children.indexOf(id);
    if (i > -1) p.children.splice(i, 1);
    return i;
  };

  let nextBmId = 900;
  // 便于自动化脚本核对创建次数
  const createLog: Array<{ id: string; parentId: string; title: string }> = [];
  (globalThis as unknown as { __bmCreateLog: unknown }).__bmCreateLog = createLog;
  const SELF_TAB_ID = 1;
  let tabs: TabRec[] = [
    {
      id: SELF_TAB_ID,
      windowId: 1,
      index: 0,
      title: '新标签页',
      url: 'chrome://newtab',
      active: true,
      pinned: false,
    },
    ...DEV_TABS.map((t, i) => ({
      id: t.id,
      windowId: 1,
      index: i + 1,
      title: t.title,
      url: t.url,
      // 自己那页才是 active；固定标签按数据给（真实 Chrome 里 pinned 一定排在普通标签前面）
      active: false,
      pinned: t.pinned ?? false,
    })),
  ];
  let nextTabId = 500;
  // 只重设 index，不重排：数组顺序本身就是真相。
  // （旧实现按陈旧的 index 字段 sort，会把刚 move 的位置原地打回去）
  const reindex = () => {
    tabs.forEach((t, i) => void (t.index = i));
  };

  const storage: Record<string, unknown> = {};
  const storageEv = makeEmitter<[Record<string, chrome.storage.StorageChange>]>();

  const fake = {
    runtime: {
      // 空 path 返回扩展页面前缀（标签列表靠它识别「自身标签页」）
      getURL: (path: string) =>
        path
          ? `https://icons.duckduckgo.com${path.includes('_favicon') ? '' : path}`
          : 'chrome-extension://tabnest-dev/',
      id: 'tabnest-dev',
    },
    windows: {
      async update() {
        return {};
      },
    },
    storage: {
      local: {
        async get(key: string | string[]) {
          const keys = Array.isArray(key) ? key : [key];
          const out: Record<string, unknown> = {};
          for (const k of keys) if (k in storage) out[k] = storage[k];
          return out;
        },
        async set(items: Record<string, unknown>) {
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: storage[k], newValue: v };
            storage[k] = v;
          }
          storageEv.emit(changes);
        },
      },
      onChanged: storageEv.api,
    },
    bookmarks: {
      ...Object.fromEntries(Object.entries(bookmarks).map(([k, v]) => [k, v.api])),
      async getTree() {
        return [toRaw('0')];
      },
      async getSubTree(id: string) {
        return [toRaw(id)];
      },
      async create(info: { parentId?: string; title?: string; url?: string; index?: number }) {
        const parentId = info.parentId ?? '0';
        const parent = nodes.get(parentId);
        if (!parent) throw new Error('Can not find parent with id: ' + parentId);
        const id = String(nextBmId++);
        nodes.set(id, {
          id,
          parentId,
          title: info.title ?? '',
          url: info.url ?? '',
          children: [],
        });
        const at = typeof info.index === 'number' ? Math.min(info.index, parent.children.length) : parent.children.length;
        parent.children.splice(at, 0, id);
        createLog.push({ id, parentId, title: info.title ?? '' });
        const node = nodes.get(id)!;
        queueMicrotask(() =>
          bookmarks.onCreated.emit(id, {
            id,
            node: {
              id,
              parentId,
              title: node.title,
              url: node.url || undefined,
              index: at,
            },
          }),
        );
        return { id, parentId, title: node.title, url: node.url || undefined, index: at };
      },
      async update(id: string, changes: { title?: string; url?: string }) {
        const n = nodes.get(id);
        if (!n) throw new Error('no bookmark with id: ' + id);
        Object.assign(n, changes);
        queueMicrotask(() => bookmarks.onChanged.emit(id, { id, info: changes }));
        return n;
      },
      async remove(id: string) {
        const n = nodes.get(id);
        if (!n) throw new Error('no bookmark with id: ' + id);
        if (!n.url) throw new Error('Cannot remove a folder with bookmarks.remove');
        const index = detach(id);
        const parentId = n.parentId;
        nodes.delete(id);
        queueMicrotask(() =>
          bookmarks.onRemoved.emit(id, { id, info: { parentId, index, node: n } }),
        );
      },
      async removeTree(id: string) {
        const n = nodes.get(id);
        if (!n) throw new Error('no bookmark with id: ' + id);
        const drop = (nid: string) => {
          for (const c of [...(nodes.get(nid)?.children ?? [])]) drop(c);
          nodes.delete(nid);
        };
        const index = detach(id);
        const parentId = n.parentId;
        drop(id);
        queueMicrotask(() =>
          bookmarks.onRemoved.emit(id, { id, info: { parentId, index, node: n } }),
        );
      },
      async move(id: string, dest: { parentId?: string; index?: number }) {
        const n = nodes.get(id);
        if (!n) throw new Error('no bookmark with id: ' + id);
        const targetId = dest.parentId ?? n.parentId!;
        const target = nodes.get(targetId);
        if (!target) throw new Error('no parent ' + targetId);
        detach(id);
        const at =
          typeof dest.index === 'number' ? Math.min(dest.index, target.children.length) : target.children.length;
        target.children.splice(at, 0, id);
        n.parentId = targetId;
        queueMicrotask(() => bookmarks.onMoved.emit(id, { id, info: { parentId: targetId, index: at } }));
      },
    },
    tabs: {
      ...Object.fromEntries(Object.entries(tabsEv).map(([k, v]) => [k, v.api])),
      async getCurrent() {
        return tabs.find((t) => t.id === SELF_TAB_ID) ?? null;
      },
      async get(id: number) {
        const t = tabs.find((x) => x.id === id);
        if (!t) throw new Error('No tab with id: ' + id);
        return { ...t };
      },
      async query(info?: { windowId?: number }) {
        reindex();
        const list =
          info && typeof info.windowId === 'number'
            ? tabs.filter((t) => t.windowId === info.windowId)
            : tabs;
        return list.map((t) => ({ ...t }));
      },
      async create(info: { url?: string; active?: boolean }) {
        const tab: TabRec = {
          id: nextTabId++,
          windowId: 1,
          index: tabs.length,
          title: info.url ?? '新标签页',
          url: info.url ?? 'about:blank',
          active: info.active ?? true,
          pinned: false,
        };
        tabs.push(tab);
        reindex();
        queueMicrotask(() => tabsEv.onCreated.emit({ ...tab }));
        return { ...tab };
      },
      async remove(ids: number | number[]) {
        const list = Array.isArray(ids) ? ids : [ids];
        if (list.includes(SELF_TAB_ID)) throw new Error('不能关闭当前新标签页（dev 模式限制）');
        for (const id of list) {
          const i = tabs.findIndex((t) => t.id === id);
          if (i < 0) throw new Error('No tab with id: ' + id);
          const [removed] = tabs.splice(i, 1);
          queueMicrotask(() => tabsEv.onRemoved.emit(removed.id));
        }
        reindex();
      },
      async move(id: number, dest: { index: number }) {
        const i = tabs.findIndex((t) => t.id === id);
        if (i < 0) throw new Error('No tab with id: ' + id);
        const [tab] = tabs.splice(i, 1);
        tabs.splice(Math.min(dest.index, tabs.length), 0, tab);
        reindex();
        queueMicrotask(() => tabsEv.onMoved.emit({ id }));
        return { ...tab };
      },
      async update(id: number, info: { active?: boolean }) {
        const tab = tabs.find((t) => t.id === id);
        if (!tab) throw new Error('No tab with id: ' + id);
        if (info.active) {
          for (const t of tabs) t.active = false;
          tab.active = true;
          queueMicrotask(() => tabsEv.onActivated.emit({ tabId: id, windowId: tab.windowId }));
        }
        return { ...tab };
      },
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = fake;
}
