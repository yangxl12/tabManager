/**
 * 拖拽系统（pragmatic-drag-and-drop）
 * 7 个场景：标签排序 / 标签→书签 / 书签排序 / 书签·文件夹→文件夹 /
 *          标签·书签→快捷访问 / 快捷磁贴排序 / JSON 文件拖入
 * 所有落点逻辑集中在 useDndRoot 的 monitor 里，卡片只负责注册自身。
 *
 * 命名空间提醒：「快捷访问」这里有两个身份，别混：
 *   源   kind: 'quick'      —— 快捷磁贴（QuickSite），只能落到快捷访问区
 *   落点 kind: 'quickPane'  —— 整个快捷访问区（收标签/书签=加入；收磁贴=移到末尾）
 *   落点 kind: 'quickTile'  —— 单个磁贴（只收磁贴=排序）
 * 除了这两个落点，别的落点一律不认 quick 源（否则快捷 id 会被塞进标签/书签逻辑里）。
 */
import { useEffect, useRef, type RefObject } from 'react';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/adapter/drop-target-for-external';
import { monitorForExternal } from '@atlaskit/pragmatic-drag-and-drop/adapter/monitor-for-external';
import { containsFiles, getFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file';
import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import type { DropTargetRecord } from '@atlaskit/pragmatic-drag-and-drop/types';
import { childrenOf, dropInsertIndex, reorderIds } from '@/lib/bookmarkTree';
import { hostOf } from '@/lib/url';
import { useStore } from '@/store';

/** 拖拽源类型：quick 只由快捷磁贴产生 */
export type DragKind = 'tab' | 'bookmark' | 'quick';

/** 所有拖拽源共用的载荷（ids 为字符串化后的 id，多选时为整组） */
export interface DragSource {
  kind: DragKind;
  id: string;
  parentId: string | null;
  ids: string[];
  color: string;
  index: number;
}

interface SortTargetData {
  kind: 'tab' | 'bookmark';
  id: string;
  parentId: string | null;
  index: number;
}

interface FolderTargetData {
  kind: 'folder';
  id: string;
}

interface PaneTargetData {
  kind: 'pane';
  scope: 'tab' | 'bookmark';
}

/** 快捷访问区整体：标签 / 书签拖过来 = 加入快捷访问；快捷磁贴拖到空白 = 移到末尾 */
interface QuickPaneTargetData {
  kind: 'quickPane';
}

/** 单个快捷磁贴：只做排序 */
interface QuickTileTargetData {
  kind: 'quickTile';
  id: string;
  index: number;
}

type AnyTargetData =
  | SortTargetData
  | FolderTargetData
  | PaneTargetData
  | QuickPaneTargetData
  | QuickTileTargetData
  | Record<string, unknown>;

/**
 * 卡片源（标签 / 书签）。落点侧一律用它做 canDrop ——
 * 只有这两类能落到标签网格、书签网格、文件夹、面板空区，
 * 快捷磁贴若混进来，它的字符串 id 会被当成书签 id 塞进书签树。
 */
function isCardDrag(data: unknown): data is DragSource {
  if (!data || typeof data !== 'object') return false;
  const k = (data as { kind?: unknown }).kind;
  return k === 'tab' || k === 'bookmark';
}

/** 快捷磁贴源 */
function isQuickDrag(data: unknown): boolean {
  return !!data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'quick';
}

/* ------------------------------ 注册：可拖拽卡片 ------------------------------ */

export function useCardDrag({
  elementRef,
  disabled,
  getData,
}: {
  elementRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  getData: () => DragSource;
}) {
  const getRef = useRef(getData);
  getRef.current = getData;

  useEffect(() => {
    const el = elementRef.current;
    if (!el || disabled) return;
    return draggable({
      element: el,
      getInitialData: () => getRef.current() as unknown as Record<string, unknown>,
    });
  }, [elementRef, disabled]);
}

/* ------------------------------ 注册：排序落点 ------------------------------ */

export function useSortableTarget({
  elementRef,
  kind,
  getData,
}: {
  elementRef: RefObject<HTMLElement | null>;
  kind: 'tab' | 'bookmark';
  getData: () => SortTargetData;
}) {
  const getRef = useRef(getData);
  getRef.current = getData;

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: ({ input, element }) =>
        attachClosestEdge(getRef.current() as unknown as Record<string, unknown>, {
          element,
          input,
          allowedEdges: ['left', 'right'],
        }),
      canDrop: ({ source }) => {
        const data = source.data as unknown;
        if (!isCardDrag(data)) return false;
        // 标签排序只接受标签；书签网格同时接受标签（存为书签）与书签
        return kind === 'tab' ? data.kind === 'tab' : true;
      },
      getIsSticky: () => true,
      getDropEffect: () => 'move',
    });
  }, [elementRef, kind]);
}

