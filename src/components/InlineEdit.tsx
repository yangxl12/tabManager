import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  /** 非编辑态展示的文案（默认与 value 相同，例如网址只显示 host） */
  displayValue?: string;
  placeholder: string;
  /** 非编辑态的外层 class */
  className: string;
  /** 编辑态 input 的附加 class */
  inputClassName?: string;
  editing: boolean;
  /** 该字段当前是否持有光标（进入编辑态 / 链式焦点转移时抢焦点并全选） */
  active?: boolean;
  /** 空值 blur 时恢复原状，不提交 */
  revertOnEmpty?: boolean;
  /** 空值时显示 CSS 占位（data-empty） */
  emptyStyle?: boolean;
  /** 非编辑态的原生 tooltip（长标题被截断时能看到全文） */
  title?: string;
  onCommit: (value: string) => void;
  /** Esc 取消 */
  onCancel?: () => void;
  /** 空值 blur 触发的「恢复原状」回调，用于把焦点交给下一个字段 */
  onRevert?: () => void;
}

/**
 * 行内编辑：编辑态原位换 input，blur / Enter 提交，Esc 取消。
 * 非编辑态是**纯展示**元素——不拦截点击，点击冒泡给卡片（= 打开书签）；
 * 进编辑态只能由外部把 editing 置 true（书签卡片走右下角编辑图标）。
 */
export function InlineEdit({
  value,
  displayValue,
  placeholder,
  className,
  inputClassName,
  editing,
  active = true,
  revertOnEmpty,
  emptyStyle,
  title,
  onCommit,
  onCancel,
  onRevert,
}: Props) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing || !active) return;
    setDraft(value);
    cancelledRef.current = false;
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
    // 只在进入编辑态 / 焦点落到本字段时同步初值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, active]);

  const commit = () => {
    // 空值 → 恢复原状：不提交，input 里残留的空串也同步回外部值
    if (revertOnEmpty && !draft.trim()) {
      setDraft(value);
      onRevert?.();
      return;
    }
    onCommit(draft);
  };

  if (!editing) {
    return (
      <div className={className} title={title} {...(emptyStyle && !value ? { 'data-empty': '1' } : {})}>
        {displayValue ?? value}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className={`mini-input${inputClassName ? ` ${inputClassName}` : ''}`}
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelledRef.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          setDraft(value);
          onCancel?.();
          return;
        }
        commit();
      }}
    />
  );
}
