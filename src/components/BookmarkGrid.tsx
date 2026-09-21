import { useEffect, useMemo, useRef } from 'react';
import { useStore, useT } from '@/store';
import { childrenOf, countOf, pathOf } from '@/lib/bookmarkTree';
import { EmptyBmsArt, IconFolder, IconGlobe, IconPlus, IconSearch, IconUpload } from './icons';
import { BookmarkCard } from './BookmarkCard';
import { ThemeMenu } from './ThemeMenu';
import { domCells, useAutoScroll, useExternalFileTarget, useFolderTarget, usePaneTarget } from '@/dnd/dnd';

/** 界面语言切换：地球图标，点击 zh / en 互切（真源在 uiSlice.lang） */
function LangToggle() {
  const t = useT();
  const toggleLang = useStore((s) => s.toggleLang);
  const tip = t('lang.tip');
  return (
    <button
      className="ico-btn lang-btn"
      title={tip}
      aria-label={tip}
      onClick={toggleLang}
    >
      <IconGlobe size={15} />
    </button>
  );
}

function SubChip({ id }: { id: string }) {
  const chipRef = useRef<HTMLButtonElement>(null);
  const node = useStore((s) => s.bm.nodes[id]);
  const count = useStore((s) => countOf(s.bm, id));
  const goto = useStore((s) => s.gotoFolder);
  const isDrop = useStore((s) => s.drag.dropFolderId === id);
  useFolderTarget({ elementRef: chipRef, id });
  if (!node) return null;
  return (
    <button ref={chipRef} className={`chip${isDrop ? ' is-drop' : ''}`} onClick={() => goto(id)}>
      <span style={{ color: 'var(--color-jade)', display: 'grid', placeItems: 'center' }}>
        <IconFolder size={14} />
      </span>
      <b>{node.title}</b>
      <span className="n">{count}</span>
    </button>
  );
}

export function BookmarkGrid({
  onOpenImport,
  onOpenSearch,
  onFiles,
}: {
  onOpenImport: () => void;
  onOpenSearch: () => void;
  onFiles: (files: File[]) => void;
}) {
  const t = useT();
  const paneRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const bm = useStore((s) => s.bm);
  const currentFolder = useStore((s) => s.currentFolder);
  const selected = useStore((s) => s.selectedBms);
  const dropHint = useStore((s) => s.dropHint);
  const dropPane = useStore((s) => s.drag.dropPane);
  const dragKind = useStore((s) => s.drag.kind);
  // 外部文件拖入 → 强提示（虚线框 + 底色）；内部书签拖拽 → 弱提示（只有虚线描边）
  const paneReady = dropPane === 'bookmark' && dragKind === 'file';
  const paneHint = dropPane === 'bookmark' && dragKind !== 'file';
  const flashSeq = useStore((s) => s.flashSeq);

  const selectAllBms = useStore((s) => s.selectAllBms);
  const clearBmSel = useStore((s) => s.clearBmSel);
  const deleteNodes = useStore((s) => s.deleteNodes);
  const gotoFolder = useStore((s) => s.gotoFolder);

  const folder = bm.nodes[currentFolder];
  const all = useMemo(() => childrenOf(bm, currentFolder), [bm, currentFolder]);
  const kids = useMemo(() => all.filter((n) => n.isFolder), [all]);
  const crumb = useMemo(() => pathOf(bm, currentFolder), [bm, currentFolder]);

  const list = useMemo(() => all.filter((n) => !n.isFolder), [all]);

  const firstRender = useRef(true);
  const entering = firstRender.current && list.length > 0;
  if (entering) firstRender.current = false;

  usePaneTarget({
    elementRef: paneRef,
    scope: 'bookmark',
    // 面板空白（卡片缝 / 第一行上方）也算排序落点：取最近卡片，别一律扔到末尾
    getCells: () => domCells(gridRef.current, '[data-bm-card]', 'data-bm-card', currentFolder),
  });
  useExternalFileTarget({ elementRef: paneRef, onFiles });
  useAutoScroll(gridRef);

  // 还原 / 新建后的 flash 高亮
  useEffect(() => {
    if (!flashSeq) return;
    const { flashIds } = useStore.getState();
    const grid = gridRef.current;
    const timers = flashIds.map((id, i) =>
      window.setTimeout(() => {
        const el = grid?.querySelector<HTMLElement>(`[data-bm-card="${id}"] .bm-card`);
        if (!el) return;
        el.classList.remove('is-flash');
        void el.offsetWidth;
        el.classList.add('is-flash');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, i * 45),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [flashSeq]);

  return (
    <div
      ref={paneRef}
      className={`pane-main${paneReady ? ' drop-ready' : ''}${paneHint ? ' drop-hint' : ''}`}
      data-bm-pane="1"
    >
      <div className="sec-head">
        <div className="sec-title">{folder?.title || t('bm.fallbackTitle')}</div>
        <span className="count-pill">{list.length}</span>
        {selected.length > 0 ? <div className="sec-hint">{t('bm.multiHint')}</div> : null}
        <div className="sec-ops">
          <button
            className="ico-btn bm-search-btn"
            title={t('bm.searchTitle')}
            onClick={onOpenSearch}
          >
            <IconSearch size={15} />
          </button>
          <LangToggle />
          <ThemeMenu />
          {selected.length > 0 ? (
            <>
              <button className="btn btn--sm btn--ghost" onClick={clearBmSel}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--sm btn--danger" onClick={() => void deleteNodes(selected)}>
                {t('bm.delSel', { n: selected.length })}
              </button>
              <button
                className="btn btn--sm btn--dark"
                onClick={() => useStore.getState().createBookmarkDraft()}
              >
                <IconPlus size={12} /> {t('common.new')}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn--sm"
                disabled={!list.length}
                onClick={() => selectAllBms(list.map((n) => n.id))}
              >
                {t('common.selectAll')}
              </button>
              <button
                className="btn btn--sm btn--dark"
                onClick={() => useStore.getState().createBookmarkDraft()}
              >
                <IconPlus size={12} /> {t('common.new')}
              </button>
              <button className="btn btn--sm" onClick={onOpenImport}>
                <IconUpload size={12} /> {t('bm.import')}
              </button>
            </>
          )}
        </div>
      </div>

      {crumb.length > 1 ? (
        <div className="crumb">
          {crumb.slice(0, -1).map((x) => (
            <span key={x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <button onClick={() => gotoFolder(x.id)}>{x.title}</button>
              <span className="sep">/</span>
            </span>
          ))}
          <span className="cur">{crumb[crumb.length - 1].title}</span>
        </div>
      ) : null}

      {kids.length ? (
        <div className="subchips">
          {kids.map((k) => (
            <SubChip key={k.id} id={k.id} />
          ))}
        </div>
      ) : null}

      <div
        ref={gridRef}
        className={`grid bm-grid scroll${selected.length > 0 ? ' select-mode' : ''}`}
        data-bm-grid="1"
      >
        {list.length ? (
          list.map((n, i) => (
            <BookmarkCard key={n.id} node={n} index={i} entering={entering} />
          ))
        ) : (
          <div className="empty">
            <div className="empty__ic">
              <EmptyBmsArt />
            </div>
            <div className="empty__t">{t('bm.emptyT')}</div>
            <div className="empty__s">{t('bm.emptyS')}</div>
          </div>
        )}
      </div>

      {dropHint ? <div className="drop-hint">{dropHint}</div> : null}
    </div>
  );
}
