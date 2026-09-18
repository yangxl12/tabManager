import { describe, expect, it } from 'vitest';
import { hostOf, isInternalUrl, normalizeUrl } from '@/lib/url';

describe('hostOf', () => {
  it('去掉 www. 与路径', () => {
    expect(hostOf('https://www.github.com/foo/bar?a=1')).toBe('github.com');
    expect(hostOf('http://juejin.cn/post/1')).toBe('juejin.cn');
  });

  it('非法 URL 退化为字符串裁剪', () => {
    expect(hostOf('github.com/foo')).toBe('github.com');
    expect(hostOf('')).toBe('');
  });
});

describe('normalizeUrl', () => {
  it('无协议自动补 https://', () => {
    expect(normalizeUrl('zhihu.com')).toBe('https://zhihu.com');
    expect(normalizeUrl('  www.baidu.com  ')).toBe('https://www.baidu.com');
  });

  it('保留已有协议与路径', () => {
    expect(normalizeUrl('https://a.com/b?c=1')).toBe('https://a.com/b?c=1');
    expect(normalizeUrl('http://a.com')).toBe('http://a.com');
  });

  it('空值与非法值返回空串', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
    expect(normalizeUrl('http://')).toBe('');
  });

  it('内部页原样保留（供上层判断）', () => {
    expect(normalizeUrl('chrome://settings')).toBe('chrome://settings');
    expect(isInternalUrl('chrome://newtab')).toBe(true);
    expect(isInternalUrl('edge://settings')).toBe(true);
    expect(isInternalUrl('about:blank')).toBe(true);
    expect(isInternalUrl('https://github.com')).toBe(false);
    expect(isInternalUrl('')).toBe(true);
  });
});
