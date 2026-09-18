import { describe, expect, it } from 'vitest';
import { THEME_MODES, normalizeTheme, resolveTheme } from '@/lib/theme';
import { t, type I18nKey } from '@/lib/i18n';

describe('resolveTheme', () => {
  it('显式模式不受系统偏好影响', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('跟随系统时按系统偏好解析', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('normalizeTheme', () => {
  it('非法值一律回落到跟随系统', () => {
    expect(normalizeTheme(undefined)).toBe('system');
    expect(normalizeTheme(null)).toBe('system');
    expect(normalizeTheme('blue')).toBe('system');
    expect(normalizeTheme(1)).toBe('system');
    expect(normalizeTheme({ theme: 'dark' })).toBe('system');
  });

  it('合法值原样保留', () => {
    for (const m of THEME_MODES) expect(normalizeTheme(m)).toBe(m);
  });

  it('三种模式都有双语文案，顺序为 明亮 / 暗黑 / 跟随系统', () => {
    expect(THEME_MODES).toEqual(['light', 'dark', 'system']);
    expect(THEME_MODES.map((m) => t(`theme.${m}` as I18nKey))).toEqual(['明亮', '暗黑', '跟随系统']);
  });
});
