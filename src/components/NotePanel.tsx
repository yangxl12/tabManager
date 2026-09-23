import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, useT } from '@/store';
import { NOTE_WIDTH_MAX, NOTE_WIDTH_MIN, clampNoteWidth } from '@/lib/noteMirror';
import { sanitizePastedHtml } from '@/lib/noteHtml';
import { IconChevron, IconListOl, IconListUl, IconNote } from './icons';

const SAVE_DEBOUNCE = 500;

interface ToolStates {
  h1: boolean;
  h2: boolean;
  bold: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
}

const NO_TOOLS: ToolStates = { h1: false, h2: false, bold: false, strike: false, ul: false, ol: false };

/** queryCommandValue('formatBlock') 可能带尖括号（旧实现返回 '<h1>'），剥掉再比 */
function currentBlock(): string {
  try {
    return String(document.queryCommandValue('formatBlock') || '')
      .replace(/[<>]/g, '')
      .toLowerCase();
  } catch {
    return '';
  }
}

/**
 * 右侧便签抽屉：开合只动外层宽度（内容层固定宽，动画期间不回流），
 * 收起时不卸载 —— 编辑器 DOM 与未落库的草稿原地保留。
 */
export function NotePanel() {
  const t = useT();
  const noteOpen = useStore((s) => s.noteOpen);
  const noteWidth = useStore((s) => s.noteWidth);
  const noteHtml = useStore((s) => s.noteHtml);
  const setNoteOpen = useStore((s) => s.setNoteOpen);
  const setNoteWidth = useStore((s) => s.setNoteWidth);
  const setNoteHtml = useStore((s) => s.setNoteHtml);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const wasOpen = useRef(noteOpen);

  const [on, setOn] = useState(false);
  const [tools, setTools] = useState<ToolStates>(NO_TOOLS);
  const [empty, setEmpty] = useState(true);
  const [chars, setChars] = useState(0);
  const [saved, setSaved] = useState(true);

  /* ---------- 编辑器内容 <-> store ---------- */

  const syncMeta = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    // 必须用 textContent 而不是 innerText：innerText 是「渲染后」的文本，
    // 面板收起时（.note-pane 是 visibility: hidden）恒为 ''，会在「收起状态下回灌内容」时
    // 把有内容的便签误判成空 —— 用户再展开就看到占位提示压在正文上。
    // （\s 与 trim 都覆盖粘贴进来的 &nbsp;，与旧实现口径一致）
    const text = el.textContent ?? '';
    setEmpty(text.trim() === '');
    setChars(text.replace(/\s/g, '').length);
  }, []);

  // 外部变更（首帧镜像 / 多标签页同步）回灌 DOM；本地正编辑时不抢内容
  useEffect(() => {
    const el = editorRef.current;
    if (!el || el.innerHTML === noteHtml) return;
    if (document.activeElement === el) return;
    el.innerHTML = noteHtml;
    syncMeta();
  }, [noteHtml, syncMeta]);

  const flushSave = useCallback(() => {
    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
    }
    const el = editorRef.current;
    if (!el) return;
    setSaved(true);
    setNoteHtml(el.innerHTML);
  }, [setNoteHtml]);

  const scheduleSave = useCallback(() => {
    setSaved(false);
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined;
      setNoteHtml(editorRef.current?.innerHTML ?? '');
      setSaved(true);
    }, SAVE_DEBOUNCE);
  }, [setNoteHtml]);

  // 页面隐藏 / 卸载前把没落库的草稿冲掉，防抖定时器跑不完也不丢内容
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    window.addEventListener('beforeunload', flushSave);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', flushSave);
      document.removeEventListener('visibilitychange', onHide);
      flushSave();
    };
  }, [flushSave]);

  /* ---------- 富文本工具条（contentEditable + execCommand） ---------- */

  const refreshTools = useCallback(() => {
    try {
      setTools({
        h1: currentBlock() === 'h1',
        h2: currentBlock() === 'h2',
        bold: document.queryCommandState('bold'),
        strike: document.queryCommandState('strikeThrough'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      /* 无选区等场景：保持上一次状态 */
    }
  }, []);

  useEffect(() => {
    const on = () => refreshTools();
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, [refreshTools]);

  const exec = useCallback(
    (cmd: string, value?: string) => {
      document.execCommand(cmd, false, value);
      editorRef.current?.focus();
      refreshTools();
      syncMeta();
      scheduleSave();
    },
    [refreshTools, scheduleSave, syncMeta],
  );

  /** 点标题按钮 = 在 p / h1 / h2 间切换（已是该级标题则退回正文） */
  const heading = useCallback(
    (level: 'h1' | 'h2') => {
      exec('formatBlock', currentBlock() === level ? 'p' : level);
    },
    [exec],
  );

  // 工具条一律 mousedown 执行 + preventDefault：不让按钮抢走编辑器的焦点与选区
  const toolDown = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  /* ---------- 编辑器事件 ---------- */

  const onInput = useCallback(() => {
    syncMeta();
    refreshTools();
    scheduleSave();
  }, [syncMeta, refreshTools, scheduleSave]);

  /**
   * 粘贴只收结构、不收样式（清洗规则见 lib/noteHtml）：
   * 从深色网页 / 代码编辑器复制来的 HTML 常带内联 background-color，
   * 原样落库后在明亮模式下就是一块黑底，而且 `color` 写死还会在换主题后撞色。
   */
  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      const clean = html ? sanitizePastedHtml(html) : '';
      if (clean) document.execCommand('insertHTML', false, clean);
      else if (text) document.execCommand('insertText', false, text);
      syncMeta();
      scheduleSave();
    },
    [scheduleSave, syncMeta],
  );

  /* ---------- 展开 / 收起 ---------- */

  useEffect(() => {
    if (noteOpen && !wasOpen.current) {
      // 手动展开时光标直接进编辑器；记忆态的首帧展开不抢焦点
      editorRef.current?.focus();
    }
    wasOpen.current = noteOpen;
  }, [noteOpen]);

  /* ---------- 宽度拖拽（左侧拖拽条，与主分隔条同款） ---------- */

  const onSplitDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setOn(true);
    document.body.classList.add('resizing');
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const main = document.querySelector('.main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      // 面板贴 .main 右缘：宽度 = 右缘 - 指针；上限还要给标签面板与书签面板留地
      const tabsW = document.querySelector('.panel--tabs')?.getBoundingClientRect().width ?? 0;
      const hi = Math.min(NOTE_WIDTH_MAX, Math.floor(rect.width - tabsW - 286));
      setNoteWidth(clampNoteWidth(Math.min(rect.right - e.clientX, Math.max(NOTE_WIDTH_MIN, hi))));
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setOn(false);
      document.body.classList.remove('resizing');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [setNoteWidth]);

  return (
    <aside
      className={`note-pane${noteOpen ? ' is-open' : ''}`}
      style={{ '--note-w': `${noteWidth}px` } as React.CSSProperties}
      aria-label={t('note.title')}
    >
      <div
        className={`splitter${on ? ' on' : ''}`}
        onMouseDown={onSplitDown}
        title={t('split.title')}
      />

      <div className="panel note-inner">
        <div className="note-head">
          <div className="sec-title note-title">
            <IconNote size={13} />
            {t('note.title')}
          </div>
          <button
            className="ico-btn note-collapse"
            title={t('note.collapse')}
            onClick={() => setNoteOpen(false)}
          >
            <IconChevron size={10} />
          </button>
        </div>

        <div className="note-tools" role="toolbar" aria-label={t('note.title')}>
          <button
            className={`note-tool${tools.h1 ? ' on' : ''}`}
            title={t('note.h1')}
            onMouseDown={toolDown(() => heading('h1'))}
          >
            <span className="note-tool__t">H1</span>
          </button>
          <button
            className={`note-tool${tools.h2 ? ' on' : ''}`}
            title={t('note.h2')}
            onMouseDown={toolDown(() => heading('h2'))}
          >
            <span className="note-tool__t">H2</span>
          </button>
          <span className="note-tools__sep" />
          <button
            className={`note-tool${tools.bold ? ' on' : ''}`}
            title={t('note.bold')}
            onMouseDown={toolDown(() => exec('bold'))}
          >
            <span className="note-tool__t note-tool__t--b">B</span>
          </button>
          <button
            className={`note-tool${tools.strike ? ' on' : ''}`}
            title={t('note.strike')}
            onMouseDown={toolDown(() => exec('strikeThrough'))}
          >
            <span className="note-tool__t note-tool__t--s">S</span>
          </button>
          <span className="note-tools__sep" />
          <button
            className={`note-tool${tools.ul ? ' on' : ''}`}
            title={t('note.ul')}
            onMouseDown={toolDown(() => exec('insertUnorderedList'))}
          >
            <IconListUl size={14} />
          </button>
          <button
            className={`note-tool${tools.ol ? ' on' : ''}`}
            title={t('note.ol')}
            onMouseDown={toolDown(() => exec('insertOrderedList'))}
          >
            <IconListOl size={14} />
          </button>
        </div>

        <div className="note-body scroll">
          <div
            ref={editorRef}
            className="note-editor"
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label={t('note.title')}
            data-ph={t('note.ph')}
            data-empty={empty ? 'true' : 'false'}
            spellCheck={false}
            onInput={onInput}
            onPaste={onPaste}
            onKeyUp={refreshTools}
            onBlur={flushSave}
            onKeyDown={(e) => {
              // Esc 不外泄：在便签里按 Esc 只停下，别顺手关掉别的东西
              if (e.key === 'Escape') e.stopPropagation();
            }}
          />
        </div>

        <div className="note-foot">
          <span className={`note-dot${saved ? '' : ' busy'}`} />
          <span className="note-save">{saved ? t('note.saved') : t('note.saving')}</span>
          <span className="note-count">{t('note.count', { n: chars })}</span>
        </div>
      </div>
    </aside>
  );
}
