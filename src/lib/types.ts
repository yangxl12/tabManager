/** 全局共享类型 */

/** 归一化后的书签树节点（文件夹与书签统一建模） */
export interface BmNode {
  id: string;
  parentId: string | null;
  title: string;
  /** 书签的 URL；文件夹为 '' */
  url: string;
  isFolder: boolean;
  /** 有序子节点 id（文件夹与书签混排，顺序即真实顺序） */
  children: string[];
  /** 本地草稿（尚未写入浏览器书签，缺 URL 时保留在会话内） */
  isDraft?: boolean;
  /**
   * Chrome 特殊文件夹类型：'bookmarks-bar' | 'other' | 'mobile' | 'managed'。
   * 只有顶层特殊文件夹才有；用它判断顶层容器，别用 name（受语言影响）或 id（不固定）。
   */
  folderType?: string;
  /**
   * true = 账号（同步）书签；false = 此设备（本地）书签。
   * 单一存储的老 Chrome 上为 undefined。顶层特殊文件夹才有，需向下继承给子树。
   */
  syncing?: boolean;
}

export interface BmState {
  nodes: Record<string, BmNode>;
  /** 顶层文件夹 id（通常就是根节点 '0'） */
  roots: string[];
}

/** 允许传入的最小树结构（chrome.bookmarks.BookmarkTreeNode 结构兼容） */
export interface RawBmNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: RawBmNode[];
  folderType?: string;
  syncing?: boolean;
}

export interface TabItem {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  pinned: boolean;
}

export interface QuickSite {
  id: string;
  name: string;
  url: string;
}

export type ToastTone = 'ok' | 'warn' | 'danger';

export interface ToastItem {
  id: string;
  msg: string;
  tone: ToastTone;
  action?: string;
  onAction?: () => void;
  duration: number;
}

/** 撤销栈记录：一次删除（可能含多条）为一条记录 */
export interface UndoRecord {
  items: Array<{ parentId: string; index: number; node: BmNode; snapshot: BmNode[] }>;
  label: string;
}

export interface ImportItem {
  name: string;
  url: string;
}
