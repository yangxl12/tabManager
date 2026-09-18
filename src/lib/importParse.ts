/**
 * JSON → 书签列表（zod 校验）。
 * 兼容：① `[{name,url}]` / `{list:[…]}` / `{bookmarks:[…]}`（demo 格式）
 *      ② Chrome 书签管理器导出的 `{roots:{…}}` 树（递归收集所有 url 节点）
 */
import { z } from 'zod';
import { hostOf, normalizeUrl } from './url';
import type { ImportItem } from './types';

export class ImportParseError extends Error {}

export interface ImportResult {
  items: ImportItem[];
  skipped: number;
}

const ItemSchema = z
  .object({
    name: z.string().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    href: z.string().optional(),
  })
  .loose();

interface Bucket {
  items: ImportItem[];
  skipped: number;
  seen: Set<string>;
}

function pushItem(bucket: Bucket, rawName: unknown, rawUrl: unknown): void {
  const parsed = ItemSchema.safeParse({ name: rawName, url: rawUrl });
  if (!parsed.success) {
    bucket.skipped += 1;
    return;
  }
  const url = normalizeUrl(String(parsed.data.url ?? parsed.data.href ?? ''));
  if (!url) {
    bucket.skipped += 1;
    return;
  }
  const name =
    String(parsed.data.name ?? parsed.data.title ?? '').trim() || hostOf(url);
  const key = `${name}\u0000${url}`;
  if (bucket.seen.has(key)) return;
  bucket.seen.add(key);
  bucket.items.push({ name, url });
}

function walk(node: unknown, bucket: Bucket): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, bucket);
    return;
  }
  if (typeof node === 'string') {
    pushItem(bucket, '', node);
    return;
  }
  if (typeof node !== 'object') {
    bucket.skipped += 1;
    return;
  }
  const o = node as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url : typeof o.href === 'string' ? o.href : '';
  if (url) {
    pushItem(bucket, o.title ?? o.name, url);
  }
  // 容器字段：Chrome 导出树 / demo 的多种包裹形式
  if (Array.isArray(o.children)) walk(o.children, bucket);
  if (o.roots && typeof o.roots === 'object') walk(Object.values(o.roots), bucket);
  if (o.bookmarks) walk(o.bookmarks, bucket);
  if (o.items) walk(o.items, bucket);
  if (o.list) walk(o.list, bucket);
}

/** 解析 JSON 文本，返回可导入条目 */
export function parseImportText(text: string): ImportResult {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new ImportParseError('内容为空，先粘贴 JSON');

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (err) {
    throw new ImportParseError(`JSON 解析失败：${(err as Error).message}`);
  }
  return collectItems(data);
}

/** 解析已解析的 JSON 值（文件读取场景） */
export function collectItems(data: unknown): ImportResult {
  const bucket: Bucket = { items: [], skipped: 0, seen: new Set() };
  walk(data, bucket);
  if (!bucket.items.length) {
    throw new ImportParseError('没有解析到有效的书签（需要 name / url 字段）');
  }
  return { items: bucket.items, skipped: bucket.skipped };
}

export const SAMPLE_JSON = `{
  "name": "我的书签",
  "bookmarks": [
    { "name": "V2EX", "url": "https://www.v2ex.com" },
    { "name": "Product Hunt", "url": "https://www.producthunt.com" },
    { "name": "Smashing Magazine", "url": "https://www.smashingmagazine.com" },
    { "name": "CSS-Tricks", "url": "https://css-tricks.com" }
  ]
}`;
