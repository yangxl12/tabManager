import { describe, expect, it } from 'vitest';
import {
  QUICK_NAME_MAX,
  collectQuickSites,
  sanitizeQuickSites,
} from '@/lib/quickSite';
import type { QuickSite } from '@/lib/types';

const site = (id: string, name: string, url: string): QuickSite => ({ id, name, url });

describe('collectQuickSites', () => {
  it('补协议、按原标题取名', () => {
    const r = collectQuickSites([], [{ name: '掘金', url: 'juejin.cn' }]);
    expect(r.add).toEqual([{ name: '掘金', url: 'https://juejin.cn' }]);
    expect(r.dup).toBe(0);
    expect(r.invalid).toBe(0);
  });

  it('名称为空时退回域名', () => {
    const r = collectQuickSites([], [{ name: '   ', url: 'https://www.zhihu.com/hot' }]);
    expect(r.add[0].name).toBe('zhihu.com');
  });

  it('名称压空白并截断到上限', () => {
    const long = `  GitHub   ${'x'.repeat(40)}  `;
    const r = collectQuickSites([], [{ name: long, url: 'https://github.com' }]);
    expect(r.add[0].name.length).toBe(QUICK_NAME_MAX);
    expect(r.add[0].name.startsWith('GitHub x')).toBe(true);
    expect(r.add[0].name).not.toContain('  ');
  });

  it('与已有快捷访问重复（忽略大小写与结尾斜杠）→ 跳过', () => {
    const existing = [site('q1', '知乎', 'https://www.zhihu.com')];
    const r = collectQuickSites(existing, [{ name: '知乎首页', url: 'https://www.zhihu.com/' }]);
    expect(r.add).toHaveLength(0);
    expect(r.dup).toBe(1);
  });

  it('批内重复只留第一条', () => {
    const r = collectQuickSites([], [
      { name: 'A', url: 'https://a.com' },
      { name: 'A2', url: 'https://a.com/' },
    ]);
    expect(r.add).toEqual([{ name: 'A', url: 'https://a.com' }]);
    expect(r.dup).toBe(1);
  });

  it('浏览器内部页（chrome:// / edge://）算有效：tabs.create 打得开，不能拦', () => {
    const r = collectQuickSites([], [
      { name: '扩展程序', url: 'chrome://extensions' },
      { name: 'Edge 扩展', url: 'edge://extensions/' },
      { name: '空白页', url: 'about:blank' },
    ]);
    expect(r.add).toEqual([
      { name: '扩展程序', url: 'chrome://extensions' },
      { name: 'Edge 扩展', url: 'edge://extensions/' },
      { name: '空白页', url: 'about:blank' },
    ]);
    expect(r.invalid).toBe(0);
  });

  it('内部页没标题时用完整地址兜底，不裁成 extensions', () => {
    const r = collectQuickSites([], [{ name: '  ', url: 'chrome://extensions' }]);
    expect(r.add[0].name).toBe('chrome://extensions');
  });

  it('空网址 / 非法网址 / 扩展无权导航的协议算无效（文件夹与草稿走这条）', () => {
    const r = collectQuickSites([], [
      { name: '文件夹', url: '' },
      { name: '草稿', url: '   ' },
      { name: '调试器', url: 'devtools://devtools/bundled/inspector.html' },
      { name: '坏地址', url: 'http://' },
      { name: '好地址', url: 'example.com' },
    ]);
    expect(r.add).toEqual([{ name: '好地址', url: 'https://example.com' }]);
    expect(r.invalid).toBe(4);
  });
});

describe('sanitizeQuickSites', () => {
  it('非数组回落空表', () => {
    expect(sanitizeQuickSites(null)).toEqual([]);
    expect(sanitizeQuickSites({ a: 1 })).toEqual([]);
    expect(sanitizeQuickSites('nope')).toEqual([]);
  });

  it('丢掉缺字段 / 类型不对 / 空值的条目', () => {
    const r = sanitizeQuickSites([
      { id: 'q1', name: '知乎', url: 'https://www.zhihu.com' },
      { id: '', name: 'X', url: 'https://x.com' },
      { id: 'q2', name: 42, url: 'https://x.com' },
      { id: 'q3', name: '空网址', url: '   ' },
      null,
      'nope',
    ]);
    expect(r).toEqual([{ id: 'q1', name: '知乎', url: 'https://www.zhihu.com' }]);
  });
});
