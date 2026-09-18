import { afterEach, describe, expect, it } from 'vitest';
import { getLang, normalizeLang, setLangMirror, t } from '@/lib/i18n';

afterEach(() => {
  // 还原默认语言，避免影响其他用例
  setLangMirror('zh');
});

describe('i18n', () => {
  it('默认中文，键不存在时原样返回 key', () => {
    expect(getLang()).toBe('zh');
    expect(t('tabs.title')).toBe('已打开的标签');
    expect(t('nope.nope' as never)).toBe('nope.nope');
  });

  it('切到英文后取英文文案，切回中文还原', () => {
    setLangMirror('en');
    expect(t('tabs.title')).toBe('Open Tabs');
    setLangMirror('zh');
    expect(t('tabs.title')).toBe('已打开的标签');
  });

  it('占位符按 params 替换', () => {
    setLangMirror('zh');
    expect(t('toast.closedMany', { n: 3 })).toBe('已关闭 3 个标签');
    setLangMirror('en');
    expect(t('toast.closedOne', { t: 'Docs' })).toBe('Closed tab "Docs"');
  });

  it('normalizeLang 非法值回落 zh', () => {
    expect(normalizeLang('en')).toBe('en');
    expect(normalizeLang('fr')).toBe('zh');
    expect(normalizeLang(null)).toBe('zh');
    expect(normalizeLang(1)).toBe('zh');
  });
});
