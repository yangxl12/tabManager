/**
 * 书签树纯函数：查找 / 计数 / 展平 / 移动（无 chrome 依赖，可单测）
 * 约定：
 *  - 所有 index 均表示「移除被移动项之后」的插入下标。
 *  - 顶层特殊文件夹（书签栏 / 其他书签 / 移动设备书签）在 Chrome 新版里会出现两套
 *    （账号同步的 + 此设备本地的），靠 node.syncing 区分，别用 name（受语言影响）或 id（不固定）。
 */
import type { BmState, BmNode, RawBmNode } from './types';
import { t } from './i18n';

export interface TreeRow {
  node: BmNode;
  depth: number;
  hasChildren: boolean;
  open: boolean;
  /** 所属顶层分组的 key，渲染分组标题时靠它判断换组 */
  groupKey: string;
  /** 分组标题；null 表示这一组不显示标题（只有一套存储时和 Chrome 原生一致） */
  groupLabel: string | null;
}

export interface RootGroup {
  key: 'account' | 'device' | 'all';
  label: string | null;
  roots: string[];
}

export function normalizeTree(raw: RawBmNode[]): BmState {
  const nodes: Record<string, BmNode> = {};
  const roots: string[] = [];
  const walk = (n: RawBmNode, parentId: string | null, inheritedSyncing?: boolean) => {
    // syncing 只有顶层特殊文件夹才带，向下继承，标记整棵子树的存储归属
    const syncing = typeof n.syncing === 'boolean' ? n.syncing : inheritedSyncing;
    nodes[n.id] = {
      id: n.id,
      parentId,
      title: n.title ?? '',
      url: n.url ?? '',
      isFolder: !n.url,
      children: n.children ? n.children.map((c) => c.id) : [],
      folderType: n.folderType,
      unmodifiable: n.unmodifiable,
      syncing,
    };
    if (n.children) for (const c of n.children) walk(c, n.id, syncing);
  };
  for (const r of raw) {
    roots.push(r.id);
    walk(r, null);
  }
  return { nodes, roots };
}

/* -------------------------- 幂等写入（创建结果 / 事件回灌共用） -------------------------- */

/**
 * 把某个 id 放进父节点的 children，且保证只出现一次。
 * 重复引用会让同一行渲染两次（相同 React key），重命名输入框互抢焦点，必须在这里堵住。
 * 返回该 id 最终所在下标；父节点不存在时返回 -1。
 */
export function insertChildOnce(
  state: BmState,
  parentId: string,
  index: number | undefined,
  id: string,
): number {
  const p = state.nodes[parentId];
  if (!p || !p.isFolder) return -1;
  for (let i = p.children.length - 1; i >= 0; i--) {
    if (p.children[i] === id) p.children.splice(i, 1);
  }
  // index 缺失（例如事件里没带）时按「追加到末尾」处理，避免 NaN 把节点插到最前面
  const at =
    typeof index === 'number' && Number.isFinite(index)
      ? Math.max(0, Math.min(index, p.children.length))
      : p.children.length;
  p.children.splice(at, 0, id);
  return at;
}

export interface NodeSeed {
  id: string;
  parentId: string;
  title: string;
  url: string;
  isFolder: boolean;
  index?: number;
  folderType?: string;
  unmodifiable?: string;
  syncing?: boolean;
}

/**
 * 创建节点的唯一写入口：本地乐观更新与 chrome.bookmarks.onCreated 回灌都必须走它。
 *
 * 双写是必然发生的（Promise 回调 + 事件回灌），因此这里必须幂等：
 *  - 同一个 id 在 nodes 里只有一个，已存在时只 merge 字段，绝不整对象覆盖
 *    （覆盖会丢掉先到的 children / syncing 等元信息）；
 *  - 同一个 id 在父节点 children 里只保留一份，位置以最后一次拿到的 index 为准。
 */
