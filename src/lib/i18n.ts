/**
 * 轻量双语（zh / en）—— 纯逻辑，不 import chrome / React。
 * - `t(key, params)` 同步取文案：React 组件通过 store 的 useT() 订阅重渲染；
 *   slice / dnd 等非 React 代码直接调用（读模块级当前语言，toast 在产生那一刻定稿）。
 * - 语言真源是 chrome.storage.local（KEYS.lang）；localStorage 镜像专喂首帧，
 *   与 lib/theme.ts 的镜像方案同一套路。
 */

export type Lang = 'zh' | 'en';

/** localStorage 镜像 key（与 services/storage.ts 的 KEYS.lang 同名） */
export const LANG_MIRROR_KEY = 'tabnest.lang';

const zh = {
  // 通用
  'common.more': '更多操作',
  'common.cancel': '取消',
  'common.selectAll': '全选',
  'common.new': '新建',
  'common.edit': '编辑',
  'common.delete': '删除',
  'common.pick': '选择',
  'common.close': '关闭 (Esc)',

  // 标签面板
  'tabs.title': '已打开的标签',
  'tabs.selected': '已选 {n}',
  'tabs.multiHint': '多选模式 · 单击卡片即勾选，不再打开网站',
  'tabs.clearSel': '取消选择',
  'tabs.closeSel': '关闭选中',
  'tabs.hint': '拖拽排序 · 拖到右侧存为书签',
  'tabs.helpTitle': '快捷键与操作（Esc 关闭）',
  'tabs.emptyT': '没有正在打开的标签',
  'tabs.emptyS': '打开新的网页后，这里会自动出现卡片',
  'tab.close': '关闭标签',

  // 书签树（左侧）
  'tree.title': '书签文件夹',
  'tree.empty': '还没有读到书签文件夹',
  'tree.rowMore': '「{t}」更多操作',
  'tree.rename': '重命名',
  'tree.newSub': '新建子文件夹',
  'tree.delFolder': '删除文件夹',
  'group.account': '账号书签',
  'group.device': '此设备书签',

  // 书签网格
  'bm.fallbackTitle': '书签',
  'bm.multiHint': '多选模式 · 单击卡片即勾选',
  'bm.searchTitle': '全局搜索书签（Ctrl+K）',
  'bm.delSel': '删除选中 · {n}',
  'bm.import': '导入 JSON',
  'bm.emptyT': '这个文件夹还是空的',
  'bm.emptyS': '点右上角「新建」，或把左边的标签拖进来',
  'card.namePh': '输入名称',
  'card.urlPh': '输入网址',
  'card.edit': '编辑名称与网址',
  'card.del': '删除（可 Ctrl+Z 撤回）',

  // 快捷站点
  'quick.addTitle': '新增快捷站点',
  'quick.add': '新增',
  'quick.namePh': '名称，如：知乎',
  'quick.urlPh': '网址，如：zhihu.com',
  'quick.save': '保存',
  'quick.addBtn': '添加',
  'quick.needBoth': '名称和网址都要填',
  'quick.badUrl': '网址格式不对，例如 zhihu.com',
  'quick.deleted': '已删除快捷站点「{t}」',
  'quick.dropHint': '松手加入快捷访问',
  'quick.added': '已加入 {n} 个快捷访问',
  'quick.addedSkip': '已加入 {n} 个，跳过 {s} 个（重复或没有可用网址）',
  'quick.addNone': '没有可加入的条目：都已在快捷访问里，或没有可用网址',

  // 导入弹窗
  'imp.title': '批量导入书签',
  'imp.descA': '支持 ',
  'imp.descB': ' 以及 Chrome 书签管理器导出的完整 JSON 树。导入目标：',
  'imp.paste': '粘贴 JSON',
  'imp.file': '拖入文件',
  'imp.pickJson': '请选择 .json 文件',
  'imp.noItems': '没有解析到有效的书签',
  'imp.fail': '导入失败，请检查 JSON 内容',
  'imp.done': '已导入 {n} 个书签到「{f}」',
  'imp.tipCount': '{n} 条可导入',
  'imp.tipSkip': '，{n} 条无效跳过',
  'imp.chosen': '已选择 {f}',
  'imp.tipIdle': '粘贴 JSON 或拖入 .json 文件',
  'imp.dropA': '把 ',
  'imp.dropB': ' 文件拖到这里',
  'imp.dropOr': '或点击选择文件',
  'imp.rechoose': '重新拖入或点击可更换文件',
  'imp.sample': '填入示例',
  'imp.import': '导入',
  'imp.currentFolder': '当前文件夹',
  'imp.empty': '内容为空，先粘贴 JSON',
  'imp.badJson': 'JSON 解析失败：{msg}',
  'imp.noValid': '没有解析到有效的书签（需要 name / url 字段）',

  // 全局书签搜索
  'search.ph': '搜索全部书签：名称、域名、所在文件夹…',
  'search.clear': '清空输入',
  'search.hintIdle': '输入关键词开始搜索，共 {n} 个书签（含账号与此设备）',
  'search.folder': '文件夹',
  'search.untitled': '(未命名)',
  'search.noHitA': '没找到匹配「',
  'search.noHitB': '」的书签',
  'search.keys': '↑↓ 选择 · Enter 打开 · Esc 关闭',
  'search.results': '{n} 个结果',
  'search.count': '{n} 个书签',

  // 帮助面板
  'help.title': '快捷键与操作',
  'help.undo': '撤回删除',
  'help.undoHint': '书签',
  'help.multi': '多选 / 范围选择',
  'help.multiHint': '卡片',
  'help.enterMulti': '勾选任意卡片后进入多选模式',
  'help.enterMultiHint': '单击即勾选',
  'help.batchDel': '批量删除选中书签',
  'help.batchDelHint': 'Delete',
  'help.esc': '取消全部选择 / 关闭弹窗',
  'help.search': '全局搜索书签',
  'help.searchHint': '也点了右上角放大镜',
  'help.dragToBm': '拖拽标签到右侧',
  'help.dragToBmHint': '加入书签',
  'help.dragCards': '拖拽卡片 / 文件夹',
  'help.dragCardsHint': '排序 · 归入文件夹',
  'help.ctrlMulti': '按住 Ctrl 点击标签卡片',
  'help.ctrlMultiHint': '多选后整组排序',

  // 主题菜单
  'theme.tip': '主题：{m}（点击切换）',
  'theme.light': '明亮',
  'theme.dark': '暗黑',
  'theme.system': '跟随系统',

  // 分隔条
  'split.title': '拖动调整宽度',

  // toast / 操作反馈
  'toast.initFail': '初始化失败：{msg}',
  'toast.onlyJson': '只支持 .json 文件',
  'toast.closedOne': '已关闭标签「{t}」',
  'toast.closedMany': '已关闭 {n} 个标签',
  'toast.closeFail': '关闭失败：{msg}',
  'toast.internalPage': '浏览器内部页面无法通过插件打开',
  'toast.openFail': '打开失败：{msg}',
  'toast.reorderFail': '排序失败，已回滚：{msg}',
  'toast.renameFail': '重命名失败：{msg}',
  'toast.urlFail': '修改网址失败：{msg}',
  'toast.folderCreated': '已新建文件夹，输入名称后点击别处确认',
  'toast.folderCreateFail': '新建文件夹失败：{msg}',
  'toast.deleted': '已删除 {label}',
  'toast.delOne': '「{t}」',
  'toast.delMany': '{n} 个书签',
  'toast.undoAction': '撤回  Ctrl+Z',
  'toast.delFail': '删除失败：{msg}',
  'toast.folderConfirm': '「{t}」下有 {n} 个子文件夹、{m} 个书签，删除后无法撤回',
  'toast.confirmDel': '确认删除',
  'toast.folderDeleted': '已删除文件夹「{t}」',
  'toast.folderDelFail': '删除文件夹失败：{msg}',
  'toast.noUndo': '没有可撤回的删除操作',
  'toast.undone': '已撤回，恢复 {n} 个书签',
  'toast.undoFail': '撤回失败：{msg}',
  'toast.selfFolder': '不能把文件夹移进它自己或它的子文件夹',
  'toast.moved': '已移至「{t}」',
  'toast.moveFail': '移动失败，已回滚：{msg}',
  'toast.saveFail': '保存书签失败：{msg}',
  'toast.addedTabs': '已把 {n} 个标签加入「{t}」',

  // 新建文件夹的默认名（会成为真实书签名）
  'bm.newFolder': '新建文件夹',

  // 语言切换按钮：故意「互文」——zh 里写英文目标、en 里写中文目标
  'lang.tip': 'Switch to English',
} as const;

