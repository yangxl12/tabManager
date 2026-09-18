/** chrome.bookmarks 封装 */
import type { RawBmNode } from '@/lib/types';

export async function getTree(): Promise<RawBmNode[]> {
  const tree = await chrome.bookmarks.getTree();
  return tree as unknown as RawBmNode[];
}

export async function createBookmark(
  parentId: string,
  title: string,
  url: string,
  index?: number,
): Promise<string> {
  const node = await chrome.bookmarks.create({
    parentId,
    title,
    url,
    ...(typeof index === 'number' ? { index } : {}),
  });
  return node.id;
}

export async function createFolder(
  parentId: string,
  title: string,
  index?: number,
): Promise<string> {
  const node = await chrome.bookmarks.create({
    parentId,
    title,
    ...(typeof index === 'number' ? { index } : {}),
  });
  return node.id;
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
