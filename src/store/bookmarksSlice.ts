import { crushCards } from '@/lib/fx';
import { truncate } from '@/lib/colors';
import { uid } from '@/lib/id';
import {
  applySyncing,
  childrenOf,
  countOf,
  descendantIds,
  detach,
  indexInParent,
  isDescendant,
  moveInTree,
  movePlan,
  normalizeTree,
  pathOf,
  removeSubtree,
  treeRootIds,
} from '@/lib/bookmarkTree';
import { normalizeUrl } from '@/lib/url';
import * as Bookmarks from '@/services/chromeBookmarks';
import { KEYS, getLocal, hasChromeApi, setLocal } from '@/services/storage';
import type { BmNode, BmState, ImportItem, RawBmNode, UndoRecord } from '@/lib/types';
import type { AutoEdit, FlashField, SliceCreator } from './slice';

export interface BookmarksSlice {
  bm: BmState;
  bmReady: boolean;
  currentFolder: string;
  /** 被用户手动收起的文件夹；不在表里的一律展开（默认全展开） */
  collapsed: string[];
  selectedBms: string[];
  closingBms: string[];
  undoStack: UndoRecord[];
  autoEdit: AutoEdit | null;
  flashSeq: number;
  flashIds: string[];
  /** 拖拽时空区提示文案 */
  dropHint: string | null;

  initBookmarks: () => Promise<void>;
  syncBookmarks: () => Promise<void>;
  gotoFolder: (id: string) => void;
  toggleCollapse: (id: string) => void;

  toggleBmSel: (
    id: string,
    mod?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
  ) => void;
  selectAllBms: (ids: string[]) => void;
  clearBmSel: () => void;

  createBookmarkDraft: () => void;
  commitEdit: (id: string, field: FlashField, value: string) => void;
  finalizeShare: (id: string) => void;
  createFolder: (parentId: string) => void;
  renameNode: (id: string, title: string) => void;
  deleteNodes: (ids: string[]) => Promise<void>;
  deleteFolderTree: (id: string) => void;
  undo: () => Promise<void>;

  openBookmark: (id: string) => Promise<void>;
  importItems: (items: ImportItem[]) => Promise<number>;
  addTabsAsBookmarks: (tabIds: number[], folderId: string) => Promise<void>;

  moveNodesInto: (ids: string[], parentId: string, index: number) => Promise<void>;
  reorderWithin: (parentId: string, order: string[]) => Promise<void>;

  requestAutoEdit: (id: string, field: FlashField) => void;
  consumeAutoEdit: () => void;
  flashBms: (ids: string[]) => void;
  setDropHint: (v: string | null) => void;

  /** 派生查询：当前文件夹下的子项 */
  listOf: (folderId: string) => BmNode[];
}

let bmSyncTimer: number | null = null;

