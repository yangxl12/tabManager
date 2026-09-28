import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/store';
import { sanitizeQuickSites } from '@/lib/quickSite';
import { CURATED_QUICK_GROUPS } from '@/lib/curatedQuickSites';
import { DEFAULT_QUICK_GROUP_ID, ensureCuratedQuickGroups, quickGroupOf, rehomeQuickSites, sanitizeQuickGroups } from '@/store/quickSlice';

/** 最小 chrome.storage mock：写入同步落在 storage 上，可当「重启后读回」用 */
function stubChromeStorage(): Record<string, unknown> {
  const storage: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => (key in storage ? { [key]: storage[key] } : {}),
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        },
      },
    },
    tabs: {},
    bookmarks: {},
  });
  return storage;
}

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
  it('只内置四个精选分类，每类提供至少二十个不同网址', () => {
    expect(CURATED_QUICK_GROUPS.map((group) => group.name))
      .toEqual(['AI 助手', '精选资讯', '学习成长', '设计创作']);
    for (const group of CURATED_QUICK_GROUPS) {
      expect(group.sites.length).toBeGreaterThanOrEqual(20);
      expect(new Set(group.sites.map((site) => site.url)).size).toBe(group.sites.length);
    }
  });

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

  it('磁贴拖到分组标签后移入末尾并持久化，重复投放不复制', async () => {
    const storage = stubChromeStorage();
    storage['tabnest.quickGroups'] = [{ id: 'g1', name: '工作' }, { id: 'g2', name: '隐藏', hidden: true }];
    useStore.setState({
      quickGroups: [{ id: 'g1', name: '工作' }, { id: 'g2', name: '隐藏', hidden: true }],
      quickSites: [
        { id: 'old', name: '旧站点', url: 'https://example.com' },
        { id: 'existing', name: '已有', url: 'https://existing.com', groupId: 'g1' },
      ],
    });

    const s = useStore.getState();
    s.moveQuickToGroup('old', 'g1');
    expect(useStore.getState().quickSites.filter((q) => quickGroupOf(q) === 'g1').map((q) => q.id))
      .toEqual(['existing', 'old']);
    expect((storage['tabnest.quickSites'] as Array<{ id: string; groupId: string }>).at(-1))
      .toMatchObject({ id: 'old', groupId: 'g1' });

    s.moveQuickToGroup('old', 'g1');
    s.moveQuickToGroup('old', 'g2');
    expect(useStore.getState().quickSites.map((q) => q.id)).toEqual(['existing', 'old']);
    expect(useStore.getState().quickSites.find((q) => q.id === 'old')?.groupId).toBe('g1');

    s.moveQuickToGroup('old', DEFAULT_QUICK_GROUP_ID);
    await useStore.getState().initQuick();
    expect(quickGroupOf(useStore.getState().quickSites.find((q) => q.id === 'old')!))
      .toBe(DEFAULT_QUICK_GROUP_ID);
  });

  it('存储回读保留分类归属，并过滤无效分类', () => {
    expect(sanitizeQuickSites([{ id: 'q1', name: 'AI', url: 'https://example.com', groupId: 'g1' }]))
      .toEqual([{ id: 'q1', name: 'AI', url: 'https://example.com', groupId: 'g1' }]);
    expect(sanitizeQuickGroups([{ id: 'g1', name: ' AI ' }, { id: 'g1', name: '重复' }, { id: 'default', name: '错误' }]))
      .toEqual([{ id: 'g1', name: 'AI' }]);
    expect(sanitizeQuickGroups([{ id: 'featured-ai', name: '篡改', hidden: true }]))
      .toEqual([{ id: 'featured-ai', name: 'AI 助手', hidden: true }]);
  });

  it('精选分类不能删除或改名，可以隐藏、恢复和排序；默认分类保持固定', () => {
    useStore.setState({ quickGroups: ensureCuratedQuickGroups([{ id: 'mine', name: '我的分类' }]) });
    const s = useStore.getState();
    s.removeQuickGroup('featured-ai');
    s.renameQuickGroup('featured-ai', '改名');
    expect(useStore.getState().quickGroups.find((g) => g.id === 'featured-ai')?.name).toBe('AI 助手');

    s.setActiveQuickGroup('featured-ai');
    s.setQuickGroupHidden('featured-ai', true);
    expect(useStore.getState().activeQuickGroupId).toBe(DEFAULT_QUICK_GROUP_ID);
    s.setActiveQuickGroup('featured-ai');
    expect(useStore.getState().activeQuickGroupId).toBe(DEFAULT_QUICK_GROUP_ID);
    s.setQuickGroupHidden('featured-ai', false);
    s.setActiveQuickGroup('featured-ai');
    expect(useStore.getState().activeQuickGroupId).toBe('featured-ai');

    const order = useStore.getState().quickGroups.map((g) => g.id);
    s.reorderQuickGroups(['featured-news', ...order]);
    expect(useStore.getState().quickGroups[0].id).toBe('featured-news');
    expect(useStore.getState().quickGroups).toHaveLength(order.length);
  });

  it('保存后重新初始化能读回分类及站点，空站点列表不会复活默认项', async () => {
    const storage = stubChromeStorage();
    const s = useStore.getState();
    s.addQuickGroup('AI');
    s.addQuick('OpenAI', 'https://openai.com');
    const groupId = useStore.getState().activeQuickGroupId;
    useStore.setState({ quickGroups: [], quickSites: [], activeQuickGroupId: DEFAULT_QUICK_GROUP_ID });
    await useStore.getState().initQuick();
    expect(useStore.getState().quickGroups.map((g) => g.id))
      .toEqual([groupId, ...CURATED_QUICK_GROUPS.map((g) => g.id)]);
    expect(useStore.getState().quickSites.find((q) => q.name === 'OpenAI')).toMatchObject({ groupId });
    expect(useStore.getState().quickSites.filter((q) => q.groupId === 'featured-ai')).toHaveLength(20);
    expect(storage['tabnest.curatedQuickSeeded.v2']).toBe(true);

    s.setQuickGroupHidden('featured-ai', true);
    s.reorderQuickGroups(['featured-news', groupId, ...CURATED_QUICK_GROUPS.map((g) => g.id)]);
    await useStore.getState().initQuick();
    expect(useStore.getState().quickGroups[0].id).toBe('featured-news');
    expect(useStore.getState().quickGroups.find((g) => g.id === 'featured-ai')?.hidden).toBe(true);

    const firstCuratedSite = useStore.getState().quickSites.find((q) => q.groupId === 'featured-ai')!;
    s.removeQuick(firstCuratedSite.id);
    await useStore.getState().initQuick();
    expect(useStore.getState().quickSites.some((q) => q.id === firstCuratedSite.id)).toBe(false);

    useStore.setState({ quickSites: [] });
    storage['tabnest.quickSites'] = [];
    await useStore.getState().initQuick();
    expect(useStore.getState().quickSites).toEqual([]);
  });

  it('点过的分类写进存储，重开（重新初始化）后还停在那一栏', async () => {
    const storage = stubChromeStorage();
    useStore.getState().addQuickGroup('AI');
    const groupId = useStore.getState().activeQuickGroupId;
    expect(storage['tabnest.activeQuickGroup']).toBe(groupId);

    useStore.getState().setActiveQuickGroup(DEFAULT_QUICK_GROUP_ID);
    expect(storage['tabnest.activeQuickGroup']).toBe(DEFAULT_QUICK_GROUP_ID);
    useStore.getState().setActiveQuickGroup(groupId);
    expect(useStore.getState().activeQuickGroupId).toBe(groupId);

    // 模拟刷新 / 重开新标签页：内存态清空，只从存储恢复
    useStore.setState({ quickGroups: [], quickSites: [], activeQuickGroupId: DEFAULT_QUICK_GROUP_ID, quickLoaded: false });
    await useStore.getState().initQuick();
    expect(useStore.getState().activeQuickGroupId).toBe(groupId);
  });

  it('存储里的分类 id 已不存在（脏值）时回落默认分类并订正存储', async () => {
    const storage = stubChromeStorage();
    storage['tabnest.activeQuickGroup'] = 'qg-ghost';

    await useStore.getState().initQuick();

    expect(useStore.getState().activeQuickGroupId).toBe(DEFAULT_QUICK_GROUP_ID);
    expect(storage['tabnest.activeQuickGroup']).toBe(DEFAULT_QUICK_GROUP_ID);
  });

  it('删掉正在看的那一栏时，落盘的记忆也回落默认分类', async () => {
    const storage = stubChromeStorage();
    useStore.getState().addQuickGroup('AI');
    const groupId = useStore.getState().activeQuickGroupId;

    useStore.getState().removeQuickGroup(groupId);

    expect(useStore.getState().activeQuickGroupId).toBe(DEFAULT_QUICK_GROUP_ID);
    expect(storage['tabnest.activeQuickGroup']).toBe(DEFAULT_QUICK_GROUP_ID);
  });

  it('隐藏当前分类后，重新初始化回到默认分类', async () => {
    const storage = stubChromeStorage();
    useStore.getState().addQuickGroup('暂时隐藏');
    const groupId = useStore.getState().activeQuickGroupId;
    useStore.getState().setQuickGroupHidden(groupId, true);
    expect(storage['tabnest.activeQuickGroup']).toBe(DEFAULT_QUICK_GROUP_ID);
    await useStore.getState().initQuick();
    expect(useStore.getState().activeQuickGroupId).toBe(DEFAULT_QUICK_GROUP_ID);
  });

  it('旧版三类精选标签退出后，原站点回到默认标签，保留自建分类和删除选择', async () => {
    const storage: Record<string, unknown> = {
      'tabnest.curatedQuickSeeded.v1': true,
      'tabnest.quickGroups': [
        { id: 'featured-ai', name: 'AI 助手', hidden: true },
        { id: 'featured-design', name: '设计创作' },
        { id: 'featured-dev', name: '开发工具' },
        { id: 'featured-work', name: '效率协作' },
        { id: 'featured-learn', name: '学习成长' },
        { id: 'featured-assets', name: '创意素材' },
        { id: 'featured-news', name: '精选资讯' },
        { id: 'mine', name: '我的分类' },
      ],
      'tabnest.quickSites': [
        { id: 'ai-old', name: 'ChatGPT', url: 'https://chatgpt.com/', groupId: 'featured-ai' },
        { id: 'dev-old', name: 'GitHub', url: 'https://github.com/', groupId: 'featured-dev' },
        { id: 'dev-added', name: '我的开发站', url: 'https://example.dev/', groupId: 'featured-dev' },
        { id: 'mine-old', name: '我的站', url: 'https://mine.example/', groupId: 'mine' },
      ],
    };
    vi.stubGlobal('chrome', {
      storage: { local: {
        get: async (key: string) => key in storage ? { [key]: storage[key] } : {},
        set: async (items: Record<string, unknown>) => { Object.assign(storage, items); },
      } },
      tabs: {}, bookmarks: {},
    });

    await useStore.getState().initQuick();
    const state = useStore.getState();
    expect(state.quickGroups.map((group) => group.id))
      .toEqual(['featured-ai', 'featured-design', 'featured-learn', 'featured-news', 'mine']);
    expect(state.quickGroups[0].hidden).toBe(true);
    expect(state.quickSites.filter((site) => ['dev-old', 'dev-added'].includes(site.id))
      .map((site) => quickGroupOf(site))).toEqual(['default', 'default']);
    expect(state.quickSites.find((site) => site.id === 'mine-old')?.groupId).toBe('mine');
    expect(state.quickSites.filter((site) => site.groupId === 'featured-ai' && site.name === 'Claude'))
      .toEqual([]);
    expect(state.quickSites.filter((site) => site.groupId === 'featured-ai')).toHaveLength(15);
    expect(storage['tabnest.curatedQuickSeeded.v2']).toBe(true);
    expect(rehomeQuickSites([{ id: 'x', name: 'X', url: 'https://x.com', groupId: 'featured-work' }], state.quickGroups)[0].groupId)
      .toBe(DEFAULT_QUICK_GROUP_ID);
  });
});