/* ------------------------------ 注册：文件夹落点 ------------------------------ */

export function useFolderTarget({
  elementRef,
  id,
}: {
  elementRef: RefObject<HTMLElement | null>;
  id: string;
}) {
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ kind: 'folder', id }) as unknown as Record<string, unknown>,
      canDrop: ({ source }) => isCardDrag(source.data),
      getDropEffect: () => 'move',
    });
  }, [elementRef, id]);
}

/* ------------------------------ 注册：面板空区落点 ------------------------------ */

export function usePaneTarget({
  elementRef,
  scope,
}: {
  elementRef: RefObject<HTMLElement | null>;
  scope: 'tab' | 'bookmark';
}) {
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ kind: 'pane', scope }) as unknown as Record<string, unknown>,
      canDrop: ({ source }) => {
        const data = source.data as unknown;
        if (!isCardDrag(data)) return false;
        return scope === 'tab' ? data.kind === 'tab' : true;
      },
      getDropEffect: () => 'move',
    });
  }, [elementRef, scope]);
}

/* ------------------------------ 注册：快捷访问落点 ------------------------------ */

/**
 * 快捷访问区整体作为落点（磁贴本身另注册 quickTile，内层优先）。
 * 落在磁贴缝里也算命中，比只认某个磁贴宽容得多。
 */
export function useQuickTarget({ elementRef }: { elementRef: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ kind: 'quickPane' }) as unknown as Record<string, unknown>,
      // 标签 / 书签 = 加入快捷访问；快捷磁贴 = 拖到空白处挪到末尾
      canDrop: ({ source }) => isCardDrag(source.data) || isQuickDrag(source.data),
      // 标签不会关、书签不会删，语义上是复制；磁贴本身是搬家
      getDropEffect: ({ source }) => (isQuickDrag(source.data) ? 'move' : 'copy'),
    });
  }, [elementRef]);
}

/**
 * 单个快捷磁贴：拖拽排序的落点（左右半区决定插在前还是后）。
 * 只认快捷磁贴源 —— 标签 / 书签拖到磁贴上仍然走 quickPane 的「加入」语义。
 */
export function useQuickSortTarget({
  elementRef,
  getData,
}: {
  elementRef: RefObject<HTMLElement | null>;
  getData: () => { id: string; index: number };
}) {
  const getRef = useRef(getData);
  getRef.current = getData;

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: ({ input, element }) =>
        attachClosestEdge({ kind: 'quickTile', ...getRef.current() } as unknown as Record<string, unknown>, {
          element,
          input,
          allowedEdges: ['left', 'right'],
        }),
      canDrop: ({ source }) => isQuickDrag(source.data),
      getIsSticky: () => true,
      getDropEffect: () => 'move',
    });
  }, [elementRef]);
}

/* ------------------------------ 注册：外部文件拖入 ------------------------------ */

let fileDropHandler: ((files: File[]) => void) | null = null;

export function useExternalFileTarget({
  elementRef,
  onFiles,
}: {
  elementRef: RefObject<HTMLElement | null>;
  onFiles: (files: File[]) => void;
}) {
  useEffect(() => {
    fileDropHandler = onFiles;
    return () => {
      fileDropHandler = null;
    };
  }, [onFiles]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return dropTargetForExternal({
      element: el,
      canDrop: ({ source }) => containsFiles({ source }),
    });
  }, [elementRef]);
}

/* ------------------------------ 注册：网格自动滚动 ------------------------------ */

export function useAutoScroll(elementRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return autoScrollForElements({ element: el });
  }, [elementRef]);
}

/* ------------------------------ 全局编排 ------------------------------ */

