import { useCallback, useEffect, useRef, useState } from 'react';
import { bootstrapStore, useStore, useT } from '@/store';
import { applyTheme } from '@/lib/theme';
import { initFxLayer } from '@/lib/fx';
import { Toasts } from './Toasts';
import { QuickSites } from './QuickSites';
import { TabPanel } from './TabPanel';
import { Splitter } from './Splitter';
import { BookmarkTree } from './BookmarkTree';
import { BookmarkGrid } from './BookmarkGrid';
import { BookmarkSearchModal } from './BookmarkSearchModal';
import { ImportModal } from './ImportModal';
import { HelpPanel } from './HelpPanel';
import { useDndRoot } from '@/dnd/dnd';

interface ImportState {
  open: boolean;
  prefill: string;
  token: number;
}

const CLOSED: ImportState = { open: false, prefill: '', token: 0 };

export function App() {
  const t = useT();
  const fxRef = useRef<HTMLDivElement>(null);
  const panelWidth = useStore((s) => s.panelWidth);
  const searchOpen = useStore((s) => s.searchOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const theme = useStore((s) => s.theme);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 1080);
  const [imp, setImp] = useState<ImportState>(CLOSED);

  useDndRoot();

  useEffect(() => {
    // 初始化挂了必须看得见：否则监听器不注册、页面停在半死状态，
    // 控制台里只剩一条没人看的 promise rejection
    void bootstrapStore().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      useStore.getState().toast(t('toast.initFail', { msg }), { tone: 'warn', duration: 12000 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initFxLayer(fxRef.current);
    return () => initFxLayer(null);
  }, []);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 1080);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 主题落到 <html data-theme>（+ 刷新 localStorage 镜像）；
  // 「跟随系统」时还要跟着系统偏好实时切换
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => applyTheme('system');
    mq.addEventListener('change', onSystem);
    return () => mq.removeEventListener('change', onSystem);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const st = useStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        st.setSearchOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        if (imp.open) {
          setImp(CLOSED);
          return;
        }
        if (st.searchOpen) {
          st.setSearchOpen(false);
          return;
        }
        if (st.helpOpen) {
          st.setHelpOpen(false);
          return;
        }
        if (st.selectedTabs.length || st.selectedBms.length) {
          st.clearTabSel();
          st.clearBmSel();
        }
        return;
      }
      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void st.undo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedBms.length) {
        e.preventDefault();
        void st.deleteNodes([...st.selectedBms]);
        return;
      }
      if (e.key === 'Delete' && st.selectedTabs.length) {
        e.preventDefault();
        void st.closeTabsByIds([...st.selectedTabs]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imp.open]);

  const openImport = useCallback((prefill = '') => {
    setImp((s) => ({ open: true, prefill, token: s.token + 1 }));
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      const f = files.find((x) => /\.json$/i.test(x.name) || x.type === 'application/json');
      if (!f) {
        useStore.getState().toast(t('toast.onlyJson'), { tone: 'warn' });
        return;
      }
      const fr = new FileReader();
      fr.onload = () => openImport(String(fr.result ?? ''));
        fr.readAsText(f, 'utf-8');
      },
    [openImport, t],
  );

  return (
    <div className="app">
      <div className="main">
        <section
          className="panel panel--tabs"
          style={narrow ? undefined : { width: `${panelWidth}%` }}
        >
          <QuickSites />
          <TabPanel />
        </section>

        <Splitter />

        <section className="panel panel--bm">
          <BookmarkTree />
          <BookmarkGrid
            onOpenImport={() => openImport()}
            onOpenSearch={() => setSearchOpen(true)}
            onFiles={handleFiles}
          />
        </section>
      </div>

      <BookmarkSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ImportModal
        open={imp.open}
        prefillText={imp.prefill}
        token={imp.token}
        onClose={() => setImp(CLOSED)}
      />
      <HelpPanel />
      <Toasts />
      <div className="fx-layer" ref={fxRef} />
    </div>
  );
}
