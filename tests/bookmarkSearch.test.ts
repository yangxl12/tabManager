import { describe, expect, it } from 'vitest';
import { searchBookmarks } from '@/lib/bookmarkSearch';
import { normalizeTree } from '@/lib/bookmarkTree';
import type { BmState, RawBmNode } from '@/lib/types';

const RAW: RawBmNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '收藏夹栏',
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
      {
        id: '2',
        title: '其他书签',
        folderType: 'other',
        syncing: false,
        children: [{ id: '20', title: 'V2EX 论坛', url: 'https://v2ex.com' }],
      },
    ],
  },
];

function makeState(): BmState {
  return normalizeTree(JSON.parse(JSON.stringify(RAW)) as RawBmNode[]);
}

const ids = (s: BmState, q: string) => searchBookmarks(s, q).map((h) => h.node.id);

describe('searchBookmarks', () => {
  it('空查询不返回任何结果', () => {
    expect(searchBookmarks(makeState(), '')).toEqual([]);
    expect(searchBookmarks(makeState(), '   ')).toEqual([]);
  });

  it('按标题匹配且大小写不敏感', () => {
    expect(ids(makeState(), 'github')).toEqual(['10']);
    expect(ids(makeState(), 'GITHUB')).toEqual(['10']);
  });

  it('域名与 URL 也能命中', () => {
    expect(ids(makeState(), 'v2ex')).toEqual(['20']);
    expect(ids(makeState(), 'juejin.cn')).toEqual(['11']);
  });

  it('命中所在文件夹的书签排在文件夹本身之后', () => {
    expect(ids(makeState(), '工作')).toEqual(['12', '120']);
  });

  it('返回所在路径，且不含合成根', () => {
    const hit = searchBookmarks(makeState(), 'figma')[0];
    expect(hit.node.id).toBe('120');
    expect(hit.path.map((n) => n.id)).toEqual(['1', '12']);
  });

  it('账号与此设备两套存储的书签都能搜到', () => {
    const s = makeState();
    expect(searchBookmarks(s, 'github').map((h) => h.node.syncing)).toEqual([true]);
    expect(searchBookmarks(s, 'v2ex').map((h) => h.node.syncing)).toEqual([false]);
  });

  it('结果可限制条数', () => {
    expect(searchBookmarks(makeState(), 'o', 1)).toHaveLength(1);
  });
});