function updateIndicator(targets: DropTargetRecord[]): void {
  const st = useStore.getState();
  const top = targets[0];
  if (!top) {
    if (st.drag.indicator || st.drag.dropFolderId || st.drag.dropPane || st.drag.dropQuick) {
      st.setDrag({ indicator: null, dropFolderId: null, dropPane: null, dropQuick: false });
    }
    return;
  }
  const d = top.data as AnyTargetData;

  // 快捷磁贴排序：指示线插在目标磁贴左右
  if (d.kind === 'quickTile') {
    if (st.drag.kind !== 'quick') return;
    const id = (d as QuickTileTargetData).id;
    if (st.drag.ids.includes(id)) {
      if (st.drag.indicator || st.drag.dropQuick) {
        st.setDrag({ indicator: null, dropQuick: false });
      }
      return;
    }
    const edge = extractClosestEdge(top.data);
    const side: 'before' | 'after' = edge === 'right' ? 'after' : 'before';
    const cur = st.drag.indicator;
    if (!cur || cur.kind !== 'quick' || cur.targetId !== id || cur.side !== side) {
      st.setDrag({ indicator: { kind: 'quick', targetId: id, side }, dropFolderId: null, dropQuick: false });
    }
    return;
  }
  if (d.kind === 'quickPane') {
    // 磁贴拖到空白处 = 挪到末尾，没有插入位置可指，不亮「加入」提示
    if (st.drag.kind === 'quick') {
      if (st.drag.indicator || st.drag.dropQuick) st.setDrag({ indicator: null, dropQuick: false });
      return;
    }
    if (!st.drag.dropQuick) {
      st.setDrag({ dropQuick: true, indicator: null, dropFolderId: null, dropPane: null });
    }
    return;
  }
  if (d.kind === 'folder') {
    const id = (d as FolderTargetData).id;
    if (st.drag.dropFolderId !== id) {
      st.setDrag({ dropFolderId: id, indicator: null, dropPane: null, dropQuick: false });
    }
    return;
  }
  if (d.kind === 'pane') {
    const scope = (d as PaneTargetData).scope;
    if (st.drag.dropPane !== scope) {
      st.setDrag({ dropPane: scope, indicator: null, dropFolderId: null, dropQuick: false });
    }
    return;
  }
  if (d.kind === 'tab' || d.kind === 'bookmark') {
    const id = (d as SortTargetData).id;
    // 落点在自己那一组身上：不显示插入线，但保留所在面板的高亮，避免边界抖动闪烁
    if (st.drag.ids.includes(id)) {
      if (st.drag.indicator || st.drag.dropQuick) {
        st.setDrag({ indicator: null, dropQuick: false });
      }
      return;
    }
    const edge = extractClosestEdge(top.data);
    const side: 'before' | 'after' = edge === 'right' ? 'after' : 'before';
    const cur = st.drag.indicator;
    if (!cur || cur.kind !== d.kind || cur.targetId !== id || cur.side !== side) {
      st.setDrag({ indicator: { kind: d.kind, targetId: id, side }, dropFolderId: null, dropQuick: false });
    }
    return;
  }
  if (st.drag.indicator || st.drag.dropFolderId || st.drag.dropPane || st.drag.dropQuick) {
    st.setDrag({ indicator: null, dropFolderId: null, dropPane: null, dropQuick: false });
  }
}

