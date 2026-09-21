/**
 * 图标策略：_favicon 优先，取不到降级字母 tile。
 *
 * 坑：Chrome 的 `_favicon` 在「本地没有该站图标缓存」时不报错，而是回一张
 * 统一的默认图（灰地球，任何域名、任何尺寸都返回同一张，200 + 1218 字节）。
 * onError 永远不触发 → 界面上会糊一片灰地球。所以这里用「默认图指纹」识破它：
 * 拿一个必然解析失败的域名探一次底图，把图和底图缩到 8x8 比对 RGBA 差值，
 * 足够像就当成「没取到」，交给组件退首字母。
 */
import { colorFor, firstChar } from '@/lib/colors';
import { hostOf, isInternalUrl } from '@/lib/url';

/** 探测域名：.invalid 保证 DNS 失败 → Chrome 必回默认兜底图 */
const PROBE_URL = 'https://tabnest-favicon-probe.invalid/';

/** 判定为「同一张图」的平均通道差阈值（0~255）。缩略插值会带来几个点的误差 */
const SAME_ICON_TOLERANCE = 14;

export function faviconUrl(pageUrl: string, size = 32): string {
  if (!pageUrl || isInternalUrl(pageUrl)) return '';
  try {
    const base = chrome.runtime.getURL('/_favicon/');
    return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
  } catch {
    return '';
  }
}

/** 缩到 8x8 取 RGBA 像素（同源扩展资源，canvas 不会被污染） */
function pixelsOf(img: HTMLImageElement): number[] {
  try {
    const cv = document.createElement('canvas');
    cv.width = 8;
    cv.height = 8;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.clearRect(0, 0, 8, 8);
    ctx.drawImage(img, 0, 0, 8, 8);
    return [...ctx.getImageData(0, 0, 8, 8).data];
  } catch {
    return [];
  }
}

/** 按请求尺寸缓存底图指纹（整页只探一次） */
const baseCache = new Map<number, Promise<number[]>>();

function basePixels(size: number): Promise<number[]> {
  let p = baseCache.get(size);
  if (!p) {
    p = new Promise<number[]>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(pixelsOf(img));
      img.onerror = () => resolve([]);
      img.src = faviconUrl(PROBE_URL, size);
    });
    baseCache.set(size, p);
  }
  return p;
}

/** 这张图是不是 Chrome 的默认兜底图（= 实际没取到站点图标） */
export async function isFallbackIcon(img: HTMLImageElement, size = 32): Promise<boolean> {
  try {
    const base = await basePixels(size);
    const cur = pixelsOf(img);
    if (!base.length || !cur.length) return false;
    let sum = 0;
    for (let i = 0; i < cur.length; i++) sum += Math.abs(cur[i] - base[i]);
    return sum / cur.length <= SAME_ICON_TOLERANCE;
  } catch {
    return false;
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
