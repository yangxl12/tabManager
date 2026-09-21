import { KEYS, getLocal, setLocal } from '@/services/storage';
import { asBool, asNumber, asStr } from '@/lib/validate';
import {
  clampNoteWidth,
  readMirrorNoteHtml,
  readMirrorNoteOpen,
  readMirrorNoteWidth,
  writeNoteMirror,
} from '@/lib/noteMirror';
import type { SliceCreator } from './slice';

/**
 * 右侧便签面板：内容（富文本 HTML）+ 展开状态 + 宽度。
 * 真源 chrome.storage.local；localStorage 镜像喂首帧（与 theme / lang 同一套路）。
 */
export interface NotesSlice {
  /** 展开 / 收起。收起只是宽度归零的抽屉，组件不卸载，未保存的草稿不会丢 */
  noteOpen: boolean;
  /** 内容区宽度（px，不含左侧 13px 拖拽条） */
  noteWidth: number;
  /** 编辑器内容（HTML）。只在首帧 / 外部变更时回灌 DOM，本地输入靠防抖写回 */
  noteHtml: string;
  setNoteOpen: (v: boolean) => void;
  toggleNote: () => void;
  setNoteWidth: (w: number) => void;
  setNoteHtml: (html: string) => void;
  initNotes: () => Promise<void>;
}

export const createNotesSlice: SliceCreator<NotesSlice> = (set, get) => ({
  // 初值直接取镜像：上次展开 / 收起与宽度在第一帧就要生效，不闪过渡动画
  noteOpen: readMirrorNoteOpen(),
  noteWidth: readMirrorNoteWidth(),
  noteHtml: readMirrorNoteHtml(),

  setNoteOpen: (v) =>
    set((s) => {
      s.noteOpen = v;
      void setLocal(KEYS.noteOpen, v);
      writeNoteMirror({ open: v });
    }),

  toggleNote: () => get().setNoteOpen(!get().noteOpen),

  setNoteWidth: (w) => {
    const clamped = clampNoteWidth(w);
    if (clamped === get().noteWidth) return;
    set((s) => {
      s.noteWidth = clamped;
    });
    void setLocal(KEYS.noteWidth, clamped);
    writeNoteMirror({ width: clamped });
  },

  setNoteHtml: (html) => {
    if (html === get().noteHtml) return;
    set((s) => {
      s.noteHtml = html;
    });
    void setLocal(KEYS.note, html);
    writeNoteMirror({ html });
  },

  initNotes: async () => {
    // 存储里的值当外部输入：逐项过类型兜底（见 lib/validate.ts），非法回落镜像值
    const [storedOpen, storedWidth, storedHtml] = await Promise.all([
      getLocal<unknown>(KEYS.noteOpen, get().noteOpen),
      getLocal<unknown>(KEYS.noteWidth, get().noteWidth),
      getLocal<unknown>(KEYS.note, get().noteHtml),
    ]);
    set((s) => {
      s.noteOpen = asBool(storedOpen, s.noteOpen);
      s.noteWidth = clampNoteWidth(asNumber(storedWidth, s.noteWidth));
      s.noteHtml = asStr(storedHtml, s.noteHtml);
    });
  },
});
