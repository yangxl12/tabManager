/**
 * 拖拽系统（pragmatic-drag-and-drop）
 * 5 个场景：标签排序 / 标签→书签 / 书签排序 / 书签·文件夹→文件夹 / JSON 文件拖入
 * 所有落点逻辑集中在 useDndRoot 的 monitor 里，卡片只负责注册自身。
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
import { useStore } from '@/store';

export type DragKind = 'tab' | 'bookmark';

export interface DragData {
  kind: DragKind;
  id: string;
  parentId: string | null;
  ids: string[];
  color: string;
  index: number;
}

interface SortTargetData {
  kind: DragKind;
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

type AnyTargetData = SortTargetData | FolderTargetData | PaneTargetData | Record<string, unknown>;

function isDragData(data: unknown): data is DragData {
  if (!data || typeof data !== 'object') return false;
  const k = (data as { kind?: unknown }).kind;
  return k === 'tab' || k === 'bookmark';
}

/* ------------------------------ 注册：可拖拽卡片 ------------------------------ */

export function useCardDrag({
  elementRef,
  disabled,
  getData,
}: {
  elementRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  getData: () => DragData;
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
  kind: DragKind;
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
        if (!isDragData(data)) return false;
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
      canDrop: ({ source }) => isDragData(source.data),
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
        if (!isDragData(data)) return false;
        return scope === 'tab' ? data.kind === 'tab' : true;
      },
      getDropEffect: () => 'move',
    });
  }, [elementRef, scope]);
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
    if (st.drag.indicator || st.drag.dropFolderId || st.drag.dropPane) {
      st.setDrag({ indicator: null, dropFolderId: null, dropPane: null });
    }
    return;
  }
  const d = top.data as AnyTargetData;

  if (d.kind === 'folder') {
    const id = (d as FolderTargetData).id;
    if (st.drag.dropFolderId !== id) {
      st.setDrag({ dropFolderId: id, indicator: null, dropPane: null });
    }
    return;
  }
  if (d.kind === 'pane') {
    const scope = (d as PaneTargetData).scope;
    if (st.drag.dropPane !== scope) {
      st.setDrag({ dropPane: scope, indicator: null, dropFolderId: null });
    }
    return;
  }
  if (d.kind === 'tab' || d.kind === 'bookmark') {
    const id = (d as SortTargetData).id;
    // 落点在自己那一组身上：不显示插入线，但保留所在面板的高亮，避免边界抖动闪烁
    if (st.drag.ids.includes(id)) {
      if (st.drag.indicator) st.setDrag({ indicator: null });
      return;
    }
    const edge = extractClosestEdge(top.data);
    const side: 'before' | 'after' = edge === 'right' ? 'after' : 'before';
    const cur = st.drag.indicator;
    if (!cur || cur.kind !== d.kind || cur.targetId !== id || cur.side !== side) {
      st.setDrag({ indicator: { kind: d.kind, targetId: id, side }, dropFolderId: null });
    }
    return;
  }
  if (st.drag.indicator || st.drag.dropFolderId || st.drag.dropPane) {
    st.setDrag({ indicator: null, dropFolderId: null, dropPane: null });
  }
}

function handleDrop(source: DragData, targets: DropTargetRecord[]): void {
  const top = targets[0];
  if (!top) return;
  const st = useStore.getState();
  const d = top.data as AnyTargetData;

  // 落在被拖动的那一组自己身上：不做任何事
  if ((d.kind === 'tab' || d.kind === 'bookmark') && source.ids.includes((d as SortTargetData).id)) {
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
      canMonitor: ({ source }) => isDragData(source.data),
      onDragStart: ({ source }) => {
        const data = source.data as unknown as DragData;
        useStore.getState().setDrag({
          active: true,
          kind: data.kind,
          ids: data.ids,
          indicator: null,
          dropFolderId: null,
          dropPane: null,
        });
      },
      onDrag: ({ location }) => updateIndicator(location.current.dropTargets),
      onDropTargetChange: ({ location }) => updateIndicator(location.current.dropTargets),
      onDrop: ({ source, location }) => {
        try {
          handleDrop(source.data as unknown as DragData, location.current.dropTargets);
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