export const createBookmarksSlice: SliceCreator<BookmarksSlice> = (set, get) => {
  const scheduleSync = () => {
    if (bmSyncTimer !== null) window.clearTimeout(bmSyncTimer);
    bmSyncTimer = window.setTimeout(() => {
      bmSyncTimer = null;
      void get().syncBookmarks();
    }, 70);
  };

  const isDraft = (id: string) => !!get().bm.nodes[id]?.isDraft;

  return {
    bm: { nodes: {}, roots: [] },
    bmReady: false,
    currentFolder: '',
    collapsed: [],
    selectedBms: [],
    closingBms: [],
    undoStack: [],
    autoEdit: null,
    flashSeq: 0,
    flashIds: [],
    dropHint: null,

    listOf(folderId) {
      return childrenOf(get().bm, folderId);
    },

    async initBookmarks() {
      if (!hasChromeApi()) {
        set((s) => void (s.bmReady = true));
        return;
      }
      await get().syncBookmarks();
      const [storedFolder, storedCollapsed] = await Promise.all([
        getLocal<string>(KEYS.currentFolder, ''),
        getLocal<string[]>(KEYS.collapsed, []),
      ]);
      set((s) => {
        const roots = treeRootIds(s.bm);
        const valid = storedFolder && s.bm.nodes[storedFolder]?.isFolder ? storedFolder : roots[0] ?? '';
        s.currentFolder = valid;
        // 只记用户手动收起的那几个，其余一律默认展开
        s.collapsed = storedCollapsed.filter((id) => s.bm.nodes[id]?.isFolder);
        s.bmReady = true;
      });

      chrome.bookmarks.onCreated.addListener((id, node) => {
        const raw = node as unknown as RawBmNode & { index?: number };
        set((s) => {
          if (s.bm.nodes[id]) return;
          s.bm.nodes[id] = {
            id,
            parentId: raw.parentId ?? null,
            title: raw.title ?? '',
            url: raw.url ?? '',
            isFolder: !raw.url,
            children: [],
          };
          const p = raw.parentId ? s.bm.nodes[raw.parentId] : undefined;
          if (p) {
            const idx = typeof raw.index === 'number' ? raw.index : p.children.length;
            p.children.splice(Math.max(0, Math.min(idx, p.children.length)), 0, id);
          }
        });
      });

      chrome.bookmarks.onRemoved.addListener((id) => {
        set((s) => {
          if (!s.bm.nodes[id]) return;
          removeSubtree(s.bm, id);
          s.selectedBms = s.selectedBms.filter((x) => !!s.bm.nodes[x]);
          s.closingBms = s.closingBms.filter((x) => !!s.bm.nodes[x]);
        });
      });

      chrome.bookmarks.onChanged.addListener((id, info) => {
        set((s) => {
          const n = s.bm.nodes[id];
          if (!n) return;
          if (typeof info.title === 'string') n.title = info.title;
          if (typeof info.url === 'string') n.url = info.url;
        });
      });

      chrome.bookmarks.onMoved.addListener(() => scheduleSync());
      chrome.bookmarks.onChildrenReordered.addListener(() => scheduleSync());
      chrome.bookmarks.onImportBegan.addListener(() => void 0);
      chrome.bookmarks.onImportEnded.addListener(() => scheduleSync());
    },

    async syncBookmarks() {
      if (!hasChromeApi()) return;
      const raw = await Bookmarks.getTree();
      const next = normalizeTree(raw);
      set((s) => {
        // 保留本地草稿节点
        for (const [id, node] of Object.entries(s.bm.nodes)) {
          if (!node.isDraft) continue;
          if (!next.nodes[id]) {
            next.nodes[id] = node;
            const p = node.parentId ? next.nodes[node.parentId] : undefined;
            if (p && !p.children.includes(id)) p.children.push(id);
          }
        }
        s.bm = next;
        const roots = treeRootIds(next);
        if (!s.currentFolder || !next.nodes[s.currentFolder]?.isFolder) {
          s.currentFolder = roots[0] ?? '';
        }
        s.selectedBms = s.selectedBms.filter((x) => !!next.nodes[x]);
        s.closingBms = s.closingBms.filter((x) => !!next.nodes[x]);
        s.collapsed = s.collapsed.filter((x) => next.nodes[x]?.isFolder);
      });
    },

    gotoFolder(id) {
      set((s) => {
        if (!s.bm.nodes[id]?.isFolder) return;
        s.currentFolder = id;
        // 选中某个文件夹时把它连同祖先一起展开，保证它在树里可见
        const chain = pathOf(s.bm, id).map((n) => n.id);
        s.collapsed = s.collapsed.filter((cid) => cid !== id && !chain.includes(cid));
        void setLocal(KEYS.currentFolder, id);
        void setLocal(KEYS.collapsed, s.collapsed);
      });
    },

    toggleCollapse(id) {
      set((s) => {
        const at = s.collapsed.indexOf(id);
        if (at > -1) s.collapsed.splice(at, 1);
        else s.collapsed.push(id);
        void setLocal(KEYS.collapsed, s.collapsed);
      });
    },

    toggleBmSel(id, mod) {
      const folder = get().currentFolder;
      const list = childrenOf(get().bm, folder);
      const idx = list.findIndex((n) => n.id === id);
      const anchor = get().undoStack.length; // 占位，避免未使用告警
      void anchor;
      set((s) => {
        const rows = childrenOf(s.bm, s.currentFolder);
        const lastId = s.selectedBms[s.selectedBms.length - 1];
        const lastIdx = rows.findIndex((n) => n.id === lastId);
        if (mod?.shiftKey && lastIdx >= 0 && idx >= 0) {
          const a = Math.min(lastIdx, idx);
          const b = Math.max(lastIdx, idx);
          for (let i = a; i <= b; i++) {
            const nid = rows[i]?.id;
            if (nid && !s.selectedBms.includes(nid)) s.selectedBms.push(nid);
          }
          return;
        }
        const at = s.selectedBms.indexOf(id);
        if (at > -1) s.selectedBms.splice(at, 1);
        else s.selectedBms.push(id);
      });
    },

    selectAllBms(ids) {
      set((s) => void (s.selectedBms = [...ids]));
    },

    clearBmSel() {
      set((s) => void (s.selectedBms = []));
    },

    createBookmarkDraft() {
      const parentId = get().currentFolder;
      if (!parentId) return;
      const id = uid('draft');
      set((s) => {
        s.bm.nodes[id] = {
          id,
          parentId,
          title: '',
          url: '',
          isFolder: false,
          isDraft: true,
          children: [],
        };
        const p = s.bm.nodes[parentId];
        if (p) p.children.push(id);
        s.selectedBms = [];
        s.autoEdit = { id, field: 'name', seq: (s.autoEdit?.seq ?? 0) + 1 };
      });
    },

    commitEdit(id, field, value) {
      const node = get().bm.nodes[id];
      if (!node) return;
      if (field === 'name') {
        const title = value;
        if (node.title === title) return;
        set((s) => {
          const n = s.bm.nodes[id];
          if (n) n.title = title;
        });
        if (!node.isDraft) {
          void Bookmarks.updateNode(id, { title }).catch((err: Error) =>
            get().toast(`重命名失败：${err.message}`, { tone: 'warn' }),
          );
        }
        return;
      }

      const url = normalizeUrl(value);
      if (node.url === url) return;
      set((s) => {
        const n = s.bm.nodes[id];
        if (n) n.url = url;
      });
      if (node.isDraft) {
        if (url) void promoteDraft(id);
        return;
      }
      void Bookmarks.updateNode(id, { url }).catch((err: Error) =>
        get().toast(`修改网址失败：${err.message}`, { tone: 'warn' }),
      );
    },

    /** 编辑结束后收尾：草稿且名称与网址都为空 → 自动撤销该条 */
    finalizeShare(id) {
      const node = get().bm.nodes[id];
      if (!node?.isDraft) return;
      if (node.title.trim() || node.url) return;
      set((s) => {
        detach(s.bm, id);
        delete s.bm.nodes[id];
        s.selectedBms = s.selectedBms.filter((x) => x !== id);
      });
    },

    createFolder(parentId) {
      const parent = get().bm.nodes[parentId];
      if (!parent?.isFolder) return;
      void Bookmarks.createFolder(parentId, '新建文件夹')
        .then((id) => {
          set((s) => {
            s.bm.nodes[id] = {
              id,
              parentId,
              title: '新建文件夹',
              url: '',
              isFolder: true,
              children: [],
            };
            const p = s.bm.nodes[parentId];
            if (p) p.children.push(id);
            // 父级若被手动收起则展开，否则新文件夹的命名输入框看不见
            s.collapsed = s.collapsed.filter((x) => x !== parentId);
          });
          get().requestAutoEdit(id, 'name');
          get().toast('已新建文件夹，输入名称后点击别处确认');
        })
        .catch((err: Error) => get().toast(`新建文件夹失败：${err.message}`, { tone: 'warn' }));
    },

    renameNode(id, title) {
      const node = get().bm.nodes[id];
      if (!node || node.title === title) return;
      set((s) => {
        const n = s.bm.nodes[id];
        if (n) n.title = title;
      });
      if (node.isDraft) return;
      void Bookmarks.updateNode(id, { title }).catch((err: Error) => {
        get().toast(`重命名失败：${err.message}`, { tone: 'warn' });
        void get().syncBookmarks();
      });
    },

    async deleteNodes(ids) {
      const state = get();
      const drafts = ids.filter((id) => isDraft(id));
      const real = ids.filter(
        (id) => !isDraft(id) && !!state.bm.nodes[id] && !state.bm.nodes[id].isFolder,
      );

      if (drafts.length) {
        set((s) => {
          for (const id of drafts) {
            detach(s.bm, id);
            delete s.bm.nodes[id];
          }
          s.selectedBms = s.selectedBms.filter((x) => !drafts.includes(x));
        });
      }
      if (!real.length) return;

      const cards = real
        .map((id) => document.querySelector<HTMLElement>(`[data-bm-card="${id}"]`))
        .filter((el): el is HTMLElement => !!el);
      const colorOf = (el: HTMLElement) => el.getAttribute('data-color') || '#0F8A6B';
      const wait = crushCards(cards, colorOf);

      const records: UndoRecord['items'] = [];
      for (const id of real) {
        const n = state.bm.nodes[id];
        const idx = indexInParent(state.bm, id);
        if (n.parentId) {
          records.push({
            parentId: n.parentId,
            index: Math.max(0, idx),
            node: { ...n, children: [...n.children] },
            snapshot: [],
          });
        }
      }

      set((s) => {
        for (const id of real) if (!s.closingBms.includes(id)) s.closingBms.push(id);
      });

      window.setTimeout(() => {
        void Promise.all(real.map((id) => Bookmarks.removeNode(id)))
          .then(() => {
            const label =
              real.length === 1
                ? `「${truncate(records[0]?.node.title || '', 16)}」`
                : `${real.length} 个书签`;
            set((s) => {
              s.undoStack.push({ items: records, label });
              if (s.undoStack.length > 12) s.undoStack.shift();
            });
            get().toast(`已删除 ${label}`, {
              action: '撤回  Ctrl+Z',
              onAction: () => void get().undo(),
            });
          })
          .catch((err: Error) => {
            set((s) => {
              s.closingBms = s.closingBms.filter((x) => !real.includes(x));
            });
            get().toast(`删除失败：${err.message}`, { tone: 'warn' });
            void get().syncBookmarks();
          });
      }, wait || 10);
    },

    deleteFolderTree(id) {
      const state = get();
      const node = state.bm.nodes[id];
      if (!node?.isFolder) return;
      const total = countOf(state.bm, id);
      const subs = descendantIds(state.bm, id).filter((d) => state.bm.nodes[d]?.isFolder).length;

      get().toast(
        `「${truncate(node.title, 14)}」下有 ${subs} 个子文件夹、${total} 个书签，删除后无法撤回`,
        {
          tone: 'danger',
          action: '确认删除',
          duration: 6000,
          onAction: () => {
            void Bookmarks.removeTree(id)
              .then(() => {
                set((s) => {
                  removeSubtree(s.bm, id);
                  s.selectedBms = s.selectedBms.filter((x) => !!s.bm.nodes[x]);
                  if (s.currentFolder === id || !s.bm.nodes[s.currentFolder]) {
                    s.currentFolder = treeRootIds(s.bm)[0] ?? '';
                  }
                });
                get().toast(`已删除文件夹「${truncate(node.title, 14)}」`);
              })
              .catch((err: Error) => {
                get().toast(`删除文件夹失败：${err.message}`, { tone: 'warn' });
                void get().syncBookmarks();
              });
          },
        },
      );
    },

    async undo() {
      const stack = get().undoStack;
      const rec = stack[stack.length - 1];
      if (!rec) {
        get().toast('没有可撤回的删除操作', { tone: 'warn' });
        return;
      }
      set((s) => void s.undoStack.pop());

      const created: string[] = [];
      const sorted = [...rec.items].sort((a, b) => a.index - b.index);
      try {
        for (const item of sorted) {
          const id = await Bookmarks.createBookmark(
            item.parentId,
            item.node.title,
            item.node.url,
            item.index,
          );
          created.push(id);
          set((s) => {
            s.bm.nodes[id] = {
              ...item.node,
              id,
              parentId: item.parentId,
              children: [],
            };
            const p = s.bm.nodes[item.parentId];
            if (p) {
              const idx = Math.max(0, Math.min(item.index, p.children.length));
              p.children.splice(idx, 0, id);
            }
          });
        }
        const target = sorted[0]?.parentId;
        if (target && get().currentFolder !== target) get().gotoFolder(target);
        get().flashBms(created);
        get().toast(`已撤回，恢复 ${created.length} 个书签`);
      } catch (err) {
        get().toast(`撤回失败：${(err as Error).message}`, { tone: 'warn' });
        void get().syncBookmarks();
      }
    },

    async openBookmark(id) {
      const node = get().bm.nodes[id];
      if (!node || node.isFolder) return;
      if (!node.url) {
        get().requestAutoEdit(id, 'url');
        return;
      }
      try {
        await chrome.tabs.create({ url: node.url, active: true });
      } catch (err) {
        get().toast(`打开失败：${(err as Error).message}`, { tone: 'warn' });
      }
    },

    async importItems(items) {
      const parentId = get().currentFolder;
      if (!parentId || !items.length) return 0;
      const created: string[] = [];
      for (const item of items) {
        try {
          const id = await Bookmarks.createBookmark(parentId, item.name, item.url);
          created.push(id);
          set((s) => {
            s.bm.nodes[id] = {
              id,
              parentId,
              title: item.name,
              url: item.url,
              isFolder: false,
              children: [],
            };
            const p = s.bm.nodes[parentId];
            if (p) p.children.push(id);
          });
        } catch {
          /* 单条失败跳过 */
        }
      }
      if (created.length) {
        set((s) => void (s.selectedBms = []));
        get().flashBms(created);
      }
      return created.length;
    },

    async addTabsAsBookmarks(tabIds, folderId) {
      const state = get();
      const folder = state.bm.nodes[folderId];
      if (!folder?.isFolder) return;
      const tabs = state.tabs.filter((t) => tabIds.includes(t.id));
      if (!tabs.length) return;
      const created: string[] = [];
      for (const t of tabs) {
        try {
          const id = await Bookmarks.createBookmark(folderId, t.title, t.url);
          created.push(id);
          set((s) => {
            s.bm.nodes[id] = {
              id,
              parentId: folderId,
              title: t.title,
              url: t.url,
              isFolder: false,
              children: [],
            };
            const p = s.bm.nodes[folderId];
            if (p) p.children.push(id);
          });
        } catch {
          /* 跳过 */
        }
      }
      if (!created.length) return;
      if (get().currentFolder !== folderId) get().gotoFolder(folderId);
      get().clearTabSel();
      get().flashBms(created);
      get().toast(`已把 ${created.length} 个标签加入「${truncate(folder.title, 12)}」`);
    },

    async moveNodesInto(ids, parentId, index) {
      const target = get().bm.nodes[parentId];
      if (!target?.isFolder) return;
      // 账号书签与此设备书签可以互相搬运：落点在哪套存储，搬过去的节点就归哪套存储

      const movable = ids.filter((id) => {
        if (id === parentId) return false;
        const n = get().bm.nodes[id];
        if (!n) return false;
        if (isDescendant(get().bm, id, parentId)) return false;
        return true;
      });
      if (!movable.length) {
        get().toast('不能把文件夹移进它自己或它的子文件夹', { tone: 'warn' });
        return;
      }

      // index < 0 表示追加到末尾
      const base =
        index < 0
          ? target.children.filter((x) => !movable.includes(x)).length
          : Math.max(0, Math.min(index, target.children.length));

      const targetSyncing = target.syncing;
      const snapshot = JSON.parse(JSON.stringify(get().bm)) as BmState;
      set((s) => {
        let i = base;
        for (const id of movable) {
          moveInTree(s.bm, id, parentId, i);
          // 跨存储搬运后同步归属（含子树），与实际落点保持一致
          applySyncing(s.bm, id, targetSyncing);
          i += 1;
        }
        s.selectedBms = [];
      });

      try {
        let i = base;
        for (const id of movable) {
          await Bookmarks.moveNode(id, parentId, i);
          i += 1;
        }
        if (get().currentFolder !== parentId) get().gotoFolder(parentId);
        get().flashBms(movable);
      } catch (err) {
        set((s) => void (s.bm = snapshot));
        get().toast(`移动失败，已回滚：${(err as Error).message}`, { tone: 'warn' });
        void get().syncBookmarks();
      }
    },

    async reorderWithin(parentId, order) {
      const parent = get().bm.nodes[parentId];
      if (!parent?.isFolder) return;
      const before = [...parent.children];
      const plan = movePlan(before, order);
      if (!plan.length) return;

      const snapshot = JSON.parse(JSON.stringify(get().bm)) as BmState;
      set((s) => {
        const p = s.bm.nodes[parentId];
        if (p) p.children = [...order];
      });

      try {
        for (const step of plan) await Bookmarks.moveNode(step.id, parentId, step.index);
      } catch (err) {
        set((s) => void (s.bm = snapshot));
        get().toast(`排序失败，已回滚：${(err as Error).message}`, { tone: 'warn' });
        void get().syncBookmarks();
      }
    },

    requestAutoEdit(id, field) {
      set((s) => {
        s.autoEdit = { id, field, seq: (s.autoEdit?.seq ?? 0) + 1 };
      });
    },

    consumeAutoEdit() {
      set((s) => void (s.autoEdit = null));
    },

    flashBms(ids) {
      set((s) => {
        s.flashIds = [...ids];
        s.flashSeq += 1;
      });
    },

    setDropHint(v) {
      set((s) => void (s.dropHint = v));
    },
  };

  /** 把本地草稿升级为真实书签（拿到 id 后原位替换） */
  async function promoteDraft(draftId: string): Promise<void> {
    const state = get();
    const node = state.bm.nodes[draftId];
    if (!node?.isDraft || !node.parentId) return;
    const parentId = node.parentId;
    const idx = indexInParent(state.bm, draftId);
    try {
      const realId = await Bookmarks.createBookmark(parentId, node.title, node.url);
      set((s) => {
        const p = s.bm.nodes[parentId];
        if (p) {
          const at = p.children.indexOf(draftId);
          if (at > -1) p.children.splice(at, 1, realId);
        }
        delete s.bm.nodes[draftId];
        s.bm.nodes[realId] = {
          id: realId,
          parentId,
          title: node.title,
          url: node.url,
          isFolder: false,
          children: [],
        };
        s.selectedBms = s.selectedBms.map((x) => (x === draftId ? realId : x));
        if (s.autoEdit?.id === draftId) s.autoEdit = { ...s.autoEdit, id: realId };
      });
      void idx;
    } catch (err) {
      get().toast(`保存书签失败：${(err as Error).message}`, { tone: 'warn' });
    }
  }
};
