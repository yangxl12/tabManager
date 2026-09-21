/**
 * 快捷访问拖拽排序（reorderQuick）。
 * 落点算出的是一条「重排后的完整 id 序」，这里守住三件事：
 * 顺序照传、缺项补齐绝不丢条目、脏 id 不产生幽灵磁贴。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store';

const seed = () => [
  { id: 'q1', name: 'A', url: 'https://a.com' },
  { id: 'q2', name: 'B', url: 'https://b.com' },
  { id: 'q3', name: 'C', url: 'https://c.com' },
];

const ids = () => useStore.getState().quickSites.map((q) => q.id);

beforeEach(() => {
  useStore.setState({ quickSites: seed() });
});

describe('reorderQuick', () => {
  it('按传入顺序重排', () => {
    useStore.getState().reorderQuick(['q3', 'q1', 'q2']);
    expect(ids()).toEqual(['q3', 'q1', 'q2']);
  });

  it('未覆盖的条目按原顺序补在末尾，不丢', () => {
    useStore.getState().reorderQuick(['q3']);
    expect(ids()).toEqual(['q3', 'q1', 'q2']);
  });

  it('忽略不存在的 id，不产生幽灵条目', () => {
    useStore.getState().reorderQuick(['q2', 'qX', 'q1', 'q3']);
    expect(ids()).toEqual(['q2', 'q1', 'q3']);
    expect(useStore.getState().quickSites).toHaveLength(3);
  });

  it('重复 id 只生效一次', () => {
    useStore.getState().reorderQuick(['q2', 'q2', 'q1', 'q3']);
    expect(ids()).toEqual(['q2', 'q1', 'q3']);
  });

  it('条目本身（名称 / 网址）不受影响', () => {
    useStore.getState().reorderQuick(['q2', 'q1', 'q3']);
    expect(useStore.getState().quickSites[0]).toEqual({ id: 'q2', name: 'B', url: 'https://b.com' });
  });
});
