/**
 * 书签文件夹增删改的 store 级回归用例。
 *
 * 现场：左侧菜单树点「新建子文件夹」会冒出两个同名文件夹，之后既改不了名也删不干净。
 * 根因是同一次 chrome.bookmarks.create 被写了两遍 ——
 * 「Promise 回调」和「chrome.bookmarks.onCreated 回灌」各自往父节点的 children 里 push 了一次。
 *
 * 所以这里的 mock 必须**真的会 emit 事件**，而且能控制事件与 Promise 的先后顺序
 * （tests/storeInit.test.ts 里的 emitter 是空壳，永远测不出这类竞态）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store';
import { visibleRows, allFolderIds } from '@/lib/bookmarkTree';
import type { RawBmNode } from '@/lib/types';

interface Node {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: Node[];
  folderType?: string;
  unmodifiable?: string;
  syncing?: boolean;
}

type Listener = (...args: unknown[]) => void;

function emitter() {
  const listeners = new Set<Listener>();
  return {
    addListener: (fn: Listener) => void listeners.add(fn),
    removeListener: (fn: Listener) => void listeners.delete(fn),
    fire: (...args: unknown[]) => {
      for (const fn of [...listeners]) fn(...args);
    },
  };
}

const BASE: Node[] = [
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
          { id: '11', title: '掘金', url: 'https://juejin.cn' },
          {
            id: '12',
            title: '工作',
            children: [{ id: '120', title: 'Figma', url: 'https://figma.com' }],
          },
        ],
      },
    ],
  },
];

let tree: Node[] = [];
let nextId = 900;
const createLog: string[] = [];
const updateLog: Array<{ id: string; title?: string }> = [];
const removeLog: string[] = [];
const ev = {
  onCreated: emitter(),
  onRemoved: emitter(),
  onChanged: emitter(),
  onMoved: emitter(),
  onChildrenReordered: emitter(),
  onImportBegan: emitter(),
  onImportEnded: emitter(),
};
/** 事件到达时机：micro = Promise resolve 之前（真 Chrome 的行为）；late = 之后 */
let createdEventTiming: 'micro' | 'late' | 'never' = 'micro';

function findNode(id: string, node?: Node): Node | undefined {
  const list = node ? (node.children ?? []) : tree;
  for (const n of list) {
    if (n.id === id) return n;
    const hit = findNode(id, n);
    if (hit) return hit;
  }
  return undefined;
}

function parentListOf(parentId: string): Node[] {
  const p = findNode(parentId);
  if (!p) throw new Error('no parent ' + parentId);
  p.children = p.children ?? [];
  return p.children;
}

function installChrome(): void {
  tree = JSON.parse(JSON.stringify(BASE)) as Node[];
  nextId = 900;
  createLog.length = 0;
  updateLog.length = 0;
  removeLog.length = 0;
  createdEventTiming = 'micro';

  const api = {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
      },
      onChanged: emitter(),
    },
    tabs: { query: async () => [], getCurrent: async () => undefined },
    bookmarks: {
      ...ev,
      getTree: async () => JSON.parse(JSON.stringify(tree)) as RawBmNode[],
      async create(info: { parentId?: string; title?: string; url?: string; index?: number }) {
        const parentId = info.parentId ?? '0';
        const list = parentListOf(parentId);
        const id = String(nextId++);
        const node: Node = { id, parentId, title: info.title ?? '' };
        if (info.url) node.url = info.url;
        else node.children = [];
        const at = typeof info.index === 'number' ? Math.min(info.index, list.length) : list.length;
        list.splice(at, 0, node);
        createLog.push(id);
        const payload = { ...node, index: at };
        if (createdEventTiming === 'micro') queueMicrotask(() => ev.onCreated.fire(id, payload));
        else if (createdEventTiming === 'late') setTimeout(() => ev.onCreated.fire(id, payload), 0);
        return payload;
      },
      async update(id: string, changes: { title?: string; url?: string }) {
        const n = findNode(id);
        if (!n) throw new Error('no bookmark ' + id);
        Object.assign(n, changes);
        updateLog.push({ id, title: changes.title });
        queueMicrotask(() => ev.onChanged.fire(id, { title: changes.title, url: changes.url }));
        return n;
      },
      async removeTree(id: string) {
        const p = findNode(id)?.parentId;
        const list = p ? parentListOf(p) : [];
        const at = list.findIndex((n) => n.id === id);
        if (at > -1) list.splice(at, 1);
        removeLog.push(id);
        queueMicrotask(() => ev.onRemoved.fire(id, { parentId: p, index: at }));
      },
      async move() {
        return undefined;
      },
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = api;
}

/** 走完整初始化链路：syncBookmarks + 注册监听器 */
async function boot(): Promise<void> {
  installChrome();
  useStore.setState({ collapsed: [], currentFolder: '', bmReady: false, toasts: [] });
  await useStore.getState().initBookmarks();
}

