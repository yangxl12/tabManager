import { describe, expect, it } from 'vitest';
import { ImportParseError, collectItems, parseImportText } from '@/lib/importParse';

describe('parseImportText', () => {
  it('解析 {name,url} 数组', () => {
    const r = parseImportText('[{"name":"V2EX","url":"https://v2ex.com"}]');
    expect(r.items).toEqual([{ name: 'V2EX', url: 'https://v2ex.com' }]);
    expect(r.skipped).toBe(0);
  });

  it('解析 {list:[…]} 与 {bookmarks:[…]}', () => {
    expect(parseImportText('{"list":[{"name":"A","url":"a.com"}]}').items).toEqual([
      { name: 'A', url: 'https://a.com' },
    ]);
    expect(parseImportText('{"bookmarks":[{"name":"B","url":"b.com"}]}').items).toEqual([
      { name: 'B', url: 'https://b.com' },
    ]);
  });

  it('递归展平 Chrome 导出的书签树', () => {
    const chromeExport = JSON.stringify({
      roots: {
        bookmark_bar: {
          children: [
            { name: 'GitHub', url: 'https://github.com' },
            {
              name: '工作',
              children: [{ name: 'Figma', url: 'https://figma.com' }],
            },
          ],
        },
        other: { children: [{ name: 'V2EX', url: 'https://v2ex.com' }] },
      },
    });
    const r = parseImportText(chromeExport);
    expect(r.items.map((i) => i.name)).toEqual(['GitHub', 'Figma', 'V2EX']);
  });

  it('title/href 字段同样识别，名称缺失时回退域名', () => {
    const r = parseImportText('[{"title":"掘金","href":"https://juejin.cn"},{"url":"v2ex.com"}]');
    expect(r.items).toEqual([
      { name: '掘金', url: 'https://juejin.cn' },
      { name: 'v2ex.com', url: 'https://v2ex.com' },
    ]);
  });

  it('去掉重复条目并统计无效项', () => {
    const r = parseImportText('[{"name":"A","url":"a.com"},{"name":"A","url":"a.com"},{"name":"bad","url":"   "}]');
    expect(r.items).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });

  it('空内容 / 非法 JSON / 无有效条目时抛错', () => {
    expect(() => parseImportText('')).toThrow(ImportParseError);
    expect(() => parseImportText('{oops')).toThrow(ImportParseError);
    expect(() => parseImportText('[]')).toThrow(ImportParseError);
    expect(() => parseImportText('{"a":1}')).toThrow(ImportParseError);
  });
});

describe('collectItems', () => {
  it('接受已解析的对象', () => {
    const r = collectItems({ children: [{ name: 'X', url: 'https://x.com' }] });
    expect(r.items).toEqual([{ name: 'X', url: 'https://x.com' }]);
  });

  it('接受纯字符串数组', () => {
    expect(collectItems(['a.com', 'b.com']).items.map((i) => i.url)).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});
