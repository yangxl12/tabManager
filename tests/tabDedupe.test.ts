import { describe, expect, it } from 'vitest';
import {
  isSameNewTabUrl,
  normalizePageUrl,
  pickNewTabSurvivor,
  type DedupeTab,
} from '@/lib/tabDedupe';

const SELF_URL = 'chrome-extension://abcd/src/newtab/index.html';
const OTHER_URL = 'https://example.com/';
const SELF_URLS = [SELF_URL];

const tab = (id: number, url: string, windowId = 1): DedupeTab => ({ id, url, windowId });

describe('normalizePageUrl', () => {
  it('去掉 query 与 hash', () => {
    expect(normalizePageUrl('https://a.com/p?x=1#y')).toBe('https://a.com/p');
    expect(normalizePageUrl('https://a.com/p#y')).toBe('https://a.com/p');
    expect(normalizePageUrl('https://a.com/p')).toBe('https://a.com/p');
  });

  it('去掉末尾斜杠（虚拟地址 chrome://newtab/ 带斜杠）', () => {
    expect(normalizePageUrl('chrome://newtab/')).toBe('chrome://newtab');
    expect(normalizePageUrl('chrome-extension://abcd/')).toBe('chrome-extension://abcd');
  });

  it('空值返回空串', () => {
    expect(normalizePageUrl('')).toBe('');
    expect(normalizePageUrl(undefined as unknown as string)).toBe('');
  });
});

describe('isSameNewTabUrl', () => {
  it('Chrome 保留的新标签页虚拟地址算同一个页面（点「+」开出来的就是它）', () => {
    expect(isSameNewTabUrl('chrome://newtab/', SELF_URLS)).toBe(true);
    expect(isSameNewTabUrl('chrome://newtab', SELF_URLS)).toBe(true);
  });

  it('与自身地址之一相同算同一个页面（显式打开扩展页 / dev server）', () => {
    expect(isSameNewTabUrl(SELF_URL, SELF_URLS)).toBe(true);
    expect(
      isSameNewTabUrl('http://localhost:5173/src/newtab/index.html', [
        'http://localhost:5173/src/newtab/index.html',
      ]),
    ).toBe(true);
  });

  it('普通网页、其他扩展页面都不算', () => {
    expect(isSameNewTabUrl(OTHER_URL, SELF_URLS)).toBe(false);
    expect(isSameNewTabUrl('chrome-extension://zzzz/options.html', SELF_URLS)).toBe(false);
    expect(isSameNewTabUrl('chrome://bookmarks/', SELF_URLS)).toBe(false);
  });

  it('空地址不算', () => {
    expect(isSameNewTabUrl('', SELF_URLS)).toBe(false);
  });
});

describe('pickNewTabSurvivor', () => {
  it('同窗口已有同址页面 → 让位给 id 最小的那个', () => {
    const tabs = [tab(7, SELF_URL), tab(3, SELF_URL), tab(9, 'chrome://newtab/')];
    expect(pickNewTabSurvivor(tabs, { id: 9, windowId: 1 }, SELF_URLS)).toBe(3);
  });

  it('自己就是最老的 → 留下（不返回任何 id）', () => {
    const tabs = [tab(3, SELF_URL), tab(7, SELF_URL)];
    expect(pickNewTabSurvivor(tabs, { id: 3, windowId: 1 }, SELF_URLS)).toBeNull();
  });

  it('窗口里只有自己 → 留下', () => {
    expect(
      pickNewTabSurvivor([tab(3, SELF_URL), tab(4, OTHER_URL)], { id: 3, windowId: 1 }, SELF_URLS),
    ).toBeNull();
  });

  it('别的窗口开着 TabNest 不算数（按窗口隔离）', () => {
    const tabs = [tab(3, SELF_URL, 2), tab(4, OTHER_URL, 1)];
    expect(pickNewTabSurvivor(tabs, { id: 9, windowId: 1 }, SELF_URLS)).toBeNull();
  });

  it('普通标签不会互相影响', () => {
    const tabs = [tab(2, OTHER_URL), tab(4, 'https://other.com/')];
    expect(pickNewTabSurvivor(tabs, { id: 9, windowId: 1 }, SELF_URLS)).toBeNull();
  });

  it('hash / query / 末尾斜杠不同的同址页面仍然算同址', () => {
    const tabs = [tab(3, `${SELF_URL}#a`), tab(5, `${SELF_URL}?x=1`)];
    expect(pickNewTabSurvivor(tabs, { id: 9, windowId: 1 }, SELF_URLS)).toBe(3);
  });

  it('「+」开出的标签（虚拟地址）能被认出来并给老页面让位', () => {
    // 这一条就是线上真实场景：老页面 url 是 chrome://newtab/，新页面是扩展地址
    const tabs = [tab(3, 'chrome://newtab/'), tab(9, SELF_URL)];
    expect(pickNewTabSurvivor(tabs, { id: 9, windowId: 1 }, SELF_URLS)).toBe(3);
  });

  it('多个页面同时自检也只有最老的那个留下（不会互相关闭）', () => {
    const tabs = [tab(3, SELF_URL), tab(7, SELF_URL), tab(9, SELF_URL)];
    const decisions = [3, 7, 9].map(
      (id) => pickNewTabSurvivor(tabs, { id, windowId: 1 }, SELF_URLS) ?? id,
    );
    expect(new Set(decisions)).toEqual(new Set([3]));
  });
});
