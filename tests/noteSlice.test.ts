/**
 * 便签 slice：脏存储不炸 + 合法值生效 + 宽度钳制。
 *
 * node 环境没有 localStorage，镜像读取全部走 catch 回落默认 ——
 * 正好覆盖「镜像不可用」这一支（与 storeInit.test.ts 的脏存储用例同源）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store';
import { clampNoteWidth, normalizeNoteWidth } from '@/lib/noteMirror';

interface Emitter {
  addListener: (fn: unknown) => void;
  removeListener: (fn: unknown) => void;
}

const emitter = (): Emitter => ({ addListener: () => {}, removeListener: () => {} });

/** 最小 chrome mock：只覆盖 hasChromeApi / initNotes 会碰到的接口 */
function installFakeChrome(stored: Record<string, unknown>): void {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in stored ? { [key]: stored[key] } : {}),
        set: async () => {},
      },
      onChanged: emitter(),
    },
    tabs: { query: async () => [], getCurrent: async () => undefined },
    bookmarks: { getTree: async () => [] },
  };
}

beforeEach(() => {
  useStore.setState({ noteOpen: false, noteWidth: 340, noteHtml: '' });
});

describe('initNotes 面对脏存储', () => {
  it('非布尔 / 非数字 / 非字符串一律回落镜像默认值', async () => {
    installFakeChrome({
      'tabnest.noteOpen': 'yes',
      'tabnest.noteWidth': 'wide',
      'tabnest.note': 42,
    });

    await expect(useStore.getState().initNotes()).resolves.toBeUndefined();

    expect(useStore.getState().noteOpen).toBe(false);
    expect(useStore.getState().noteWidth).toBe(340);
    expect(useStore.getState().noteHtml).toBe('');
  });

  it('合法值照常生效，超界宽度被钳制', async () => {
    installFakeChrome({
      'tabnest.noteOpen': true,
      'tabnest.noteWidth': 9999,
      'tabnest.note': '<b>hi</b>',
    });

    await useStore.getState().initNotes();

    expect(useStore.getState().noteOpen).toBe(true);
    expect(useStore.getState().noteWidth).toBe(720);
    expect(useStore.getState().noteHtml).toBe('<b>hi</b>');
  });
});

describe('便签 setter', () => {
  it('setNoteWidth 钳制到 [260, 720]', () => {
    const { setNoteWidth } = useStore.getState();
    setNoteWidth(100);
    expect(useStore.getState().noteWidth).toBe(260);
    setNoteWidth(2000);
    expect(useStore.getState().noteWidth).toBe(720);
    setNoteWidth(480.6);
    expect(useStore.getState().noteWidth).toBe(481);
  });

  it('setNoteOpen / setNoteHtml 更新状态', () => {
    useStore.getState().setNoteOpen(true);
    useStore.getState().setNoteHtml('<ul><li>x</li></ul>');

    expect(useStore.getState().noteOpen).toBe(true);
    expect(useStore.getState().noteHtml).toBe('<ul><li>x</li></ul>');
  });
});

describe('宽度工具函数', () => {
  it('clampNoteWidth / normalizeNoteWidth 对非法值回落', () => {
    expect(clampNoteWidth(10)).toBe(260);
    expect(clampNoteWidth(99999)).toBe(720);
    expect(clampNoteWidth(400)).toBe(400);
    expect(normalizeNoteWidth(400, 340)).toBe(400);
    expect(normalizeNoteWidth('400', 340)).toBe(340);
    expect(normalizeNoteWidth(null, 340)).toBe(340);
  });
});
