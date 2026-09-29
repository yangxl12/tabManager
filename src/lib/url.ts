/** URL 归一化 / 域名提取（纯函数，可单测） */

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

/** chrome://、edge://、about: 等浏览器内部页：拿不到 favicon，内容脚本也注入不进去 */
const INTERNAL_RE = /^(chrome|edge|about|brave|opera|vivaldi|view-source|devtools|chrome-extension):/i;

/**
 * 内部页里连「新开标签」都打不开的一小撮：浏览器不给扩展导航这些协议。
 * 其余内部页（chrome://extensions、edge://settings、about:blank…）用 chrome.tabs.create 是能打开的，
 * 别再按 isInternalUrl 一刀切拦掉 —— 那会把「扩展管理页」这种常用地址挡在快捷访问外面。
 */
const UNOPENABLE_RE = /^(devtools|chrome-untrusted|chrome-search|chrome-native):/i;

export function isInternalUrl(url: string): boolean {
  return !url || INTERNAL_RE.test(url.trim());
}

/** 能否用新开标签打开：普通网页与浏览器自家页面（chrome:// / edge:// …）都算 */
export function isOpenableUrl(url: string): boolean {
  const v = String(url || '').trim();
  return !!v && !UNOPENABLE_RE.test(v);
}

/** 取域名（去掉 www.），解析失败时退化为字符串裁剪 */
export function hostOf(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw
      .replace(SCHEME_RE, '')
      .replace(/^www\./, '')
      .split(/[/?#]/)[0];
  }
}

/**
 * 展示 / 表单回填用：内部页给完整地址（hostOf 会把 chrome://extensions 裁成 'extensions'，
 * 回填后一保存就变成 https://extensions 了），普通网址仍只给域名。
 */
export function displayUrlOf(url: string): string {
  const v = String(url || '').trim();
  if (!v) return '';
  return isInternalUrl(v) ? v : (hostOf(v) || v);
}

/** 无协议自动补 https://；非法返回 '' */
export function normalizeUrl(value: string): string {
  let v = String(value || '').trim();
  if (!v) return '';
  if (INTERNAL_RE.test(v)) return v;
  if (!SCHEME_RE.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname) return '';
    return v;
  } catch {
    return '';
  }
}

/** 同一域名（用于文件间同址判断） */
export function sameHost(a: string, b: string): boolean {
  return hostOf(a) === hostOf(b);
}
