import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, useT } from '@/store';
import { searchBookmarks } from '@/lib/bookmarkSearch';
import { hostOf } from '@/lib/url';
import { IconFolder, IconSearch, IconX } from './icons';
import { Tile } from './Tile';

/** 把命中的关键词标出来，一眼看清为什么匹配 */
function Highlight({ text, q }: { text: string; q: string }) {
  const key = q.trim().toLowerCase();
  const at = key ? text.toLowerCase().indexOf(key) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + key.length)}</mark>
      {text.slice(at + key.length)}
    </>
  );
}

function SearchInner({ onClose }: { onClose: () => void }) {
  const t = useT();
  const bm = useStore((s) => s.bm);
  const openBookmark = useStore((s) => s.openBookmark);
  const gotoFolder = useStore((s) => s.gotoFolder);

  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchBookmarks(bm, q), [bm, q]);
  const total = useMemo(
    () => Object.values(bm.nodes).filter((n) => !n.isFolder && !n.isDraft).length,
    [bm],
  );

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    listRef.current
      ?.querySelector('.bmsearch__item.is-active')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (i: number) => {
    const hit = hits[i];
    if (!hit) return;
    if (hit.node.isFolder) gotoFolder(hit.node.id);
    else void openBookmark(hit.node.id);
    onClose();
  };

  return (
    <>
      {/* 遮罩本身就是空白区：点它等于点弹窗外，直接关掉 */}
      <div className="modal__mask" onMouseDown={onClose} />
      <motion.div
        className="modal__box bmsearch"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
      >
        {/* 弹窗自身的关闭按钮：浮在右上角，不跟输入框里的「清空」混在一起 */}
        <button className="bmsearch__close" title={t('common.close')} onClick={onClose}>
          <IconX size={13} />
        </button>

        <div className="bmsearch__field">
          <IconSearch size={15} />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('search.ph')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, hits.length - 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                pick(active);
              }
            }}
          />
          {q ? (
            <button
              className="ico-btn bmsearch__clear"
              title={t('search.clear')}
              onClick={() => {
                setQ('');
                setActive(0);
                inputRef.current?.focus();
              }}
            >
              <IconX size={12} />
            </button>
          ) : null}
        </div>

        <div className="bmsearch__list scroll" ref={listRef}>
          {!q.trim() ? (
            <div className="bmsearch__hint">
              {t('search.hintIdle', { n: total })}
            </div>
          ) : hits.length ? (
            hits.map((hit, i) => (
              <div
                key={hit.node.id}
                className={`bmsearch__item${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
              >
                {hit.node.isFolder ? (
                  <span className="bmsearch__folderic">
                    <IconFolder size={14} />
                  </span>
                ) : (
                  <Tile url={hit.node.url} seed={hit.node.title || hit.node.url} />
                )}
                <span className="bmsearch__main">
                  <span className="bmsearch__name">
                    <Highlight text={hit.node.title || t('search.untitled')} q={q} />
                  </span>
                  <span className="bmsearch__meta">
                    {hit.node.isFolder ? t('search.folder') : hostOf(hit.node.url)}
                    {hit.path.length ? ` · ${hit.path.map((p) => p.title).join(' / ')}` : ''}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className="bmsearch__hint">
              {t('search.noHitA')}<b>{q.trim()}</b>{t('search.noHitB')}
            </div>
          )}
        </div>

        <div className="bmsearch__foot">
          <span>{t('search.keys')}</span>
          <span>{q.trim() ? t('search.results', { n: hits.length }) : t('search.count', { n: total })}</span>
        </div>
      </motion.div>
    </>
  );
}

export function BookmarkSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // AnimatePresence 负责退出动画 + 卸载；每次打开都是全新挂载，搜索状态天然干净
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bmsearch"
          className="modal modal--top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <SearchInner onClose={onClose} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