export function upsertNode(state: BmState, seed: NodeSeed): void {
  const prev = state.nodes[seed.id];
  if (prev) {
    prev.parentId = seed.parentId;
    prev.title = seed.title;
    prev.url = seed.url;
    prev.isFolder = seed.isFolder;
    if (seed.folderType !== undefined) prev.folderType = seed.folderType;
    if (seed.unmodifiable !== undefined) prev.unmodifiable = seed.unmodifiable;
    if (seed.syncing !== undefined) prev.syncing = seed.syncing;
    else if (prev.syncing === undefined) {
      // 新书签的存储归属继承自父文件夹；父节点没区分存储时保持 undefined
      const inherit = seed.parentId ? state.nodes[seed.parentId]?.syncing : undefined;
      if (typeof inherit === 'boolean') prev.syncing = inherit;
    }
    return;
  }

  state.nodes[seed.id] = {
    id: seed.id,
    parentId: seed.parentId,
    title: seed.title,
    url: seed.url,
    isFolder: seed.isFolder,
    children: [],
    folderType: seed.folderType,
    unmodifiable: seed.unmodifiable,
    syncing: seed.syncing,
  };

  const p = state.nodes[seed.parentId];
  if (!p?.isFolder) return;
  // 父节点下标：拿不到就按父节点该 id 的现有位置，还没有就追加到末尾
  const known = p.children.indexOf(seed.id);
  const at =
    typeof seed.index === 'number' ? seed.index : known > -1 ? known : p.children.length;
  insertChildOnce(state, seed.parentId, at, seed.id);
}

export function nodeOf(state: BmState, id: string): BmNode | undefined {
  return state.nodes[id];
}

/** Chrome 的合成容器节点：没有 folderType 也没有标题，只是把顶层文件夹包了一层 */
function isSyntheticFolder(state: BmState, n: BmNode): boolean {
  if (!n.isFolder || n.title || n.folderType) return false;
  const parent = n.parentId ? state.nodes[n.parentId] : undefined;
  return !parent || !parent.folderType;
}

/** 顶层可展示文件夹（跳过 Chrome 的无标题合成根） */
export function treeRootIds(state: BmState): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = state.nodes[id];
    if (!n || !n.isFolder) return;
    if (isSyntheticFolder(state, n)) {
      for (const c of n.children) walk(c);
      return;
    }
    out.push(id);
  };
  for (const r of state.roots) walk(r);
  return out;
}

/** 树中全部可展示的文件夹 id（跳过合成根），书签树默认据此全部展开 */
export function allFolderIds(state: BmState): string[] {
  const out: string[] = [];
  for (const n of Object.values(state.nodes)) {
    if (n.isFolder && !isSyntheticFolder(state, n)) out.push(n.id);
  }
  return out;
}

/**
 * 顶层文件夹按「账号书签 / 此设备书签」分组。
 * 只有一套存储时（未登录、或旧版 Chrome 没有 syncing 字段）返回单组且不带标题，
 * 与 Chrome 原生书签管理器的表现一致。
 */
export function rootGroups(state: BmState): RootGroup[] {
  const buckets: Record<RootGroup['key'], string[]> = { account: [], device: [], all: [] };
  for (const id of treeRootIds(state)) {
    const syncing = state.nodes[id]?.syncing;
    if (syncing === true) buckets.account.push(id);
    else if (syncing === false) buckets.device.push(id);
    else buckets.all.push(id);
  }

  const groups: RootGroup[] = [];
  if (buckets.account.length) {
    groups.push({ key: 'account', label: t('group.account'), roots: buckets.account });
  }
  if (buckets.device.length) {
    groups.push({ key: 'device', label: t('group.device'), roots: buckets.device });
  }
  if (buckets.all.length) groups.push({ key: 'all', label: null, roots: buckets.all });

  if (groups.length <= 1) for (const g of groups) g.label = null;
  return groups;
}

/** 节点属于账号书签还是此设备书签；undefined 表示这套数据没区分 */
export function storageOf(state: BmState, id: string): boolean | undefined {
  return state.nodes[id]?.syncing;
}

export function childrenOf(state: BmState, id: string): BmNode[] {
  const n = state.nodes[id];
  if (!n) return [];
  return n.children.map((c) => state.nodes[c]).filter(Boolean) as BmNode[];
}

