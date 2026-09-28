import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/store';
import { sanitizeQuickSites } from '@/lib/quickSite';
import { DEFAULT_QUICK_GROUP_ID, quickGroupOf, sanitizeQuickGroups } from '@/store/quickSlice';

beforeEach(() => {
  useStore.setState({
    quickSites: [
      { id: 'old', name: '旧站点', url: 'https://example.com' },
      { id: 'other', name: '其他', url: 'https://other.com' },
    ],
    quickGroups: [],
    activeQuickGroupId: DEFAULT_QUICK_GROUP_ID,
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('快捷访问分类', () => {
  it('旧站点留在默认标签；新标签独立新增、重命名和删除', () => {
    const s = useStore.getState();
    expect(quickGroupOf(s.quickSites[0])).toBe(DEFAULT_QUICK_GROUP_ID);
    s.addQuickGroup('AI 类网站');
    const groupId = useStore.getState().activeQuickGroupId;
    expect(groupId).not.toBe(DEFAULT_QUICK_GROUP_ID);
    s.addQuick('ChatGPT', 'https://chatgpt.com');
    expect(useStore.getState().quickSites.at(-1)?.groupId).toBe(groupId);
    s.renameQuickGroup(groupId, 'AI 工具');
    expect(useStore.getState().quickGroups[0].name).toBe('AI 工具');
    s.removeQuickGroup(groupId);
    expect(useStore.getState().quickGroups).toEqual([]);
    expect(useStore.getState().activeQuickGroupId).toBe(DEFAULT_QUICK_GROUP_ID);
    expect(useStore.getState().quickSites.map((q) => q.id)).toEqual(['old', 'other']);
  });

  it('拖入按当前分类去重，分类内排序不影响默认标签', () => {
    const s = useStore.getState();
    s.addQuickGroup('AI');
    const groupId = useStore.getState().activeQuickGroupId;
    s.addQuickSites([{ name: '同网址', url: 'https://example.com' }], groupId);
    s.addQuickSites([{ name: '重复', url: 'https://example.com' }], groupId);
    s.addQuick('新站点', 'https://new.example.com', groupId);
    const before = useStore.getState().quickSites;
    const grouped = before.filter((q) => quickGroupOf(q) === groupId);
    expect(grouped).toHaveLength(2);
    s.reorderQuick(grouped.map((q) => q.id).reverse(), groupId);
    expect(useStore.getState().quickSites.filter((q) => quickGroupOf(q) === groupId).map((q) => q.id))
      .toEqual(grouped.map((q) => q.id).reverse());
    expect(useStore.getState().quickSites.filter((q) => quickGroupOf(q) === DEFAULT_QUICK_GROUP_ID).map((q) => q.id))
      .toEqual(['old', 'other']);
  });

  it('存储回读保留分类归属，并过滤无效分类', () => {
    expect(sanitizeQuickSites([{ id: 'q1', name: 'AI', url: 'https://example.com', groupId: 'g1' }]))
      .toEqual([{ id: 'q1', name: 'AI', url: 'https://example.com', groupId: 'g1' }]);
    expect(sanitizeQuickGroups([{ id: 'g1', name: ' AI ' }, { id: 'g1', name: '重复' }, { id: 'default', name: '错误' }]))
      .toEqual([{ id: 'g1', name: 'AI' }]);
  });

  it('保存后重新初始化能读回分类及站点，空站点列表不会复活默认项', async () => {
    const storage: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => key in storage ? { [key]: storage[key] } : {},
          set: async (items: Record<string, unknown>) => { Object.assign(storage, items); },
        },
      },
      tabs: {},
      bookmarks: {},
    });
    const s = useStore.getState();
    s.addQuickGroup('AI');
    s.addQuick('OpenAI', 'https://openai.com');
    const groupId = useStore.getState().activeQuickGroupId;
    useStore.setState({ quickGroups: [], quickSites: [], activeQuickGroupId: DEFAULT_QUICK_GROUP_ID });
    await useStore.getState().initQuick();
    expect(useStore.getState().quickGroups).toEqual([{ id: groupId, name: 'AI' }]);
    expect(useStore.getState().quickSites.at(-1)).toMatchObject({ name: 'OpenAI', groupId });

    useStore.setState({ quickSites: [] });
    storage['tabnest.quickSites'] = [];
    await useStore.getState().initQuick();
    expect(useStore.getState().quickSites).toEqual([]);
  });
});
