/**
 * 便签面板的 localStorage 镜像 —— 纯逻辑，不 import chrome / React。
 *
 * 与 lib/theme.ts、lib/i18n.ts 同一套路：真源是 chrome.storage.local（异步），
 * React 首帧还没回来时靠镜像同步可读。否则「上次展开的面板」会先按收起画、
 * 再弹出一次动画；「上次调好的宽度」也会先按默认画再跳一下 —— 都是肉眼可见的闪动。
 */
export const NOTE_OPEN_MIRROR_KEY = 'tabnest.noteOpen';
export const NOTE_WIDTH_MIRROR_KEY = 'tabnest.noteWidth';
export const NOTE_HTML_MIRROR_KEY = 'tabnest.note';

/** 内容区默认 / 最小 / 最大宽度（px，不含左侧 13px 拖拽条） */
export const NOTE_WIDTH_DEFAULT = 340;
export const NOTE_WIDTH_MIN = 260;
export const NOTE_WIDTH_MAX = 720;

export function clampNoteWidth(w: number): number {
  return Math.round(Math.max(NOTE_WIDTH_MIN, Math.min(NOTE_WIDTH_MAX, w)));
}

/** chrome.storage 里的宽度过类型兜底 + 钳制（非法回落 fallback） */
export function normalizeNoteWidth(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clampNoteWidth(v) : fallback;
}

export function readMirrorNoteOpen(): boolean {
  try {
    return localStorage.getItem(NOTE_OPEN_MIRROR_KEY) === '1';
  } catch {
    return false;
  }
}

export function readMirrorNoteWidth(): number {
  try {
    const raw = localStorage.getItem(NOTE_WIDTH_MIRROR_KEY);
    // Number(null) 是 0，会被钳制成最小宽度 —— 先判空再转
    if (raw === null) return NOTE_WIDTH_DEFAULT;
    return normalizeNoteWidth(Number(raw), NOTE_WIDTH_DEFAULT);
  } catch {
    return NOTE_WIDTH_DEFAULT;
  }
}

export function readMirrorNoteHtml(): string {
  try {
    const v = localStorage.getItem(NOTE_HTML_MIRROR_KEY);
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

/** 镜像写入按需传字段；无 localStorage / 配额满一律忽略（真源在 chrome.storage） */
export function writeNoteMirror(patch: { open?: boolean; width?: number; html?: string }): void {
  try {
    if (patch.open !== undefined) {
      localStorage.setItem(NOTE_OPEN_MIRROR_KEY, patch.open ? '1' : '0');
    }
    if (patch.width !== undefined) localStorage.setItem(NOTE_WIDTH_MIRROR_KEY, String(patch.width));
    if (patch.html !== undefined) localStorage.setItem(NOTE_HTML_MIRROR_KEY, patch.html);
  } catch {
    /* 忽略 */
  }
}
