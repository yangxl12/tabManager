/**
 * 存储里存了脏数据（非数组 / 非数字 / 非布尔）时，初始化也必须能跑完。
 *
 * 回归用例：chrome://newtab/ 报的 `i.filter is not a function` ——
 * `tabnest.collapsedFolders` 被存成了非数组，`initBookmarks` 在 `.filter` 上直接抛，
 * 书签监听器一个都没注册、bmReady 永远 false，前端只剩一条没人看的 promise rejection。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store';
import type { RawBmNode } from '@/lib/types';

const RAW: RawBmNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '书签栏',
        folderType: 'bookmarks-bar',
        syncing: true,
        children: [
          { id: '10', title: 'GitHub', url: 'https://github.com' },
          { id: '12', title: '工作', children: [{ id: '120', title: 'Figma', url: 'https://figma.com' }] },
        ],
      },
    ],
  },
];

interface Emitter {
  addListener: (fn: unknown) => void;
  removeListener: (fn: unknown) => void;
}

const emitter = (): Emitter => ({ addListener: () => {}, removeListener: () => {} });

/** 最小 chrome mock：只覆盖 hasChromeApi / initBookmarks / initUi 会碰到的接口 */
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
    bookmarks: {
      getTree: async () => JSON.parse(JSON.stringify(RAW)) as RawBmNode[],
      onCreated: emitter(),
      onRemoved: emitter(),
      onChanged: emitter(),
      onMoved: emitter(),
      onChildrenReordered: emitter(),
      onImportBegan: emitter(),
      onImportEnded: emitter(),
    },
  };
}

beforeEach(() => {
  useStore.setState({ collapsed: [], bmReady: false, currentFolder: '' });
});

describe('initBookmarks 面对脏存储', () => {
  for (const [label, bad] of [
    ['对象', { '1': true }],
    ['数字', 5],
    ['字符串', '1,12'],
    ['null', null],
  ] as const) {
    it(`collapsed 存成${label}时不抛错，回落为空表并继续完成初始化`, async () => {
      installFakeChrome({ 'tabnest.collapsedFolders': bad });

      await expect(useStore.getState().initBookmarks()).resolves.toBeUndefined();

      expect(useStore.getState().collapsed).toEqual([]);
      expect(useStore.getState().bmReady).toBe(true);
      expect(useStore.getState().currentFolder).toBe('1');
    });
  }

  it('是数组时照常生效，并滤掉已不存在的 id', async () => {
    installFakeChrome({ 'tabnest.collapsedFolders': ['12', '999', 7] });

    await useStore.getState().initBookmarks();

    expect(useStore.getState().collapsed).toEqual(['12']);
  });

  it('currentFolder 存成非字符串时回落到第一个顶层文件夹', async () => {
    installFakeChrome({ 'tabnest.currentFolder': { id: '12' } });

    await useStore.getState().initBookmarks();

    expect(useStore.getState().currentFolder).toBe('1');
  });
});

describe('initUi 面对脏存储', () => {
  it('panelWidth / helpOpen 类型不对时回落默认值', async () => {
    installFakeChrome({ 'tabnest.panelWidth': '55', 'tabnest.helpOpen': 'yes' });

    await useStore.getState().initUi();

    // '55' 不被强转：不是数字就回默认宽度 46
    expect(useStore.getState().panelWidth).toBe(46);
    expect(useStore.getState().helpOpen).toBe(false);
  });

  it('合法值照常生效', async () => {
    installFakeChrome({ 'tabnest.panelWidth': 62, 'tabnest.helpOpen': true });

    await useStore.getState().initUi();

    expect(useStore.getState().panelWidth).toBe(62);
    expect(useStore.getState().helpOpen).toBe(true);
  });
});