export type I18nKey = keyof typeof zh;

const en: Record<I18nKey, string> = {
  'common.more': 'More actions',
  'common.cancel': 'Cancel',
  'common.selectAll': 'Select all',
  'common.new': 'New',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.pick': 'Select',
  'common.close': 'Close (Esc)',

  'tabs.title': 'Open Tabs',
  'tabs.selected': '{n} selected',
  'tabs.multiHint': 'Multi-select · click cards to select, they won\u2019t open',
  'tabs.clearSel': 'Clear selection',
  'tabs.closeSel': 'Close selected',
  'tabs.hint': 'Drag to reorder · drag right to bookmark',
  'tabs.helpTitle': 'Shortcuts & actions (Esc to close)',
  'tabs.emptyT': 'No open tabs',
  'tabs.emptyS': 'Cards will show up here as you open pages',
  'tab.close': 'Close tab',

  'tree.title': 'Bookmark Folders',
  'tree.empty': 'Bookmark folders not loaded yet',
  'tree.rowMore': 'More actions for "{t}"',
  'tree.rename': 'Rename',
  'tree.newSub': 'New subfolder',
  'tree.delFolder': 'Delete folder',
  'group.account': 'Account bookmarks',
  'group.device': 'This device\u2019s bookmarks',

  'bm.fallbackTitle': 'Bookmarks',
  'bm.multiHint': 'Multi-select · click cards to select',
  'bm.searchTitle': 'Search all bookmarks (Ctrl+K)',
  'bm.delSel': 'Delete selected · {n}',
  'bm.import': 'Import JSON',
  'bm.emptyT': 'This folder is empty',
  'bm.emptyS': 'Click "New" at the top right, or drag tabs over from the left',
  'card.namePh': 'Enter a name',
  'card.urlPh': 'Enter a URL',
  'card.edit': 'Edit name & URL',
  'card.del': 'Delete (Ctrl+Z to undo)',

  'quick.addTitle': 'Add quick site',
  'quick.add': 'Add',
  'quick.namePh': 'Name, e.g. GitHub',
  'quick.urlPh': 'URL, e.g. github.com',
  'quick.save': 'Save',
  'quick.addBtn': 'Add',
  'quick.needBoth': 'Both name and URL are required',
  'quick.badUrl': 'Invalid URL, e.g. github.com',
  'quick.deleted': 'Removed quick site "{t}"',
  'quick.dropHint': 'Drop to add to quick sites',
  'quick.added': 'Added {n} quick site(s)',
  'quick.addedSkip': 'Added {n}, skipped {s} (duplicate or no usable URL)',
  'quick.addNone': 'Nothing to add: already in quick sites, or no usable URL',

  'imp.title': 'Bulk import bookmarks',
  'imp.descA': 'Supports ',
  'imp.descB':
    ' and the full JSON tree exported by Chrome\u2019s bookmark manager. Import target:',
  'imp.paste': 'Paste JSON',
  'imp.file': 'Drop file',
  'imp.pickJson': 'Please choose a .json file',
  'imp.noItems': 'No valid bookmarks parsed',
  'imp.fail': 'Import failed — check the JSON content',
  'imp.done': 'Imported {n} bookmarks to "{f}"',
  'imp.tipCount': '{n} items ready to import',
  'imp.tipSkip': ', {n} invalid skipped',
  'imp.chosen': 'Selected {f}',
  'imp.tipIdle': 'Paste JSON or drop a .json file',
  'imp.dropA': 'Drop a ',
  'imp.dropB': ' file here',
  'imp.dropOr': 'or click to choose a file',
  'imp.rechoose': 'Drop or click to choose another file',
  'imp.sample': 'Fill sample',
  'imp.import': 'Import',
  'imp.currentFolder': 'current folder',
  'imp.empty': 'Content is empty — paste JSON first',
  'imp.badJson': 'JSON parse failed: {msg}',
  'imp.noValid': 'No valid bookmarks parsed (name / url fields required)',

  'search.ph': 'Search all bookmarks: name, domain, folder…',
  'search.clear': 'Clear input',
  'search.hintIdle': 'Type to search across {n} bookmarks (account & this device)',
  'search.folder': 'Folder',
  'search.untitled': '(Untitled)',
  'search.noHitA': 'No bookmarks matching "',
  'search.noHitB': '"',
  'search.keys': '\u2191\u2193 navigate \u00b7 Enter open \u00b7 Esc close',
  'search.results': '{n} results',
  'search.count': '{n} bookmarks',

  'help.title': 'Shortcuts & actions',
  'help.undo': 'Undo delete',
  'help.undoHint': 'bookmarks',
  'help.multi': 'Multi / range select',
  'help.multiHint': 'cards',
  'help.enterMulti': 'Click any card to enter multi-select',
  'help.enterMultiHint': 'click to select',
  'help.batchDel': 'Bulk-delete selected bookmarks',
  'help.batchDelHint': 'Delete',
  'help.esc': 'Clear selection / close dialogs',
  'help.search': 'Search all bookmarks',
  'help.searchHint': 'or the magnifier at top right',
  'help.dragToBm': 'Drag tabs to the right',
  'help.dragToBmHint': 'to bookmark',
  'help.dragCards': 'Drag cards / folders',
  'help.dragCardsHint': 'reorder \u00b7 file into folders',
  'help.ctrlMulti': 'Ctrl-click tab cards',
  'help.ctrlMultiHint': 'reorder as a group',

  'theme.tip': 'Theme: {m} (click to switch)',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',

  'split.title': 'Drag to resize',

  'toast.initFail': 'Initialization failed: {msg}',
  'toast.onlyJson': 'Only .json files are supported',
  'toast.closedOne': 'Closed tab "{t}"',
  'toast.closedMany': 'Closed {n} tabs',
  'toast.closeFail': 'Failed to close: {msg}',
  'toast.internalPage': 'Browser internal pages can\u2019t be opened by the extension',
  'toast.openFail': 'Failed to open: {msg}',
  'toast.reorderFail': 'Reorder failed, rolled back: {msg}',
  'toast.renameFail': 'Rename failed: {msg}',
  'toast.urlFail': 'Failed to update URL: {msg}',
  'toast.folderCreated': 'Folder created — type a name, click elsewhere to confirm',
  'toast.folderCreateFail': 'Failed to create folder: {msg}',
  'toast.deleted': 'Deleted {label}',
  'toast.delOne': '"{t}"',
  'toast.delMany': '{n} bookmarks',
  'toast.undoAction': 'Undo  Ctrl+Z',
  'toast.delFail': 'Failed to delete: {msg}',
  'toast.folderConfirm':
    '"{t}" contains {n} subfolders and {m} bookmarks — deletion can\u2019t be undone',
  'toast.confirmDel': 'Confirm delete',
  'toast.folderDeleted': 'Deleted folder "{t}"',
  'toast.folderDelFail': 'Failed to delete folder: {msg}',
  'toast.noUndo': 'Nothing to undo',
  'toast.undone': 'Undone — restored {n} bookmarks',
  'toast.undoFail': 'Undo failed: {msg}',
  'toast.selfFolder': 'A folder can\u2019t be moved into itself or its subfolders',
  'toast.moved': 'Moved to "{t}"',
  'toast.moveFail': 'Move failed, rolled back: {msg}',
  'toast.saveFail': 'Failed to save bookmark: {msg}',
  'toast.addedTabs': 'Added {n} tabs to "{t}"',

  'bm.newFolder': 'New folder',

  'lang.tip': '切换到中文',
};

const DICT: Record<Lang, Record<I18nKey, string>> = { zh, en };

let current: Lang = 'zh';

export function isLang(v: unknown): v is Lang {
  return v === 'zh' || v === 'en';
}

export function normalizeLang(v: unknown): Lang {
  return isLang(v) ? v : 'zh';
}

/** 读镜像（localStorage 不可用时按 zh 处理） */
export function readMirrorLang(): Lang {
  try {
    return normalizeLang(localStorage.getItem(LANG_MIRROR_KEY));
  } catch {
    return 'zh';
  }
}

/** 写模块级当前语言 + 刷新 localStorage 镜像（真源由 uiSlice 落 chrome.storage） */
export function setLangMirror(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(LANG_MIRROR_KEY, lang);
  } catch {
    /* 无 localStorage / 配额满，忽略 */
  }
}

// 模块加载即取镜像，保证首帧（chrome.storage 还没回来）就是用户上次选的语言
current = readMirrorLang();

export function getLang(): Lang {
  return current;
}

/** 取文案；{name} 形式的占位符用 params 替换 */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  let s = DICT[current][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}
