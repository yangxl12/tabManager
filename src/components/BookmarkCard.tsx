import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '@/store';
import { colorFor } from '@/lib/colors';
import { hostOf } from '@/lib/url';
import type { BmNode } from '@/lib/types';
import { InlineEdit } from './InlineEdit';
import { Tile } from './Tile';
import { IconPencil, IconX } from './icons';
import { useCardDrag, useSortableTarget } from '@/dnd/dnd';
import type { FlashField } from '@/store/slice';

interface Props {
  node: BmNode;
  index: number;
  entering: boolean;
}

export const BookmarkCard = memo(function BookmarkCard({ node, index, entering }: Props) {
  const cellRef = useRef<HTMLElement>(null);
  const [field, setField] = useState<FlashField | null>(null);
  /** 编辑态失焦即结束编辑，紧接着那一下 click 不该再触发「打开书签」 */
  const swallowed = useRef(false);

  const selected = useStore((s) => s.selectedBms.includes(node.id));
  const closing = useStore((s) => s.closingBms.includes(node.id));
  const autoEdit = useStore((s) => s.autoEdit);
  const indicator = useStore((s) =>
    s.drag.indicator?.kind === 'bookmark' && s.drag.indicator.targetId === node.id
      ? s.drag.indicator.side
      : null,
  );
  const dragging = useStore(
    (s) => s.drag.active && s.drag.kind === 'bookmark' && s.drag.ids.includes(node.id),
  );

  const seed = node.title || hostOf(node.url) || '?';
  const color = colorFor(seed);
  const editing = field !== null;

  useEffect(() => {
    if (!autoEdit || autoEdit.id !== node.id) return;
    setField(autoEdit.field);
    useStore.getState().consumeAutoEdit();
  }, [autoEdit, node.id]);

  const startEdit = (f: FlashField) => {
    if (closing) return;
    // 多选模式下点击卡片是勾选语义，不进编辑态
    if (useStore.getState().selectedBms.length > 0) return;
    setField(f);
  };

  const exitEdit = () => {
    setField(null);
    useStore.getState().finalizeShare(node.id);
  };

  useCardDrag({
    elementRef: cellRef,
    disabled: closing || editing,
    getData: () => {
      const st = useStore.getState();
      const sel = st.selectedBms;
      return {
        kind: 'bookmark',
        id: node.id,
        parentId: node.parentId,
        ids: sel.includes(node.id) ? [...sel] : [node.id],
        color,
        index,
      };
    },
  });

  useSortableTarget({
    elementRef: cellRef,
    kind: 'bookmark',
    getData: () => ({ kind: 'bookmark', id: node.id, parentId: node.parentId, index }),
  });

  const cls = [
    'bm-card',
    selected ? 'is-sel' : '',
    closing ? 'is-closing' : '',
    dragging ? 'dragging' : '',
    entering ? 'enter' : '',
    node.isDraft ? 'is-draft' : '',
    editing ? 'is-editing' : '',
    indicator === 'before' ? 'drop-b' : '',
    indicator === 'after' ? 'drop-a' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.article
      layout
      ref={cellRef}
      className="bm-cell"
      data-bm-card={node.id}
      data-color={color}
      data-testid="bm-card"
    >
      <div
        className={cls}
        style={entering ? { animationDelay: `${Math.min(index * 22, 320)}ms` } : undefined}
        onMouseDown={() => {
          if (editing) swallowed.current = true;
        }}
        onClick={(e) => {
          if (swallowed.current) {
            swallowed.current = false;
            return;
          }
          if (closing || editing) return;
          const st = useStore.getState();
          if (st.selectedBms.length > 0 || e.shiftKey || e.ctrlKey || e.metaKey) {
            st.toggleBmSel(node.id, e);
            return;
          }
          void st.openBookmark(node.id);
        }}
      >
        <div className="bm-card__top">
          <Tile url={node.url} seed={seed} />
          <div className="bm-card__head">
            <InlineEdit
              value={node.title}
              placeholder="输入名称"
              className="bm-card__name"
              editing={editing}
              active={field === 'name'}
              revertOnEmpty
              emptyStyle
              title={node.title || undefined}
              onCancel={exitEdit}
              onRevert={() => setField('url')}
              onCommit={(v) => {
                useStore.getState().commitEdit(node.id, 'name', v);
                // 名称确定后光标自动落到网址输入框
                setField('url');
              }}
            />
          </div>
        </div>

        <div className="bm-card__btm">
          <button
            className={`pick${selected ? ' is-on' : ''}`}
            title="选择"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              useStore.getState().toggleBmSel(node.id, e);
            }}
          />
          <div className="bm-card__hostwrap">
            <InlineEdit
              value={node.url}
              displayValue={hostOf(node.url)}
              placeholder="输入网址"
              className="bm-card__host"
              inputClassName="soft"
              editing={editing}
              active={field === 'url'}
              revertOnEmpty
              emptyStyle
              title={node.url || undefined}
              onCancel={exitEdit}
              onRevert={exitEdit}
              onCommit={(v) => {
                useStore.getState().commitEdit(node.id, 'url', v);
                exitEdit();
              }}
            />
          </div>
          {editing ? (
            <span className="bm-card__editspace" />
          ) : (
            <button
              className="bm-card__edit"
              title="编辑名称与网址"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                startEdit('name');
              }}
            >
              <IconPencil size={12} />
            </button>
          )}
        </div>

        <button
          className="xbtn"
          title="删除（可 Ctrl+Z 撤回）"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void useStore.getState().deleteNodes([node.id]);
          }}
        >
          <IconX size={11} />
        </button>
      </div>
    </motion.article>
  );
});
