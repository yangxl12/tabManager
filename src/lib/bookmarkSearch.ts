/**
 * 全库书签搜索（纯函数，可单测）。
 * 命中优先级：标题全等 > 标题前缀 > 标题包含 > 域名前缀 > 域名包含 > URL 包含 > 所在文件夹名包含。
 */
import { pathOf } from './bookmarkTree';
import { hostOf } from './url';
import type { BmNode, BmState } from './types';

export interface SearchHit {
  node: BmNode;
  /** 从顶层到父级（不含自身）的路径，用于展示「它在哪」 */
  path: BmNode[];
  score: number;
}

export function searchBookmarks(state: BmState, rawQuery: string, limit = 80): SearchHit[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const node of Object.values(state.nodes)) {
    if (node.isDraft) continue;
    if (node.isFolder && !node.title) continue; // Chrome 的无标题合成根

    const title = node.title.toLowerCase();
    let score = 0;

    if (title === q) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.includes(q)) score = 60;

    if (!node.isFolder && !score) {
      const host = hostOf(node.url).toLowerCase();
      if (host.startsWith(q)) score = 45;
      else if (host.includes(q)) score = 32;
      else if (node.url.toLowerCase().includes(q)) score = 18;
    }

    const parents = pathOf(state, node.id).slice(0, -1);
    if (!score && parents.some((p) => p.title.toLowerCase().includes(q))) score = 10;
    if (!score) continue;

    // 同分时短标题优先；文件夹整体降权，排在书签后面（它的用途是跳转）
    hits.push({
      node,
      path: parents,
      score: score - (node.isFolder ? 6 : 0) - Math.min(6, title.length * 0.06),
    });
  }

  hits.sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title, 'zh-Hans-CN'));
  return hits.slice(0, limit);
}
