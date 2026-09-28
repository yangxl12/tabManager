import { useRef } from 'react';
import { useStore, useT } from '@/store';
import { EmptyTabsArt, IconX } from './icons';
import { TabCard } from './TabCard';
import { domCells, useAutoScroll, usePaneTarget } from '@/dnd/dnd';

export function TabPanel() {
  const t = useT();
  const tabs = useStore((s) => s.tabs);
  const selected = useStore((s) => s.selectedTabs);
  const selectAllTabs = useStore((s) => s.selectAllTabs);
  const clearTabSel = useStore((s) => s.clearTabSel);
  const closeTabsByIds = useStore((s) => s.closeTabsByIds);
  const gridRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const entering = firstRender.current;
  if (firstRender.current && tabs.length) firstRender.current = false;

  const list = tabs;
  const selCount = selected.length;

  // 落点挂在整块面板上（不只网格）：第一列左侧、第一行上方那几像素也在网格外，
  // 只认网格的话拖到「第一个位置」的边上会完全没反应
  usePaneTarget({
    elementRef: paneRef,
    scope: 'tab',
    getCells: () => domCells(gridRef.current, '[data-tab-card]', 'data-tab-card', null),
  });
  useAutoScroll(gridRef);

  return (
    <div className="pane-tabs" ref={paneRef}>
      <div className="sec-head">
        <div className="sec-title">{t('tabs.title')}</div>
        {selCount > 0 ? (
          <>
            <span
              className="count-pill"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
            >
              {t('tabs.selected', { n: selCount })}
            </span>
            <div className="sec-hint">{t('tabs.multiHint')}</div>
            <div className="sec-ops">
              <button className="btn btn--sm btn--ghost" onClick={clearTabSel}>
                {t('tabs.clearSel')}
              </button>
              <button
                className="btn btn--sm btn--danger"
                onClick={() => void closeTabsByIds(selected)}
              >
                <IconX size={10} /> {t('tabs.closeSel')}
              </button>
            </div>
          </>
        ) : (
          // 常态标题行只留「标题 + 全选」：数量 pill、拖拽提示、帮助入口都是噪声，
          // 需要时会在多选态 / 三个点菜单里出现
          <div className="sec-ops">
            <button
              className="btn btn--sm"
              disabled={!list.length}
              onClick={() => selectAllTabs(list.map((tab) => tab.id))}
            >
              {t('common.selectAll')}
            </button>
          </div>
        )}
      </div>

      <div
        ref={gridRef}
        className={`grid tab-grid scroll${selCount > 0 ? ' select-mode' : ''}`}
      >
        {list.length ? (
          list.map((t, i) => <TabCard key={t.id} tab={t} index={i} entering={entering} />)
        ) : (
          <div className="empty">
            <div className="empty__ic">
              <EmptyTabsArt />
            </div>
            <div className="empty__t">{t('tabs.emptyT')}</div>
            <div className="empty__s">{t('tabs.emptyS')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
