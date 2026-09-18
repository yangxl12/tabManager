import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '@/store';
import type { ToastItem } from '@/lib/types';
import { IconCheck, IconWarn, IconX } from './icons';

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, item.duration);
    return () => window.clearTimeout(t);
  }, [item.duration, onClose]);

  return (
    <motion.div
      className={`toast${item.tone === 'warn' ? ' toast--warn' : ''}${item.tone === 'danger' ? ' toast--danger' : ''}`}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
    >
      <span className="toast__ic">
        {item.tone === 'ok' ? <IconCheck size={14} /> : item.tone === 'warn' ? <IconWarn size={14} /> : <IconX size={13} />}
      </span>
      <span className="toast__msg">{item.msg}</span>
      {item.action ? (
        <button
          className="toast__act"
          onClick={() => {
            onClose();
            item.onAction?.();
          }}
        >
          {item.action}
        </button>
      ) : null}
      <span className="toast__bar" style={{ animationDuration: `${item.duration}ms` }} />
    </motion.div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastView key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
