/** 图标策略：_favicon 优先，失败降级字母 tile（由组件处理 onError） */
import { colorFor, firstChar } from '@/lib/colors';
import { hostOf, isInternalUrl } from '@/lib/url';

export function faviconUrl(pageUrl: string, size = 32): string {
  if (!pageUrl || isInternalUrl(pageUrl)) return '';
  try {
    const base = chrome.runtime.getURL('/_favicon/');
    return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
  } catch {
    return '';
  }
}

export interface TileStyle {
  color: string;
  color2: string;
  letter: string;
}

export function tileOf(seed: string): TileStyle {
  const color = colorFor(seed);
  return {
    color,
    color2: shadeOf(color),
    letter: firstChar(seed),
  };
}

function shadeOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl((n >> 16) - 45);
  const g = cl(((n >> 8) & 255) - 45);
  const b = cl((n & 255) - 45);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function tileSeedForUrl(url: string): string {
  return hostOf(url) || url || '?';
}
