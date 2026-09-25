/** chrome.bookmarks 封装 */
import type { RawBmNode } from '@/lib/types';

/**
 * create() 的返回值：写 store 时需要 parentId / index 与特殊文件夹标记。
 * 只回 id 会让调用方「先等 Promise 再回头查节点」，与 onCreated 回灌之间留出竞态缝隙。
 */
export interface CreatedNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  folderType?: string;
  unmodifiable?: string;
  syncing?: boolean;
}

function toCreated(node: chrome.bookmarks.BookmarkTreeNode): CreatedNode {
  const out: CreatedNode = { id: node.id, title: node.title };
  if (node.parentId !== undefined) out.parentId = node.parentId;
  if (node.url !== undefined) out.url = node.url;
  if (typeof node.index === 'number') out.index = node.index;
  if (node.folderType !== undefined) out.folderType = node.folderType;
  if (node.unmodifiable !== undefined) out.unmodifiable = node.unmodifiable;
  if (typeof node.syncing === 'boolean') out.syncing = node.syncing;
  return out;
}

export async function getTree(): Promise<RawBmNode[]> {
  const tree = await chrome.bookmarks.getTree();
  return tree as unknown as RawBmNode[];
}

export async function createBookmark(
  parentId: string,
  title: string,
  url: string,
  index?: number,
): Promise<CreatedNode> {
  const node = await chrome.bookmarks.create({
    parentId,
    title,
    url,
    ...(typeof index === 'number' ? { index } : {}),
  });
  return toCreated(node);
}

export async function createFolder(
  parentId: string,
  title: string,
  index?: number,
): Promise<CreatedNode> {
  const node = await chrome.bookmarks.create({
    parentId,
    title,
    ...(typeof index === 'number' ? { index } : {}),
  });
  return toCreated(node);
}

export async function updateNode(
  id: string,
  changes: { title?: string; url?: string },
): Promise<void> {
  await chrome.bookmarks.update(id, changes);
}

export async function removeNode(id: string): Promise<void> {
  await chrome.bookmarks.remove(id);
}

export async function removeTree(id: string): Promise<void> {
  await chrome.bookmarks.removeTree(id);
}

export async function moveNode(
  id: string,
  parentId: string,
  index?: number,
): Promise<void> {
  await chrome.bookmarks.move(id, {
    parentId,
    ...(typeof index === 'number' ? { index } : {}),
  });
}

export async function getSubTree(id: string): Promise<RawBmNode[]> {
  const list = await chrome.bookmarks.getSubTree(id);
  return list as unknown as RawBmNode[];
}
