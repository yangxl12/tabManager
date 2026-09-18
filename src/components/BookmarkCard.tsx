import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '@/store';
import { colorFor } from '@/lib/colors';
import { hostOf } from '@/lib/url';
import type { BmNode } from '@/lib/types';
import { InlineEdit } from './InlineEdit';
import { Tile } from './Tile';
import { IconX } from './icons';
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

  useEffect(() => {
    if (!autoEdit || autoEdit.id !== node.id) return;
    setField(autoEdit.field);
    useStore.getState().consumeAutoEdit();
  }, [autoEdit, node.id]);

  useCardDrag({
    elementRef: cellRef,
    disabled: closing || field !== null,
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
        onClick={(e) => {
          if (closing || field) return;
          const st = useStore.getState();
          if (st.selectedBms.length > 0 || e.shiftKey || e.ctrlKey || e.metaKey) {
            st.toggleBmSel(node.id, e);
            return;
          }
          void st.openBookmark(node.id);
        }}
      >
        <Tile url={node.url} seed={seed} />
        <div className="bm-card__meta">
          <InlineEdit
            value={node.title}
            placeholder="输入名称"
            className="bm-card__name"
            editing={field === 'name'}
            emptyStyle
            title="点击修改名称"
            onStart={() => setField('name')}
            onCancel={() => setField(null)}
            onCommit={(v) => {
              const st = useStore.getState();
              st.commitEdit(node.id, 'name', v);
              st.finalizeShare(node.id);
              setField(null);
            }}
          />
          <InlineEdit
            value={node.url}
            displayValue={hostOf(node.url)}
            placeholder="输入域名"
            className="bm-card__host"
            inputClassName="soft"
            editing={field === 'url'}
            emptyStyle
            title="点击修改域名"
            onStart={() => setField('url')}
            onCancel={() => setField(null)}
            onCommit={(v) => {
              const st = useStore.getState();
              st.commitEdit(node.id, 'url', v);
              st.finalizeShare(node.id);
              setField(null);
            }}
          />
          {!node.url && !field ? <span style={{ display: 'none' }} /> : null}
        </div>
        <div className="bm-card__ops">
          <button
            className={`pick${selected ? ' is-on' : ''}`}
            title="选择"
            onClick={(e) => {
              e.stopPropagation();
              useStore.getState().toggleBmSel(node.id, e);
            }}
          />
          <button
            className="xbtn"
            title="删除（可 Ctrl+Z 撤回）"
            onClick={(e) => {
              e.stopPropagation();
              void useStore.getState().deleteNodes([node.id]);
            }}
          >
            <IconX size={11} />
          </button>
        </div>
      </div>
    </motion.article>
  );
});
