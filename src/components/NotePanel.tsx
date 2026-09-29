import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, useT } from '@/store';
import { NOTE_WIDTH_MAX, NOTE_WIDTH_MIN, clampNoteWidth } from '@/lib/noteMirror';
import { MIN_WORKSPACE_WIDTH } from '@/lib/aiPanel';
import { sanitizePastedHtml } from '@/lib/noteHtml';
import { IconChevron, IconListOl, IconListUl } from './icons';

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
  const noteSaveFailed = useStore((s) => s.noteSaveFailed);
  const setNoteOpen = useStore((s) => s.setNoteOpen);
  const setNoteWidth = useStore((s) => s.setNoteWidth);
  const setNoteHtml = useStore((s) => s.setNoteHtml);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const resizeFrame = useRef<number | null>(null);
  const pendingWidth = useRef<number | null>(null);
  const wasOpen = useRef(noteOpen);
  const dirty = useRef(false);
  const lastLocalHtml = useRef<string | null>(null);
  const conflictRef = useRef(false);

  const [on, setOn] = useState(false);
  const [tools, setTools] = useState<ToolStates>(NO_TOOLS);
  const [empty, setEmpty] = useState(true);
  const [chars, setChars] = useState(0);
  const [saved, setSaved] = useState(true);
  const [conflict, setConflict] = useState(false);

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
    if (noteHtml === lastLocalHtml.current) return;
    if (dirty.current) {
      conflictRef.current = true;
      setConflict(true);
      return;
    }
    el.innerHTML = noteHtml;
    syncMeta();
  }, [noteHtml, syncMeta]);

  const flushSave = useCallback((force = false) => {
    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
    }
    const el = editorRef.current;
    if (!el || !dirty.current || (conflictRef.current && !force)) return;
    const html = el.innerHTML;
    lastLocalHtml.current = html;
    void setNoteHtml(html).then((ok) => {
      if (ok && editorRef.current?.innerHTML === html && !conflictRef.current) {
        dirty.current = false;
        setSaved(true);
        setConflict(false);
      } else if (!ok) {
        setSaved(false);
      }
    });
  }, [setNoteHtml]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    setSaved(false);
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined;
      flushSave();
    }, SAVE_DEBOUNCE);
  }, [flushSave]);

  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;

  // 页面隐藏 / 卸载前把没落库的草稿冲掉，防抖定时器跑不完也不丢内容
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushRef.current();
    };
    const onUnload = () => flushRef.current();
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onHide);
      flushRef.current();
    };
  }, []);

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
      // 面板贴 .main 右缘：宽度 = 右缘 - 指针；给 AI 栏与中间工作区留空间
      const aiW = document.querySelector('.ai-pane')?.getBoundingClientRect().width ?? 0;
      const hi = Math.min(NOTE_WIDTH_MAX, Math.floor(rect.width - aiW - MIN_WORKSPACE_WIDTH - 13));
      pendingWidth.current = clampNoteWidth(Math.min(rect.right - e.clientX, Math.max(NOTE_WIDTH_MIN, hi)));
      if (resizeFrame.current === null) resizeFrame.current = window.requestAnimationFrame(() => {
        resizeFrame.current = null;
        if (pendingWidth.current !== null) setNoteWidth(pendingWidth.current, false);
      });
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (resizeFrame.current !== null) window.cancelAnimationFrame(resizeFrame.current);
      resizeFrame.current = null;
      setNoteWidth(pendingWidth.current ?? useStore.getState().noteWidth, true);
      pendingWidth.current = null;
      setOn(false);
      document.body.classList.remove('resizing');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('blur', up);
      if (resizeFrame.current !== null) window.cancelAnimationFrame(resizeFrame.current);
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
          <div className="sec-title note-title">{t('note.title')}</div>
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
            onBlur={() => flushSave()}
            onKeyDown={(e) => {
              // Esc 不外泄：在便签里按 Esc 只停下，别顺手关掉别的东西
              if (e.key === 'Escape') e.stopPropagation();
            }}
          />
        </div>

        <div className="note-foot">
          <span className={`note-dot${saved ? '' : ' busy'}`} />
          <span className="note-save">{noteSaveFailed ? t('note.saveFailed') : saved ? t('note.saved') : t('note.saving')}</span>
          {noteSaveFailed && <button onClick={() => flushSave(true)}>{t('note.retry')}</button>}
          <span className="note-count">{t('note.count', { n: chars })}</span>
        </div>
        {conflict && <div className="note-conflict" role="alert">
          <span>{t('note.conflict')}</span>
          <button onClick={() => {
            conflictRef.current = false;
            setConflict(false);
            flushSave(true);
          }}>{t('note.keepMine')}</button>
          <button onClick={() => {
            if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
            dirty.current = true;
            conflictRef.current = false;
            lastLocalHtml.current = null;
            if (editorRef.current) editorRef.current.innerHTML = noteHtml;
            syncMeta();
            setConflict(false);
            setSaved(false);
            flushSave(true);
          }}>{t('note.useRemote')}</button>
        </div>}
      </div>
    </aside>
  );
}
