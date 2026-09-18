import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store';
import { totalFolders, visibleRows } from '@/lib/bookmarkTree';
import { colorFor } from '@/lib/colors';
import { IconChevron, IconFolder, IconFolderPlus, IconPencil, IconTrash } from './icons';
import { RowMenu } from './RowMenu';
import { useCardDrag, useFolderTarget } from '@/dnd/dnd';

function TreeRow({
  id,
  depth,
  hasChildren,
  open,
  renaming,
  onRename,
}: {
  id: string;
  depth: number;
  hasChildren: boolean;
  open: boolean;
  renaming: boolean;
  onRename: (id: string, title: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const node = useStore((s) => s.bm.nodes[id]);
  const active = useStore((s) => s.currentFolder === id);
  const isDrop = useStore((s) => s.drag.dropFolderId === id);
  const dragging = useStore(
    (s) => s.drag.active && s.drag.kind === 'bookmark' && s.drag.ids.includes(id),
  );
  const goto = useStore((s) => s.gotoFolder);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const createFolder = useStore((s) => s.createFolder);
  const deleteFolderTree = useStore((s) => s.deleteFolderTree);

  const color = colorFor(node?.title || id);

  useFolderTarget({ elementRef: rowRef, id });
  useCardDrag({
    elementRef: rowRef,
    disabled: renaming,
    getData: () => ({
      kind: 'bookmark',
      id,
      parentId: node?.parentId ?? null,
      ids: [id],
      color,
      index: 0,
    }),
  });

  if (!node) return null;

  return (
    <div
      ref={rowRef}
      className={`tree-row${active ? ' is-active' : ''}${isDrop ? ' is-drop' : ''}${dragging ? ' dragging' : ''}`}
      style={{ ['--d' as string]: depth }}
      title={node.title}
      data-tree-row={id}
      onClick={(e) => {
        e.stopPropagation();
        if (renaming) return;
        goto(id);
      }}
    >
      {hasChildren ? (
        <button
          className={`tree-caret${open ? ' is-open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(id);
          }}
        >
          <IconChevron size={9} />
        </button>
      ) : (
        <span className="tree-caret tree-caret--empty" />
      )}
      <span className="tree-ic" style={{ color }}>
        <IconFolder size={15} />
      </span>

      {renaming ? (
        <input
          className="mini-input"
          style={{ margin: '0 2px', fontSize: 13, fontWeight: 500, padding: '3px 6px' }}
          defaultValue={node.title}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.currentTarget.value = node.title;
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => onRename(id, e.currentTarget.value)}
        />
      ) : (
        <span className="tree-name">{node.title}</span>
      )}

      {renaming ? null : (
        <RowMenu
          marker={id}
          title={`「${node.title}」更多操作`}
          items={[
            {
              key: 'rename',
              label: '重命名',
              icon: <IconPencil size={13} />,
              onPick: () => onRename(id, '\u0000__start__'),
            },
            {
              key: 'child',
              label: '新建子文件夹',
              icon: <IconFolderPlus size={13} />,
              onPick: () => createFolder(id),
            },
            {
              key: 'remove',
              label: '删除文件夹',
              icon: <IconTrash size={13} />,
              danger: true,
              onPick: () => deleteFolderTree(id),
            },
          ]}
        />
      )}
    </div>
  );
}

export function BookmarkTree() {
  const bm = useStore((s) => s.bm);
  const expanded = useStore((s) => s.expanded);
  const autoEdit = useStore((s) => s.autoEdit);
  const renameNode = useStore((s) => s.renameNode);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const rows = useMemo(() => visibleRows(bm, new Set(expanded)), [bm, expanded]);
  const folderCount = useMemo(() => totalFolders(bm), [bm]);

  const startRename = (id: string, title: string) => {
    if (title === '\u0000__start__') {
      setRenamingId(id);
      return;
    }
    setRenamingId(null);
    renameNode(id, title);
  };

  // 新建文件夹触发的自动编辑（书签卡片的自动编辑由卡片自己消费）
  useEffect(() => {
    if (!autoEdit) return;
    if (bm.nodes[autoEdit.id]?.isFolder) {
      setRenamingId(autoEdit.id);
      useStore.getState().consumeAutoEdit();
    }
  }, [autoEdit, bm]);

  return (
    <aside className="pane-tree">
      <div className="sec-head">
        <div className="sec-title">书签文件夹</div>
        <div className="sec-ops">
          <span className="count-pill">{folderCount}</span>
        </div>
      </div>

      <div className="tree scroll">
        {rows.length ? (
          rows.map((r, i) => (
            <Fragment key={r.node.id}>
              {/* 账号书签 / 此设备书签：只有两套存储同时存在时才显示分组标题 */}
              {r.groupLabel && r.groupKey !== rows[i - 1]?.groupKey ? (
                <div className="tree-group">{r.groupLabel}</div>
              ) : null}
              <TreeRow
                id={r.node.id}
                depth={r.depth}
                hasChildren={r.hasChildren}
                open={r.open}
                renaming={renamingId === r.node.id}
                onRename={startRename}
              />
            </Fragment>
          ))
        ) : (
          <div className="empty" style={{ padding: '20px 8px' }}>
            <div className="empty__s">还没有读到书签文件夹</div>
          </div>
        )}
      </div>
    </aside>
  );
}
