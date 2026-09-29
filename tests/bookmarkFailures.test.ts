import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/store';
import { normalizeTree } from '@/lib/bookmarkTree';
import type { RawBmNode } from '@/lib/types';

const emitter = () => ({ addListener: () => {}, removeListener: () => {} });

function installBookmarks(failRemove: string[] = [], failCreateTitle?: string) {
  const nodes = [
    { id: 'a', title: 'A', url: 'https://a.example' },
    { id: 'b', title: 'B', url: 'https://b.example' },
  ];
  const raw = (): RawBmNode[] => [{
    id: '0', title: '', children: [{ id: '1', title: 'Bookmarks', children: nodes.map((n) => ({ ...n })) }],
  }];
  const remove = vi.fn(async (id: string) => {
    if (failRemove.includes(id)) throw new Error('remove failed');
    nodes.splice(nodes.findIndex((n) => n.id === id), 1);
  });
  const create = vi.fn(async (input: { title: string; url: string; parentId: string; index?: number }) => {
    if (input.title === failCreateTitle) throw new Error('create failed');
    const made = { id: `restored-${input.title}`, title: input.title, url: input.url };
    nodes.splice(input.index ?? nodes.length, 0, made);
    return { ...made, parentId: input.parentId, index: input.index };
  });
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: emitter() },
    tabs: {},
    bookmarks: { getTree: async () => raw(), remove, create, move: async () => {},
      onCreated: emitter(), onRemoved: emitter(), onChanged: emitter(), onMoved: emitter(),
      onChildrenReordered: emitter(), onImportBegan: emitter(), onImportEnded: emitter() },
  });
  useStore.setState({ bm: normalizeTree(raw()), currentFolder: '1', undoStack: [], closingBms: [] });
  return { remove, create, nodes };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', { querySelector: () => null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bookmark partial failures', () => {
  it('keeps an undo record only for successfully removed bookmarks', async () => {
    installBookmarks(['b']);
    const pending = useStore.getState().deleteNodes(['a', 'b']);
    await vi.runAllTimersAsync();
    await pending;
    expect(useStore.getState().undoStack[0].items.map((item) => item.node.id)).toEqual(['a']);
    expect(useStore.getState().bm.nodes.a).toBeUndefined();
    expect(useStore.getState().bm.nodes.b).toBeDefined();
    await useStore.getState().undo();
    expect(useStore.getState().undoStack).toHaveLength(0);
  });

  it('retains only unrestored items after undo fails and can retry', async () => {
    const chromeApi = installBookmarks([], 'B');
    const pending = useStore.getState().deleteNodes(['a', 'b']);
    await vi.runAllTimersAsync();
    await pending;
    await useStore.getState().undo();
    expect(useStore.getState().undoStack[0].items.map((item) => item.node.id)).toEqual(['b']);
    expect(chromeApi.create).toHaveBeenCalledTimes(2);
    chromeApi.create.mockImplementation(async (input) => ({ id: 'restored-b', title: input.title, url: input.url, parentId: input.parentId, index: input.index }));
    await useStore.getState().undo();
    expect(useStore.getState().undoStack).toHaveLength(0);
    expect(chromeApi.create).toHaveBeenCalledTimes(3);
  });

  it('reads Chrome state after a failed move instead of restoring an old snapshot', async () => {
    const api = installBookmarks();
    chrome.bookmarks.move = vi.fn().mockRejectedValue(new Error('move failed'));
    api.nodes.push({ id: 'external', title: 'External', url: 'https://external.example' });
    await useStore.getState().moveNodesInto(['a'], '1', -1);
    expect(useStore.getState().bm.nodes.external).toBeDefined();
    expect(useStore.getState().bm.nodes.a).toBeDefined();
  });
});