/** 从顶层到自身的路径（不含合成根） */
export function pathOf(state: BmState, id: string): BmNode[] {
  const chain: BmNode[] = [];
  let cur: BmNode | undefined = state.nodes[id];
  let guard = 0;
  while (cur && guard++ < 64) {
    chain.unshift(cur);
    cur = cur.parentId ? state.nodes[cur.parentId] : undefined;
  }
  return chain.filter((n) => !isSyntheticFolder(state, n));
}

/** 子树内书签总数（重复引用只算一次，且能扛住异常环） */
export function countOf(state: BmState, id: string, seen: Set<string> = new Set()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const n = state.nodes[id];
  if (!n || !n.isFolder) return 0;
  let total = 0;
  for (const cid of n.children) {
    const ch = state.nodes[cid];
    if (!ch) continue;
    total += ch.isFolder ? countOf(state, cid, seen) : ch.isDraft ? 0 : 1;
  }
  return total;
}

export function totalBookmarks(state: BmState): number {
  let n = 0;
  for (const node of Object.values(state.nodes)) if (!node.isFolder && !node.isDraft) n++;
  return n;
}

export function totalFolders(state: BmState): number {
  let n = 0;
  for (const id of treeRootIds(state)) {
    n += 1;
    n += descendantIds(state, id).filter((d) => state.nodes[d]?.isFolder).length;
  }
  return n;
}

export function descendantIds(state: BmState, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const walk = (nid: string) => {
    const n = state.nodes[nid];
    if (!n) return;
    for (const c of n.children) {
      // 去重：同一个 id 被挂两次时，列表里不该出现两份（否则删除/计数会重复处理）
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      if (state.nodes[c]?.isFolder) walk(c);
    }
  };
  walk(id);
  return out;
}

export function isDescendant(state: BmState, ancestorId: string, id: string): boolean {
  let cur = state.nodes[id];
  let guard = 0;
  while (cur && cur.parentId && guard++ < 64) {
    if (cur.parentId === ancestorId) return true;
    cur = state.nodes[cur.parentId];
  }
  return false;
}

/** 展平为渲染用行列表（按顶层分组顺序，逐组下钻） */
export function visibleRows(state: BmState, expanded: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const seen = new Set<string>();
  const walk = (ids: string[], depth: number, group: RootGroup) => {
    for (const id of ids) {
      const n = state.nodes[id];
      if (!n || !n.isFolder) continue;
      // 同一个 id 被挂两次时会渲染出两行（且 React key 重复、重命名输入框互抢焦点）
      if (seen.has(id)) continue;
      seen.add(id);
      const hasChildren = n.children.some((c) => state.nodes[c]?.isFolder);
      const open = expanded.has(id);
      rows.push({
        node: n,
        depth,
        hasChildren,
        open,
        groupKey: group.key,
        groupLabel: group.label,
      });
      if (hasChildren && open) walk(n.children, depth + 1, group);
    }
  };
  for (const group of rootGroups(state)) walk(group.roots, 0, group);
  return rows;
}

/** 节点是否可被扩展改名 / 删除（浏览器内建顶层文件夹与管理员托管节点不行） */
export function canModify(state: BmState, id: string): boolean {
  const n = state.nodes[id];
  return !!n && !n.unmodifiable;
}

/** 索引：某节点在其父节点中的位置 */
export function indexInParent(state: BmState, id: string): number {
  const n = state.nodes[id];
  if (!n || !n.parentId) return -1;
  return state.nodes[n.parentId]?.children.indexOf(id) ?? -1;
}

/* -------------------------- 可变操作（适配 immer draft） -------------------------- */

/** 可变操作：删掉父节点 children 里该 id 的**全部**引用（不只是第一份） */
export function detach(state: BmState, id: string): { parentId: string; index: number } | null {
  const n = state.nodes[id];
  if (!n || !n.parentId) return null;
  const p = state.nodes[n.parentId];
  if (!p) return null;
  const first = p.children.indexOf(id);
  if (first > -1) {
    for (let i = p.children.length - 1; i >= 0; i--) {
      if (p.children[i] === id) p.children.splice(i, 1);
    }
  }
  // 只删第一份会留下幽灵 id：节点已从 nodes 里删掉，父节点却还引用着它
  return { parentId: p.id, index: first };
}

