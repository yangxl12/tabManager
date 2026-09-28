import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '@/store';
import { IconCheck, IconDots } from './icons';

export interface RowMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
  /** 单选菜单（主题）：当前项右侧打勾 */
  checked?: boolean;
  /** 右侧的浅色说明文字（未打勾时显示的次要信息） */
  hint?: string;
  /** 该项之前插一条分组小标题（分组内第一项写就行） */
  section?: string;
  /** 选中后保留菜单（例如同时展示帮助面板） */
  keepOpen?: boolean;
  onPick: () => void;
}

interface Props {
  items: RowMenuItem[];
  /** 触发按钮提示文案（同时作为 aria-label） */
  title?: string;
  /** 写到按钮上的 data-row-menu，方便无头探针定位 */
  marker?: string;
  /** 触发按钮里的图标，默认「三个点」 */
  trigger?: ReactNode;
  /** 追加到触发按钮上的类名 */
  btnClass?: string;
  /** 弹层宽度，默认 152（条目文案长时传大一点，见 ToolsMenu） */
  width?: number;
}

const MENU_W = 152;
const GAP = 6;
const EDGE = 8;
/** 单个条目 / 分组小标题的高度，用于估算弹层总高（决定往上还是往下弹） */
const ITEM_H = 31;
const SEC_H = 23;

/**
 * 列表项右侧的「三个点」菜单。
 * 菜单用 portal 挂到 body：书签树在 .scroll（overflow:auto）里、面板本身也 overflow:hidden，
 * 就地渲染会被裁掉；portal + position:fixed 才能稳定浮在最上层。
 * 触发按钮的图标 / 类名 / 宽度可替换，面板右上角的工具收纳入口（ToolsMenu）复用同一套弹层逻辑。
 */
export function RowMenu({ items, title, marker, trigger, btnClass, width = MENU_W }: Props) {
  const t = useT();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const h = items.reduce((n, it) => n + (it.section ? SEC_H : 0) + ITEM_H, 0) + 12;
    const left = Math.max(EDGE, Math.min(r.right - width, window.innerWidth - width - EDGE));
    const below = r.bottom + GAP;
    const top =
      below + h > window.innerHeight - EDGE ? Math.max(EDGE, r.top - GAP - h) : below;
    setPos({ left, top });
  }, [items, width]);

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

  const resolvedTitle = title ?? t('common.more');

  return (
    <>
      <button
        ref={btnRef}
        className={`row-menu__btn${open ? ' is-open' : ''}${btnClass ? ` ${btnClass}` : ''}`}
        title={resolvedTitle}
        aria-label={resolvedTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        data-row-menu={marker}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {trigger ?? <IconDots size={14} />}
      </button>

      {createPortal(
        <AnimatePresence>
          {open ? (
            // portal 只改 DOM 位置，React 合成事件仍会沿组件树冒到触发那一行的 onClick
            // （点「编辑 / 删除」会误触发打开网址）→ mousedown、click 都要在菜单这层截断。
            <motion.div
              ref={menuRef}
              className="row-menu"
              data-row-menu={marker}
              role="menu"
              style={{ left: pos.left, top: pos.top, width }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: [0.22, 0.8, 0.28, 1] }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((it) => (
                <Fragment key={it.key}>
                  {it.section ? <div className="row-menu__sec">{it.section}</div> : null}
                  <button
                    role="menuitem"
                    data-row-item={it.key}
                    className={`row-menu__item${it.danger ? ' is-danger' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!it.keepOpen) setOpen(false);
                      it.onPick();
                    }}
                  >
                    <span className="row-menu__ic">{it.icon}</span>
                    {it.label}
                    {it.checked ? (
                      <span className="row-menu__ck">
                        <IconCheck size={13} />
                      </span>
                    ) : it.hint ? (
                      <span className="row-menu__hint">{it.hint}</span>
                    ) : null}
                  </button>
                </Fragment>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
