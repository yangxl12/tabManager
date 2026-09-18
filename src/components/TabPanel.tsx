import { useRef } from 'react';
import { useStore, useT } from '@/store';
import { EmptyTabsArt, IconHelp, IconX } from './icons';
import { TabCard } from './TabCard';
import { useAutoScroll, usePaneTarget } from '@/dnd/dnd';

export function TabPanel() {
  const t = useT();
  const tabs = useStore((s) => s.tabs);
  const selected = useStore((s) => s.selectedTabs);
  const selectAllTabs = useStore((s) => s.selectAllTabs);
  const clearTabSel = useStore((s) => s.clearTabSel);
  const closeTabsByIds = useStore((s) => s.closeTabsByIds);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const gridRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const entering = firstRender.current;
  if (firstRender.current && tabs.length) firstRender.current = false;

  const list = tabs;
  const selCount = selected.length;

  usePaneTarget({ elementRef: gridRef, scope: 'tab' });
  useAutoScroll(gridRef);

  return (
    <div className="pane-tabs">
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
          <>
            <span className="count-pill">{list.length}</span>
            <div className="sec-hint">{t('tabs.hint')}</div>
            <div className="sec-ops">
              <button
                className="btn btn--sm"
                disabled={!list.length}
                onClick={() => selectAllTabs(list.map((tab) => tab.id))}
              >
                {t('common.selectAll')}
              </button>
              <button
                className="ico-btn help-btn"
                title={t('tabs.helpTitle')}
                onClick={toggleHelp}
              >
                <IconHelp size={15} />
              </button>
            </div>
          </>
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
