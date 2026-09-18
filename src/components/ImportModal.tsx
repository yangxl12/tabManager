import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useStore, useT } from '@/store';
import { ImportParseError, SAMPLE_JSON, parseImportText } from '@/lib/importParse';
import type { ImportItem } from '@/lib/types';
import { IconX } from './icons';

interface Props {
  open: boolean;
  prefillText: string;
  /** 变化即重挂载，保证每次打开都是干净状态 */
  token: number;
  onClose: () => void;
}

type Mode = 'text' | 'file';

function ImportModalInner({ prefillText, onClose }: Omit<Props, 'open' | 'token'>) {
  const t = useT();
  const folderTitle = useStore((s) => s.bm.nodes[s.currentFolder]?.title ?? '');
  const importItems = useStore((s) => s.importItems);
  const toast = useStore((s) => s.toast);

  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState(prefillText);
  const [fileName, setFileName] = useState('');
  const [dragHot, setDragHot] = useState(false);
  const [parsed, setParsed] = useState<{ items: ImportItem[]; skipped: number } | null>(() => {
    if (!prefillText) return null;
    try {
      return parseImportText(prefillText);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState('');

  const applyText = (value: string) => {
    setText(value);
    if (!value.trim()) {
      setParsed(null);
      setError('');
      return;
    }
    try {
      setParsed(parseImportText(value));
      setError('');
    } catch (err) {
      setParsed(null);
      setError(err instanceof ImportParseError ? err.message : String(err));
    }
  };

  const readFile = (file: File) => {
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      toast(t('imp.pickJson'), { tone: 'warn' });
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      setFileName(file.name);
      applyText(String(fr.result ?? ''));
    };
    fr.readAsText(file, 'utf-8');
  };

  const doImport = async () => {
    if (!parsed?.items.length) {
      toast(t('imp.noItems'), { tone: 'warn' });
      return;
    }
    const n = await importItems(parsed.items);
    if (!n) {
      toast(t('imp.fail'), { tone: 'warn' });
      return;
    }
    onClose();
    toast(t('imp.done', { n, f: folderTitle || t('imp.currentFolder') }));
  };

  const tip = parsed
    ? `${t('imp.tipCount', { n: parsed.items.length })}${
        parsed.skipped ? t('imp.tipSkip', { n: parsed.skipped }) : ''
      }`
    : error || (fileName ? t('imp.chosen', { f: fileName }) : t('imp.tipIdle'));

  return (
    <>
      <div className="modal__mask" />
      <motion.div
        className="modal__box"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
      >
        <div className="modal__h">
          <div>
            <h3>{t('imp.title')}</h3>
            <p>
              {t('imp.descA')}<span className="code">{'[{ name, url }]'}</span>、
              <span className="code">{'{ list: [...] }'}</span>
              {t('imp.descB')}<b>{folderTitle || '—'}</b>
            </p>
          </div>
          <button className="ico-btn" onClick={onClose} title={t('common.close')}>
            <IconX size={12} />
          </button>
        </div>

        <div className="seg">
          <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>
            {t('imp.paste')}
          </button>
          <button className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
            {t('imp.file')}
          </button>
        </div>

        {mode === 'text' ? (
          <textarea
            value={text}
            spellCheck={false}
            autoFocus
            placeholder='[{"name":"V2EX","url":"https://www.v2ex.com"}]'
            onChange={(e) => applyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void doImport();
              if (e.key === 'Escape') onClose();
            }}
          />
        ) : (
          <label
            className={`dropzone${dragHot ? ' hot' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragHot(true);
            }}
            onDragLeave={() => setDragHot(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragHot(false);
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
          >
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            {fileName ? (
              <>
                {t('imp.chosen', { f: fileName })}
                <br />
                {t('imp.rechoose')}
              </>
            ) : (
              <>
                {t('imp.dropA')}<b>.json</b>{t('imp.dropB')}
                <br />
                {t('imp.dropOr')}
              </>
            )}
          </label>
        )}

        <div className="modal__f">
          <span className="tip" style={error ? { color: 'var(--color-danger)' } : undefined}>
            {tip}
          </span>
          <button
            className="btn btn--sm"
            onClick={() => {
              setMode('text');
              applyText(SAMPLE_JSON);
            }}
          >
            {t('imp.sample')}
          </button>
          <button className="btn btn--sm" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--sm btn--dark"
            disabled={!parsed?.items.length}
            onClick={() => void doImport()}
          >
            {t('imp.import')}
          </button>
        </div>
      </motion.div>
    </>
  );
}

export function ImportModal({ open, prefillText, token, onClose }: Props) {
  // 自己控制挂载/卸载，保证淡出结束后一定把 DOM 摘掉（不依赖 AnimatePresence 的回调）
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <motion.div
      key={token}
      className="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onAnimationComplete={() => {
        if (!open) setMounted(false);
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <ImportModalInner key={token} prefillText={prefillText} onClose={onClose} />
    </motion.div>
  );
}