/** 渲染层看到的行：重复引用会在这里变成两行 */
function rowsOfNewId(id: string): number {
  const st = useStore.getState();
  const open = new Set(allFolderIds(st.bm).filter((x) => !st.collapsed.includes(x)));
  return visibleRows(st.bm, open).filter((r) => r.node.id === id).length;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
}

beforeEach(() => {
  createdEventTiming = 'micro';
});

describe('createFolder：创建结果 + onCreated 回灌不能双写', () => {
  it('事件先于 Promise 到达时，只出现一个子文件夹', async () => {
    await boot();
    createdEventTiming = 'micro';

    useStore.getState().createFolder('1');
    await settle();

    const st = useStore.getState();
    const kid = st.bm.nodes['1'].children.filter((x) => x === '900');
    expect(createLog).toEqual(['900']);
    expect(kid).toEqual(['900']);
    expect(rowsOfNewId('900')).toBe(1);
  });

  it('事件晚于 Promise 到达时，也只出现一个子文件夹', async () => {
    await boot();
    createdEventTiming = 'late';

    useStore.getState().createFolder('1');
    await settle();

    expect(useStore.getState().bm.nodes['1'].children.filter((x) => x === '900')).toEqual(['900']);
    expect(rowsOfNewId('900')).toBe(1);
  });

  it('完全收不到事件时，本地乐观更新仍然可见', async () => {
    await boot();
    createdEventTiming = 'never';

    useStore.getState().createFolder('1');
    await settle();

    expect(useStore.getState().bm.nodes['900']).toBeDefined();
    expect(rowsOfNewId('900')).toBe(1);
  });

  it('父级被手动收起时新建会自动展开，命名输入框才看得见', async () => {
    await boot();
    useStore.setState({ collapsed: ['1'] });

    useStore.getState().createFolder('1');
    await settle();

    expect(useStore.getState().collapsed).toEqual([]);
    expect(rowsOfNewId('900')).toBe(1);
  });

  it('新建后请求一次自动命名编辑', async () => {
    await boot();
    useStore.getState().createFolder('1');
    await settle();
    expect(useStore.getState().autoEdit?.id).toBe('900');
  });
});

describe('renameNode / deleteFolderTree', () => {
  it('重命名写入本地并调用一次 chrome.bookmarks.update', async () => {
    await boot();
    useStore.getState().renameNode('12', '工作2');
    await settle();

    expect(useStore.getState().bm.nodes['12'].title).toBe('工作2');
    expect(updateLog).toEqual([{ id: '12', title: '工作2' }]);
  });

  it('名字没变时不调 API（区分「用户没改」与「输入被撤销」）', async () => {
    await boot();
    useStore.getState().renameNode('12', '工作');
    await settle();

    expect(updateLog).toEqual([]);
  });

  it('确认删除后子树与父节点引用一起消失，不留幽灵 id', async () => {
    await boot();
    // 手工造出线上现场：父节点里同一个 id 挂了两次
    useStore.setState((s) => void s.bm.nodes['1'].children.push('12'));

    useStore.getState().deleteFolderTree('12');
    const confirm = useStore.getState().toasts[useStore.getState().toasts.length - 1];
    confirm.onAction?.();
    await settle();

    const st = useStore.getState();
    expect(removeLog).toEqual(['12']);
    expect(st.bm.nodes['12']).toBeUndefined();
    expect(st.bm.nodes['120']).toBeUndefined();
    expect(st.bm.nodes['1'].children).toEqual(['10', '11']);
  });

  it('删除当前所在的文件夹后，currentFolder 回落到顶层', async () => {
    await boot();
    useStore.getState().gotoFolder('12');

    useStore.getState().deleteFolderTree('12');
    useStore.getState().toasts[useStore.getState().toasts.length - 1].onAction?.();
    await settle();

    expect(useStore.getState().currentFolder).toBe('1');
  });

  it('外部删除（只有 onRemoved 事件）也会收干净指向该节点的 UI 状态', async () => {
    await boot();
    useStore.getState().gotoFolder('12');

    ev.onRemoved.fire('12', { parentId: '1', index: 2 });
    await settle();

    const st = useStore.getState();
    expect(st.bm.nodes['12']).toBeUndefined();
    expect(st.currentFolder).toBe('1');
  });
});

describe('其它创建路径同样不能双写', () => {
  it('导入书签：一次创建只落一张卡', async () => {
    await boot();
    useStore.getState().gotoFolder('1');
    const n = await useStore.getState().importItems([
      { name: 'V2EX', url: 'https://v2ex.com' },
    ]);
    await settle();

    expect(n).toBe(1);
    expect(useStore.getState().bm.nodes['1'].children.filter((x) => x === '900')).toEqual(['900']);
  });

  it('标签转书签：一次创建只落一张卡', async () => {
    await boot();
    useStore.setState({ tabs: [{ id: 7, windowId: 1, index: 0, title: '某页', url: 'https://x.com', active: false, pinned: false }] });

    await useStore.getState().addTabsAsBookmarks([7], '12');
    await settle();

    expect(useStore.getState().bm.nodes['12'].children.filter((x) => x === '900')).toEqual(['900']);
  });
});
