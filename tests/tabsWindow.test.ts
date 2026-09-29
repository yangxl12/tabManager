import { afterEach, expect, it, vi } from 'vitest';
import { useStore } from '@/store';

afterEach(() => vi.unstubAllGlobals());

it('ignores activation events from another Chrome window', async () => {
  let activate: ((info: { tabId: number; windowId: number }) => void) | undefined;
  const emitter = (capture = false) => ({
    addListener: (fn: typeof activate) => { if (capture) activate = fn; },
    removeListener: () => {},
  });
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => {} } },
    bookmarks: {},
    tabs: {
      getCurrent: async () => ({ id: 99, windowId: 1 }),
      query: async () => [{ id: 10, windowId: 1, index: 0, title: 'A', url: 'https://a.example', active: true }],
      onCreated: emitter(), onRemoved: emitter(), onUpdated: emitter(), onMoved: emitter(),
      onReplaced: emitter(), onAttached: emitter(), onDetached: emitter(), onActivated: emitter(true),
    },
  });
  await useStore.getState().initTabs();
  expect(activate).toBeDefined();
  activate!({ tabId: 20, windowId: 2 });
  expect(useStore.getState().tabs[0].active).toBe(true);
  activate!({ tabId: 10, windowId: 1 });
  expect(useStore.getState().tabs[0].active).toBe(true);
});
