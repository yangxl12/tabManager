import { describe, expect, it } from 'vitest';
import {
  allFolderIds,
  attach,
  childrenOf,
  countOf,
  descendantIds,
  detach,
  dropInsertIndex,
  isDescendant,
  moveInTree,
  movePlan,
  normalizeTree,
  pathOf,
  removeSubtree,
  reorderIds,
  rootGroups,
  storageOf,
  totalBookmarks,
  treeRootIds,
  visibleRows,
} from '@/lib/bookmarkTree';
import type { BmState, RawBmNode } from '@/lib/types';

const RAW: RawBmNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '书签栏',
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
      {
        id: '2',
        title: '其他书签',
        children: [{ id: '20', title: 'V2EX', url: 'https://v2ex.com' }],
      },
    ],
  },
];

function makeState(): BmState {
  return normalizeTree(JSON.parse(JSON.stringify(RAW)) as RawBmNode[]);
}

describe('normalizeTree', () => {
  it('展开为扁平节点表并保留顺序', () => {
    const s = makeState();
    expect(Object.keys(s.nodes)).toHaveLength(8);
    expect(s.nodes['1'].children).toEqual(['10', '11', '12']);
    expect(s.nodes['10'].isFolder).toBe(false);
    expect(s.nodes['12'].isFolder).toBe(true);
    expect(s.nodes['0'].parentId).toBeNull();
  });

  it('treeRootIds 跳过合成根', () => {
    expect(treeRootIds(makeState())).toEqual(['1', '2']);
  });
});

describe('查询', () => {
  it('countOf 统计子树书签数（不含文件夹与草稿）', () => {
    const s = makeState();
    expect(countOf(s, '12')).toBe(1);
    expect(countOf(s, '1')).toBe(3);
    expect(countOf(s, '0')).toBe(4);
    expect(totalBookmarks(s)).toBe(4);
  });

  it('pathOf 返回从顶层到自身的链路', () => {
    expect(pathOf(makeState(), '120').map((n) => n.id)).toEqual(['1', '12', '120']);
  });

  it('descendantIds / isDescendant 正确处理嵌套', () => {
    const s = makeState();
    expect(descendantIds(s, '12')).toEqual(['120']);
    expect(isDescendant(s, '12', '120')).toBe(true);
    expect(isDescendant(s, '120', '12')).toBe(false);
    expect(isDescendant(s, '1', '20')).toBe(false);
  });

  it('草稿不参与计数', () => {
    const s = makeState();
    s.nodes['draft_1'] = {
      id: 'draft_1',
      parentId: '1',
      title: '临时',
      url: '',
      isFolder: false,
      isDraft: true,
      children: [],
    };
    s.nodes['1'].children.push('draft_1');
    expect(countOf(s, '1')).toBe(3);
    expect(totalBookmarks(s)).toBe(4);
  });
});

describe('visibleRows', () => {
  it('只展开 expanded 中的文件夹，且只渲染文件夹行', () => {
    const s = makeState();
    const closed = visibleRows(s, new Set());
    expect(closed.map((r) => r.node.id)).toEqual(['1', '2']);

    const open = visibleRows(s, new Set(['1']));
    expect(open.map((r) => r.node.id)).toEqual(['1', '12', '2']);
    // 树只渲染文件夹：12 的子项全是书签，因此没有可展开的箭头
    expect(open.find((r) => r.node.id === '12')?.hasChildren).toBe(false);

    // 展开全部也只多出文件夹行，书签（120）留在右侧网格
    const all = visibleRows(s, new Set(['1', '12']));
    expect(all.map((r) => r.node.id)).toEqual(['1', '12', '2']);
  });
});

describe('allFolderIds', () => {
  it('返回全部文件夹，跳过 Chrome 的无标题合成根', () => {
    expect(allFolderIds(makeState()).sort()).toEqual(['1', '12', '2']);
  });

  it('默认全部展开：只排除被手动收起的文件夹', () => {
    const s = makeState();
    const openAll = new Set(allFolderIds(s));
    expect(visibleRows(s, openAll).map((r) => r.node.id)).toEqual(['1', '12', '2']);

    const folded = new Set(['1']);
    const rest = new Set(allFolderIds(s).filter((id) => !folded.has(id)));
    expect(visibleRows(s, rest).map((r) => r.node.id)).toEqual(['1', '2']);
  });
});

describe('可变操作', () => {
  it('detach / attach 维护双向关系', () => {
    const s = makeState();
    const at = detach(s, '11');
    expect(at).toEqual({ parentId: '1', index: 1 });
    expect(s.nodes['1'].children).toEqual(['10', '12']);
    expect(s.nodes['11'].parentId).toBe('1');

    expect(attach(s, '2', 0, '11')).toBe(true);
    expect(s.nodes['2'].children).toEqual(['11', '20']);
    expect(s.nodes['11'].parentId).toBe('2');
  });

  it('moveInTree 拒绝移入自身或后代', () => {
    const s = makeState();
    expect(moveInTree(s, '12', '12', 0)).toBe(false);
    expect(moveInTree(s, '12', '120', 0)).toBe(false);
    expect(moveInTree(s, '120', '2', 0)).toBe(true);
    expect(s.nodes['120'].parentId).toBe('2');
  });

  it('removeSubtree 清空整棵子树', () => {
    const s = makeState();
    removeSubtree(s, '12');
    expect(s.nodes['12']).toBeUndefined();
    expect(s.nodes['120']).toBeUndefined();
    expect(s.nodes['1'].children).toEqual(['10', '11']);
  });
});

