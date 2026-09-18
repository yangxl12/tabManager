import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { IconDots } from './icons';

export interface RowMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onPick: () => void;
}

interface Props {
  items: RowMenuItem[];
  /** 触发按钮提示文案（同时作为 aria-label） */
  title?: string;
  /** 写到按钮上的 data-row-menu，方便无头探针定位 */
  marker?: string;
}

const MENU_W = 152;
const GAP = 6;
const EDGE = 8;

/**
 * 列表项右侧的「三个点」菜单。
 * 菜单用 portal 挂到 body：书签树在 .scroll（overflow:auto）里、面板本身也 overflow:hidden，
 * 就地渲染会被裁掉；portal + position:fixed 才能稳定浮在最上层。
 */
export function RowMenu({ items, title = '更多操作', marker }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const h = items.length * 31 + 12;
    const left = Math.max(EDGE, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - EDGE));
    const below = r.bottom + GAP;
    const top =
      below + h > window.innerHeight - EDGE ? Math.max(EDGE, r.top - GAP - h) : below;
    setPos({ left, top });
  }, [items.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Esc 关菜单要吃掉事件：否则会顺带触发全局的「清空选择」分支
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className={`row-menu__btn${open ? ' is-open' : ''}`}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        data-row-menu={marker}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <IconDots size={14} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={menuRef}
              className="row-menu"
              role="menu"
              style={{ left: pos.left, top: pos.top, width: MENU_W }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: [0.22, 0.8, 0.28, 1] }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {items.map((it) => (
                <button
                  key={it.key}
                  role="menuitem"
                  className={`row-menu__item${it.danger ? ' is-danger' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    it.onPick();
                  }}
                >
                  <span className="row-menu__ic">{it.icon}</span>
                  {it.label}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
