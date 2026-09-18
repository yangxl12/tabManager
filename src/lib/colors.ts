/** 字母 tile 配色（demo 的 hash 配色，保留原样） */

export const TILE_COLORS = [
  '#DC4438',
  '#E4692B',
  '#C77D18',
  '#5C9A2E',
  '#0F8A6B',
  '#0C7C99',
  '#2C6FDB',
  '#5B5BD6',
  '#8E4EC6',
  '#D6409F',
  '#B5533C',
  '#0E7490',
];

export function hashOf(str: string): number {
  let h = 0;
  const s = String(str || '?');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorFor(seed: string): string {
  return TILE_COLORS[hashOf(seed) % TILE_COLORS.length];
}

/** 明暗偏移，-100 ~ 100 */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl((n >> 16) + amt * 2.55);
  const g = cl(((n >> 8) & 255) + amt * 2.55);
  const b = cl((n & 255) + amt * 2.55);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 取首个中英文/数字字符作为 tile 字母 */
export function firstChar(s: string): string {
  const m = String(s || '')
    .trim()
    .match(/[A-Za-z0-9\u4e00-\u9fa5]/);
  return m ? m[0].toUpperCase() : '?';
}

export function truncate(s: string, n: number): string {
  const t = String(s || '');
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