describe('排序算法', () => {
  it('dropInsertIndex 在剔除被拖项后的列表里定位', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(dropInsertIndex(order, 'c', 'before', ['a'])).toBe(1);
    expect(dropInsertIndex(order, 'c', 'after', ['a'])).toBe(2);
    // 目标本身就在被拖集合里（落在自己身上）时退化为追加，实际由拖拽层拦截
    expect(dropInsertIndex(order, 'b', 'after', ['b'])).toBe(3);
    expect(dropInsertIndex(order, null, 'before', [])).toBe(4);
  });

  it('reorderIds 保持多选项相对顺序', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], ['b', 'd'], 0)).toEqual(['b', 'd', 'a', 'c']);
    expect(reorderIds(['a', 'b', 'c', 'd'], ['a', 'c'], 2)).toEqual(['b', 'd', 'a', 'c']);
    expect(reorderIds(['a', 'b', 'c'], ['c'], 99)).toEqual(['a', 'b', 'c']);
  });

  it('movePlan 生成的顺序执行后可得到目标顺序', () => {
    const current = ['a', 'b', 'c', 'd', 'e'];
    const desired = ['c', 'a', 'e', 'b', 'd'];
    const plan = movePlan(current, desired);
    const sim = [...current];
    for (const step of plan) {
      const at = sim.indexOf(step.id);
      sim.splice(at, 1);
      sim.splice(Math.min(step.index, sim.length), 0, step.id);
    }
    expect(sim).toEqual(desired);
  });

  it('movePlan 对已就绪的顺序不产生多余操作', () => {
    expect(movePlan(['a', 'b'], ['a', 'b'])).toEqual([]);
  });
});

describe('childrenOf', () => {
  it('返回有序子节点对象', () => {
    expect(childrenOf(makeState(), '1').map((n) => n.id)).toEqual(['10', '11', '12']);
  });
});

describe('账号书签 / 此设备书签 双存储', () => {
  const DUAL: RawBmNode[] = [
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: '书签栏',
          folderType: 'bookmarks-bar',
          syncing: true,
          children: [{ id: '10', title: 'A', url: 'https://a.com' }],
        },
        { id: '2', title: '其他书签', folderType: 'other', syncing: true, children: [] },
        {
          id: '3',
          title: '书签栏',
          folderType: 'bookmarks-bar',
          syncing: false,
          children: [{ id: '30', title: 'B', url: 'https://b.com' }],
        },
        { id: '4', title: '其他书签', folderType: 'other', syncing: false, children: [] },
      ],
    },
  ];

  const dual = () => normalizeTree(JSON.parse(JSON.stringify(DUAL)) as RawBmNode[]);

  it('两套存储同时存在时分成两组并带标题', () => {
    expect(rootGroups(dual()).map((g) => [g.key, g.label, g.roots])).toEqual([
      ['account', '账号书签', ['1', '2']],
      ['device', '此设备书签', ['3', '4']],
    ]);
  });

  it('只有一套存储时不显示分组标题', () => {
    const s = normalizeTree([
      {
        id: '0',
        title: '',
        children: [
          { id: '1', title: '书签栏', folderType: 'bookmarks-bar', syncing: true, children: [] },
        ],
      },
    ]);
    expect(rootGroups(s)).toEqual([{ key: 'account', label: null, roots: ['1'] }]);
  });

  it('旧版 Chrome（无 syncing 字段）归为单组且无标题', () => {
    expect(rootGroups(makeState())).toEqual([{ key: 'all', label: null, roots: ['1', '2'] }]);
  });

  it('syncing 向下继承到子节点，合成根保持 undefined', () => {
    const s = dual();
    expect(storageOf(s, '10')).toBe(true);
    expect(storageOf(s, '30')).toBe(false);
    expect(storageOf(s, '0')).toBeUndefined();
  });

  it('visibleRows 每行带分组信息，账号组排在前面', () => {
    const rows = visibleRows(dual(), new Set());
    expect(rows.map((r) => r.node.id)).toEqual(['1', '2', '3', '4']);
    expect(rows.map((r) => r.groupKey)).toEqual(['account', 'account', 'device', 'device']);
    expect(rows[0].groupLabel).toBe('账号书签');
    expect(rows[3].groupLabel).toBe('此设备书签');
  });

  it('树顶层不会把合成根当成文件夹展示', () => {
    expect(treeRootIds(dual())).toEqual(['1', '2', '3', '4']);
  });
});
