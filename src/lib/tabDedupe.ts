/**
 * 新标签页去重（纯逻辑，不碰 chrome.*）。
 *
 * 背景：Chrome 没有提供拦截标签栏「+」按钮的 API，所以只能在页面被加载之后自检 ——
 * 「同窗口里还有没有别的 TabNest 页面，有就让位」。为免多个页面互相让位导致
 * 双双关闭，留下谁必须由数据本身决定：id 最小（最老）的那个留下。
 */

/** 判定所需的最小标签信息 */
export interface DedupeTab {
  id: number;
  url: string;
  windowId: number;
}

/** Chrome 给新标签页的虚拟地址（归一化后）。点「+」/ Ctrl+T 开出来的标签 url 就是它 */
export const NEWTAB_VIRTUAL_URL = 'chrome://newtab';

/**
 * 页面地址归一：去掉 ?query、#hash 与末尾斜杠。
 * （末尾斜杠要去 —— 虚拟地址带斜杠：`chrome://newtab/`）
 */
export function normalizePageUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const cut = raw.search(/[?#]/);
  const body = cut === -1 ? raw : raw.slice(0, cut);
  return body.length > 1 && body.endsWith('/') ? body.slice(0, -1) : body;
}

/**
 * 某个地址是否指向「TabNest 新标签页」。
 *
 * 两个都要认，只认一个一定漏：
 * - `chrome://newtab/`：点标签栏「+」/ Ctrl+T 开出来的标签，Chrome **保留虚拟地址**，
 *   `tab.url` 报的是 chrome://newtab/ 而不是扩展地址（实测）。按扩展 URL 前缀判定全漏。
 * - 与自身地址之一相同：显式用扩展地址打开、或 crxjs dev 下挂在 dev server 上时的地址。
 *
 * 只认「新标签页入口」这一个地址、不用整段扩展前缀：以后加了设置页之类的，
 * 不该被当成重复的新标签页关掉。
 */
export function isSameNewTabUrl(url: string, selfUrls: string[]): boolean {
  const u = normalizePageUrl(url);
  if (!u) return false;
  if (u === NEWTAB_VIRTUAL_URL) return true;
  return selfUrls.some((s) => normalizePageUrl(s) === u);
}

/**
 * 决定「我留下还是让位」。
 * 返回要跳过去的标签 id；返回 null 表示自己就是最老的那个，正常渲染。
 *
 * 必须只跟「比我老的」（id 更小）比：若取剩下标签里的最小 id，最老的那个页面
 * 也会让位给比它年轻的，多个页面同时自检就会互相关闭，最后一个都不剩。
 */
export function pickNewTabSurvivor(
  tabs: DedupeTab[],
  self: { id: number; windowId: number },
  selfUrls: string[],
): number | null {
  const older = tabs
    .filter((t) => t.windowId === self.windowId && t.id < self.id && isSameNewTabUrl(t.url, selfUrls))
    .map((t) => t.id)
    .sort((a, b) => a - b);
  return older.length ? older[0] : null;
}
