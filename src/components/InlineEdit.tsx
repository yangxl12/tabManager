import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  /** 非编辑态展示的文案（默认与 value 相同，例如域名只显示 host） */
  displayValue?: string;
  placeholder: string;
  /** 非编辑态的外层 class */
  className: string;
  /** 编辑态 input 的附加 class */
  inputClassName?: string;
  editing: boolean;
  /** 空值时显示 CSS 占位（data-empty） */
  emptyStyle?: boolean;
  title?: string;
  onStart: () => void;
  onCommit: (value: string) => void;
  onCancel?: () => void;
}

/** 行内编辑：点击文字原位换 input，blur / Enter 提交，Esc 取消 */
export function InlineEdit({
  value,
  displayValue,
  placeholder,
  className,
  inputClassName,
  editing,
  emptyStyle,
  title,
  onStart,
  onCommit,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    setDraft(value);
    cancelledRef.current = false;
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
    // 只在进入编辑态时同步一次初值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editing) {
    return (
      <div
        className={className}
        title={title}
        {...(emptyStyle && !value ? { 'data-empty': '1' } : {})}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onStart();
        }}
      >
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
        onCommit(draft);
      }}
    />
  );
}