function handleDrop(source: DragSource, targets: DropTargetRecord[]): void {
  const top = targets[0];
  if (!top) return;
  const st = useStore.getState();
  const d = top.data as AnyTargetData;

  // 快捷磁贴：排序（只认磁贴 / 空白区两种落点，落到别处什么也不做）
  if (source.kind === 'quick') {
    if (d.kind === 'quickTile') {
      const id = (d as QuickTileTargetData).id;
      if (source.ids.includes(id)) return;
      const order = st.quickSites.map((q) => q.id);
      const edge = extractClosestEdge(top.data);
      const idx = dropInsertIndex(order, id, edge === 'right' ? 'after' : 'before', source.ids);
      st.reorderQuick(reorderIds(order, source.ids, idx));
      return;
    }
    if (d.kind === 'quickPane') {
      const order = st.quickSites.map((q) => q.id);
      const idx = dropInsertIndex(order, null, 'after', source.ids);
      st.reorderQuick(reorderIds(order, source.ids, idx));
    }
    return;
  }

  // 落在被拖动的那一组自己身上：不做任何事
  if ((d.kind === 'tab' || d.kind === 'bookmark') && source.ids.includes((d as SortTargetData).id)) {
    return;
  }

  // 快捷访问：标签 / 书签拖上来 = 存成快捷站点（源保持不动）
  if (d.kind === 'quickPane') {
    const items =
      source.kind === 'tab'
        ? source.ids
            .map((id) => st.tabs.find((x) => String(x.id) === id))
            .map((tab) => (tab ? { name: tab.title || hostOf(tab.url), url: tab.url } : null))
        : source.ids
            .map((id) => st.bm.nodes[id])
            .map((node) =>
              node && !node.isFolder ? { name: node.title || hostOf(node.url), url: node.url } : null,
            );
    st.addQuickSites(items.filter((x): x is { name: string; url: string } => x !== null));
    return;
  }

  if (source.kind === 'tab') {
    const tabIds = source.ids.map(Number);
    if (d.kind === 'tab') {
      const order = st.tabs.map((t) => String(t.id));
      const edge = extractClosestEdge(top.data);
      const idx = dropInsertIndex(order, (d as SortTargetData).id, edge === 'right' ? 'after' : 'before', source.ids);
      const desired = reorderIds(order, source.ids, idx).map(Number);
      void st.reorderTabs(desired);
      return;
    }
    if (d.kind === 'bookmark') {
      const parentId = (d as SortTargetData).parentId;
      if (parentId) void st.addTabsAsBookmarks(tabIds, parentId);
      return;
    }
    if (d.kind === 'folder') {
      void st.addTabsAsBookmarks(tabIds, (d as FolderTargetData).id);
      return;
    }
    if (d.kind === 'pane') {
      const scope = (d as PaneTargetData).scope;
      if (scope === 'bookmark') void st.addTabsAsBookmarks(tabIds, st.currentFolder);
      else if (scope === 'tab') {
        const order = st.tabs.map((t) => String(t.id));
        const desired = reorderIds(order, source.ids, order.length).map(Number);
        void st.reorderTabs(desired);
      }
    }
    return;
  }

  // 书签（含文件夹）拖拽
  if (d.kind === 'bookmark') {
    const target = d as SortTargetData;
    if (!target.parentId) return;
    const order = childrenOf(st.bm, target.parentId).map((n) => n.id);
    const edge = extractClosestEdge(top.data);
    const idx = dropInsertIndex(order, target.id, edge === 'right' ? 'after' : 'before', source.ids);
    if (source.parentId === target.parentId) {
      void st.reorderWithin(target.parentId, reorderIds(order, source.ids, idx));
    } else {
      void st.moveNodesInto(source.ids, target.parentId, idx);
    }
    return;
  }
  if (d.kind === 'folder') {
    void st.moveNodesInto(source.ids, (d as FolderTargetData).id, -1);
    return;
  }
  if (d.kind === 'pane' && (d as PaneTargetData).scope === 'bookmark') {
    void st.moveNodesInto(source.ids, st.currentFolder, -1);
  }
}

export function useDndRoot(): void {
  useEffect(() => {
    const offElement = monitorForElements({
      // 磁贴也是元素拖拽，漏了它 monitor 不触发 → 指示器/落点全静默
      canMonitor: ({ source }) => isCardDrag(source.data) || isQuickDrag(source.data),
      onDragStart: ({ source }) => {
        const data = source.data as unknown as DragSource;
        useStore.getState().setDrag({
          active: true,
          kind: data.kind,
          ids: data.ids,
          indicator: null,
          dropFolderId: null,
          dropPane: null,
          dropQuick: false,
        });
      },
      onDrag: ({ location }) => updateIndicator(location.current.dropTargets),
      onDropTargetChange: ({ location }) => updateIndicator(location.current.dropTargets),
      onDrop: ({ source, location }) => {
        try {
          handleDrop(source.data as unknown as DragSource, location.current.dropTargets);
        } finally {
          useStore.getState().resetDrag();
        }
      },
    });

    const offExternal = monitorForExternal({
      canMonitor: ({ source }) => containsFiles({ source }),
      onDragStart: () => {
        useStore.getState().setDrag({
          active: true,
          kind: 'file',
          ids: [],
          indicator: null,
          dropFolderId: null,
          dropPane: null,
          dropQuick: false,
        });
      },
      onDrag: ({ location }) => updateIndicator(location.current.dropTargets),
      onDropTargetChange: ({ location }) => updateIndicator(location.current.dropTargets),
      onDrop: ({ source, location }) => {
        useStore.getState().resetDrag();
        if (!location.current.dropTargets.length) return;
        const files = getFiles({ source });
        if (files.length) fileDropHandler?.(files);
      },
    });

    return () => {
      offElement();
      offExternal();
    };
  }, []);
}
