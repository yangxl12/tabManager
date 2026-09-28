import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, useT } from '@/store';
import type { I18nKey } from '@/lib/i18n';
import { IconX } from './icons';

const ROWS: Array<{ label: I18nKey; hint?: I18nKey; keys: string[] }> = [
  { label: 'help.undo', hint: 'help.undoHint', keys: ['Ctrl', 'Z'] },
  { label: 'help.multi', hint: 'help.multiHint', keys: ['Ctrl', '点击', 'Shift'] },
  { label: 'help.enterMulti', hint: 'help.enterMultiHint', keys: ['点击'] },
  { label: 'help.batchDel', hint: 'help.batchDelHint', keys: ['Del'] },
  { label: 'help.esc', keys: ['Esc'] },
  { label: 'help.search', hint: 'help.searchHint', keys: ['Ctrl', 'K'] },
  { label: 'help.dragToBm', hint: 'help.dragToBmHint', keys: ['Drag'] },
  { label: 'help.dragCards', hint: 'help.dragCardsHint', keys: ['Drag'] },
  { label: 'help.dragQuick', hint: 'help.dragQuickHint', keys: ['Drag'] },
  { label: 'help.ctrlMulti', hint: 'help.ctrlMultiHint', keys: ['Ctrl'] },
];

export function HelpPanel() {
  const t = useT();
  const open = useStore((s) => s.helpOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target)) return;
      // 帮助菜单项本身负责切换，避免 mousedown 关闭后 click 又重新打开。
      if (
        target instanceof Element &&
        target.closest('.row-menu[data-row-menu="tools"] [data-row-item="help"]')
      ) return;
      setHelpOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open, setHelpOpen]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          key="help"
          className="help"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
        >
          <div className="help__head">
            <h4>{t('help.title')}</h4>
            <button
              className="help__close"
              type="button"
              title={t('common.close')}
              aria-label={t('common.close')}
              onClick={() => setHelpOpen(false)}
            >
              <IconX size={13} />
            </button>
          </div>
          {ROWS.map((r) => (
            <div className="kbd-row" key={r.label}>
              <span>{t(r.label)}</span>
              {r.hint ? <em>{t(r.hint)}</em> : null}
              {r.keys.map((k, i) => (
                <kbd key={`${k}-${i}`}>{k}</kbd>
              ))}
            </div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
