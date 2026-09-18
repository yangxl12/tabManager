import { useRef } from 'react';
import { useStore } from '@/store';
import { EmptyTabsArt, IconHelp, IconX } from './icons';
import { TabCard } from './TabCard';
import { useAutoScroll, usePaneTarget } from '@/dnd/dnd';

export function TabPanel() {
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
        <div className="sec-title">已打开的标签</div>
        {selCount > 0 ? (
          <>
            <span
              className="count-pill"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
            >
              已选 {selCount}
            </span>
            <div className="sec-hint">多选模式 · 单击卡片即勾选，不再打开网站</div>
            <div className="sec-ops">
              <button className="btn btn--sm btn--ghost" onClick={clearTabSel}>
                取消选择
              </button>
              <button
                className="btn btn--sm btn--danger"
                onClick={() => void closeTabsByIds(selected)}
              >
                <IconX size={10} /> 关闭选中
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="count-pill">{list.length}</span>
            <div className="sec-hint">拖拽排序 · 拖到右侧存为书签</div>
            <div className="sec-ops">
              <button
                className="btn btn--sm"
                disabled={!list.length}
                onClick={() => selectAllTabs(list.map((t) => t.id))}
              >
                全选
              </button>
              <button
                className="ico-btn help-btn"
                title="快捷键与操作（Esc 关闭）"
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
            <div className="empty__t">没有正在打开的标签</div>
            <div className="empty__s">打开新的网页后，这里会自动出现卡片</div>
          </div>
        )}
      </div>
    </div>
  );
}
