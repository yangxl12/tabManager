import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '@/store';
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
      toast('请选择 .json 文件', { tone: 'warn' });
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
      toast('没有解析到有效的书签', { tone: 'warn' });
      return;
    }
    const n = await importItems(parsed.items);
    if (!n) {
      toast('导入失败，请检查 JSON 内容', { tone: 'warn' });
      return;
    }
    onClose();
    toast(`已导入 ${n} 个书签到「${folderTitle || '当前文件夹'}」`);
  };

  const tip = parsed
    ? `${parsed.items.length} 条可导入${parsed.skipped ? `，${parsed.skipped} 条无效跳过` : ''}`
    : error || (fileName ? `已选择 ${fileName}` : '粘贴 JSON 或拖入 .json 文件');

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
            <h3>批量导入书签</h3>
            <p>
              支持 <span className="code">{'[{ name, url }]'}</span>、
              <span className="code">{'{ list: [...] }'}</span> 以及 Chrome 书签管理器导出的完整 JSON
              树。导入目标：<b>{folderTitle || '—'}</b>
            </p>
          </div>
          <button className="ico-btn" onClick={onClose} title="关闭 (Esc)">
            <IconX size={12} />
          </button>
        </div>

        <div className="seg">
          <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>
            粘贴 JSON
          </button>
          <button className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
            拖入文件
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
                已选择 <b>{fileName}</b>
                <br />
                重新拖入或点击可更换文件
              </>
            ) : (
              <>
                把 <b>.json</b> 文件拖到这里
                <br />
                或点击选择文件
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
            填入示例
          </button>
          <button className="btn btn--sm" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn--sm btn--dark"
            disabled={!parsed?.items.length}
            onClick={() => void doImport()}
          >
            导入
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
