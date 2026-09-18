import { uid } from '@/lib/id';
import { KEYS, getLocal, setLocal } from '@/services/storage';
import type { ToastItem, ToastTone } from '@/lib/types';
import type { SliceCreator } from './slice';

export interface ToastInput {
  msg: string;
  tone?: ToastTone;
  action?: string;
  onAction?: () => void;
  duration?: number;
}

export interface DragState {
  active: boolean;
  kind: 'tab' | 'bookmark' | 'file' | null;
  /** 被拖拽项 id（字符串化，多选时为整组） */
  ids: string[];
  /**
   * 排序指示：命中卡片 + 落在左/右半区。
   * 必须带 kind —— 标签 id 是数字、书签 id 是数字字符串，只看 id 会串台。
   */
  indicator: { kind: 'tab' | 'bookmark'; targetId: string; side: 'before' | 'after' } | null;
  /** 高亮的文件夹（树行 / 子文件夹 chip） */
  dropFolderId: string | null;
  /** 当前指针落在哪个面板的空区上（标签面板 / 书签面板），null 表示没有 */
  dropPane: 'tab' | 'bookmark' | null;
}

export interface UiSlice {
  helpOpen: boolean;
  /** 全局书签搜索弹窗 */
  searchOpen: boolean;
  panelWidth: number;
  toasts: ToastItem[];
  drag: DragState;
  setSearchOpen: (v: boolean) => void;
  toggleHelp: () => void;
  setHelpOpen: (v: boolean) => void;
  setPanelWidth: (w: number) => void;
  setDrag: (patch: Partial<DragState>) => void;
  resetDrag: () => void;
  toast: (input: ToastInput | string, options?: Partial<ToastInput>) => string;
  dismissToast: (id: string) => void;
  initUi: () => Promise<void>;
}

const EMPTY_DRAG: DragState = {
  active: false,
  kind: null,
  ids: [],
  indicator: null,
  dropFolderId: null,
  dropPane: null,
};

const DEFAULT_PANEL_WIDTH = 46;

export const createUiSlice: SliceCreator<UiSlice> = (set, get) => ({
  helpOpen: false,
  searchOpen: false,
  panelWidth: DEFAULT_PANEL_WIDTH,
  toasts: [],
  drag: EMPTY_DRAG,

  setSearchOpen: (v) => set((s) => void (s.searchOpen = v)),

  setDrag: (patch) => set((s) => void Object.assign(s.drag, patch)),

  resetDrag: () => set((s) => void (s.drag = { ...EMPTY_DRAG })),

  toggleHelp: () =>
    set((s) => {
      s.helpOpen = !s.helpOpen;
      void setLocal(KEYS.helpOpen, s.helpOpen);
    }),

  setHelpOpen: (v) =>
    set((s) => {
      s.helpOpen = v;
      void setLocal(KEYS.helpOpen, v);
    }),

  setPanelWidth: (w) =>
    set((s) => {
      s.panelWidth = Math.max(30, Math.min(70, w));
      void setLocal(KEYS.panelWidth, s.panelWidth);
    }),

  toast: (input, options) => {
    const opts: ToastInput =
      typeof input === 'string' ? { msg: input, ...options } : input;
    const item: ToastItem = {
      id: uid('toast'),
      msg: opts.msg,
      tone: opts.tone ?? 'ok',
      action: opts.action,
      onAction: opts.onAction,
      duration: opts.duration ?? 4600,
    };
    set((s) => {
      s.toasts.push(item);
      while (s.toasts.length > 4) s.toasts.shift();
    });
    return item.id;
  },

  dismissToast: (id) =>
    set((s) => {
      s.toasts = s.toasts.filter((t) => t.id !== id);
    }),

  initUi: async () => {
    const [panelWidth, helpOpen] = await Promise.all([
      getLocal<number>(KEYS.panelWidth, DEFAULT_PANEL_WIDTH),
      getLocal<boolean>(KEYS.helpOpen, false),
    ]);
    set((s) => {
      s.panelWidth = Math.max(30, Math.min(70, panelWidth));
      s.helpOpen = helpOpen;
    });
    void get();
  },
});
