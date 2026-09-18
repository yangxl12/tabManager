import { AnimatePresence, motion } from 'motion/react';
import { useStore, useT } from '@/store';
import type { I18nKey } from '@/lib/i18n';

const ROWS: Array<{ label: I18nKey; hint?: I18nKey; keys: string[] }> = [
  { label: 'help.undo', hint: 'help.undoHint', keys: ['Ctrl', 'Z'] },
  { label: 'help.multi', hint: 'help.multiHint', keys: ['Ctrl', '点击', 'Shift'] },
  { label: 'help.enterMulti', hint: 'help.enterMultiHint', keys: ['点击'] },
  { label: 'help.batchDel', hint: 'help.batchDelHint', keys: ['Del'] },
  { label: 'help.esc', keys: ['Esc'] },
  { label: 'help.search', hint: 'help.searchHint', keys: ['Ctrl', 'K'] },
  { label: 'help.dragToBm', hint: 'help.dragToBmHint', keys: ['Drag'] },
  { label: 'help.dragCards', hint: 'help.dragCardsHint', keys: ['Drag'] },
  { label: 'help.ctrlMulti', hint: 'help.ctrlMultiHint', keys: ['Ctrl'] },
];

export function HelpPanel() {
  const t = useT();
  const open = useStore((s) => s.helpOpen);
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="help"
          className="help"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
        >
          <h4>{t('help.title')}</h4>
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
