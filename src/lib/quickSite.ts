/**
 * 快捷访问条目整理（纯函数，可单测）。
 * 拖拽来源五花八门：标签标题可能空、书签可能是文件夹或没填网址的草稿、多选可能整组重复，
 * 这里统一成「可直接落库的 {name, url} 列表」，并给出跳过计数供 toast 用。
 */
import { hostOf, isInternalUrl, normalizeUrl } from './url';
import type { QuickSite } from './types';

/** 名称上限，与新增表单的 maxLength 保持一致 */
export const QUICK_NAME_MAX = 24;

export interface QuickSiteInput {
  name: string;
  url: string;
}

export interface QuickCollectResult {
  /** 可写入的条目（已补名、已去重） */
  add: QuickSiteInput[];
  /** 与现有快捷访问（或批内前项）重复而跳过的条数 */
  dup: number;
  /** 没有可用网址而跳过的条数：文件夹、空草稿、浏览器内部页、非法地址 */
  invalid: number;
}

/** 去重键：忽略大小写与结尾斜杠 */
function urlKey(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/** 名称优先取原标题，空了退域名；统一压空白并截断 */
function cleanName(raw: string, url: string): string {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name) return name.slice(0, QUICK_NAME_MAX);
  return (hostOf(url) || url).slice(0, QUICK_NAME_MAX);
}

/**
 * 存储回读兜底：chrome.storage 里的值当外部输入处理，
 * 缺字段 / 类型不对的条目直接丢掉，别让渲染层拿到 undefined.name。
 */
export function sanitizeQuickSites(value: unknown): QuickSite[] {
  if (!Array.isArray(value)) return [];
  const out: QuickSite[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const v = raw as { id?: unknown; name?: unknown; url?: unknown };
    if (typeof v.id !== 'string' || !v.id) continue;
    if (typeof v.name !== 'string' || typeof v.url !== 'string') continue;
    if (!v.name.trim() || !v.url.trim()) continue;
    out.push({ id: v.id, name: v.name, url: v.url });
  }
  return out;
}

export function collectQuickSites(
  existing: QuickSite[],
  inputs: QuickSiteInput[],
): QuickCollectResult {
  const seen = new Set(existing.map((s) => urlKey(s.url)));
  const out: QuickCollectResult = { add: [], dup: 0, invalid: 0 };

  for (const input of inputs) {
    const url = normalizeUrl(input.url);
    // 浏览器内部页（chrome:// / chrome-extension:// …）能被拖进来但打不开，当无效处理
    if (!url || isInternalUrl(url)) {
      out.invalid += 1;
      continue;
    }
    const key = urlKey(url);
    if (seen.has(key)) {
      out.dup += 1;
      continue;
    }
    seen.add(key);
    out.add.push({ name: cleanName(input.name, url), url });
  }
  return out;
}
