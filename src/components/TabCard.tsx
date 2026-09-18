import { memo, useRef } from 'react';
import { motion } from 'motion/react';
import { useStore } from '@/store';
import { colorFor } from '@/lib/colors';
import { hostOf } from '@/lib/url';
import type { TabItem } from '@/lib/types';
import { Tile } from './Tile';
import { IconX } from './icons';
import { useCardDrag, useSortableTarget } from '@/dnd/dnd';

interface Props {
  tab: TabItem;
  index: number;
  entering: boolean;
}

export const TabCard = memo(function TabCard({ tab, index, entering }: Props) {
  const cellRef = useRef<HTMLElement>(null);

  const selected = useStore((s) => s.selectedTabs.includes(tab.id));
  const closing = useStore((s) => s.closingTabs.includes(tab.id));
  const indicator = useStore((s) =>
    s.drag.indicator?.kind === 'tab' && s.drag.indicator.targetId === String(tab.id)
      ? s.drag.indicator.side
      : null,
  );
  const dragging = useStore(
    (s) => s.drag.active && s.drag.kind === 'tab' && s.drag.ids.includes(String(tab.id)),
  );

  const seed = hostOf(tab.url) || tab.title || '?';
  const color = colorFor(seed);

  useCardDrag({
    elementRef: cellRef,
    disabled: closing,
    getData: () => {
      const st = useStore.getState();
      const selfId = String(tab.id);
      const sel = st.selectedTabs.map(String);
      return {
        kind: 'tab',
        id: selfId,
        parentId: null,
        ids: sel.includes(selfId) ? sel : [selfId],
        color,
        index,
      };
    },
  });

  useSortableTarget({
    elementRef: cellRef,
    kind: 'tab',
    getData: () => ({ kind: 'tab', id: String(tab.id), parentId: null, index }),
  });

  const cls = [
    'tab-card',
    selected ? 'is-sel' : '',
    closing ? 'is-closing' : '',
    dragging ? 'dragging' : '',
    entering ? 'enter' : '',
    indicator === 'before' ? 'drop-b' : '',
    indicator === 'after' ? 'drop-a' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.article
      layout
      ref={cellRef}
      className="tab-cell"
      data-tab-card={tab.id}
      data-color={color}
      data-testid="tab-card"
    >
      <div
        className={cls}
        style={entering ? { animationDelay: `${Math.min(index * 26, 340)}ms` } : undefined}
        title={tab.title}
        onClick={(e) => {
          if (closing) return;
          const st = useStore.getState();
          if (st.selectedTabs.length > 0 || e.shiftKey || e.ctrlKey || e.metaKey) {
            st.toggleTabSel(tab.id, e);
            return;
          }
          void st.openTab(tab.url);
        }}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            void useStore.getState().closeTabsByIds([tab.id]);
          }
        }}
      >
        <div className="tab-card__top">
          <Tile url={tab.url} seed={seed} />
          <div className="tab-card__ttl">{tab.title}</div>
        </div>
        <div className="tab-card__btm">
          <button
            className={`pick${selected ? ' is-on' : ''}`}
            title="选择"
            onClick={(e) => {
              e.stopPropagation();
              useStore.getState().toggleTabSel(tab.id, e);
            }}
          />
          <div className="tab-card__host">{tab.pinned ? '📌 ' : ''}{hostOf(tab.url)}</div>
        </div>
        <button
          className="xbtn"
          title="关闭标签"
          onClick={(e) => {
            e.stopPropagation();
            void useStore.getState().closeTabsByIds([tab.id]);
          }}
        >
          <IconX size={11} />
        </button>
      </div>
    </motion.article>
  );
});