export function attach(
  state: BmState,
  parentId: string,
  index: number | undefined,
  id: string,
): boolean {
  const p = state.nodes[parentId];
  const n = state.nodes[id];
  if (!p || !n || !p.isFolder) return false;
  const i = insertChildOnce(state, parentId, index, id);
  if (i < 0) return false;
  n.parentId = parentId;
  return true;
}

export function moveInTree(
  state: BmState,
  id: string,
  parentId: string,
  index: number,
): boolean {
  if (id === parentId) return false;
  if (isDescendant(state, id, parentId)) return false;
  detach(state, id);
  return attach(state, parentId, index, id);
}

/**
 * 把整棵子树（含自身）的存储归属改成 syncing。
 * 账号书签与此设备书签可以互相搬运——挂到哪个顶层文件夹下，就归哪套存储，
 * 所以搬完必须重新标记，否则本地模型里的归属会和新位置不一致。
 * syncing 为 undefined 表示这套数据本身不区分存储，此时清掉节点上的残留标记。
 */
export function applySyncing(
  state: BmState,
  id: string,
  syncing: boolean | undefined,
  seen: Set<string> = new Set(),
): void {
  if (seen.has(id)) return;
  seen.add(id);
  const n = state.nodes[id];
  if (!n) return;
  if (typeof syncing === 'boolean') n.syncing = syncing;
  else delete n.syncing;
  for (const cid of n.children) applySyncing(state, cid, syncing, seen);
}

export function removeSubtree(state: BmState, id: string): void {
  const ids = [id, ...descendantIds(state, id)];
  detach(state, id);
  for (const i of ids) delete state.nodes[i];
  // 清掉整棵树里指向已删节点的残留引用：重复引用 / 幽灵 id 会在移动与排序时继续作乱
  for (const node of Object.values(state.nodes)) {
    if (!node.children.some((c) => !state.nodes[c])) continue;
    node.children = node.children.filter((c) => !!state.nodes[c]);
  }
}

/* -------------------------- 排序计划 -------------------------- */

/** 目标列表中，被移动项剔除后的插入下标 */
export function dropInsertIndex(
  order: string[],
  targetId: string | null,
  side: 'before' | 'after',
  movingIds: string[],
): number {
  const moving = new Set(movingIds);
  const rest = order.filter((id) => !moving.has(id));
  if (targetId == null) return rest.length;
  const ti = rest.indexOf(targetId);
  if (ti < 0) return rest.length;
  return side === 'after' ? ti + 1 : ti;
}

/** 把 movingIds 按原相对顺序插到 insertIndex 处 */
export function reorderIds(
  order: string[],
  movingIds: string[],
  insertIndex: number,
): string[] {
  const moving = new Set(movingIds);
  const rest = order.filter((id) => !moving.has(id));
  const moved = order.filter((id) => moving.has(id));
  const i = Math.max(0, Math.min(insertIndex, rest.length));
  return [...rest.slice(0, i), ...moved, ...rest.slice(i)];
}

/**
 * 一维顺序收敛计划：从左到右逐个移动到目标下标。
 * 返回需要执行的 move 调用序列（已是「按序执行即生效」的顺序）。
 */
export function movePlan<T extends string | number>(
  current: T[],
  desired: T[],
): Array<{ id: T; index: number }> {
  const plan: Array<{ id: T; index: number }> = [];
  const cur = [...current];
  for (let i = 0; i < desired.length; i++) {
    const id = desired[i];
    const at = cur.indexOf(id);
    if (at === i) continue;
    if (at === -1) {
      cur.splice(i, 0, id);
    } else {
      cur.splice(at, 1);
      cur.splice(Math.min(i, cur.length), 0, id);
    }
    plan.push({ id, index: i });
  }
  return plan;
}

/** 树内重排：把 flat 列表中的片段整理为「同父节点下的目标顺序」 */
export function isSameParent(state: BmState, ids: string[]): boolean {
  if (!ids.length) return false;
  const p = state.nodes[ids[0]]?.parentId ?? null;
  return ids.every((id) => (state.nodes[id]?.parentId ?? null) === p);
}
