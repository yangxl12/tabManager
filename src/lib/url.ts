/** URL 归一化 / 域名提取（纯函数，可单测） */

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

/** chrome://、edge://、about: 等浏览器内部页，tabs.create 无法打开 */
const INTERNAL_RE = /^(chrome|edge|about|brave|opera|vivaldi|view-source|devtools|chrome-extension):/i;

export function isInternalUrl(url: string): boolean {
  return !url || INTERNAL_RE.test(url.trim());
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

/** 打开用：非法时返回 ''，调用方据此提示 */
export function toOpenableUrl(value: string): string {
  const n = normalizeUrl(value);
  if (!n || isInternalUrl(n)) return n;
  return n;
}

/** 判断 a 是否等于或位于 b 之下（用于文件夹不可拖入自身/后代） */
export function sameHost(a: string, b: string): boolean {
  return hostOf(a) === hostOf(b);
}
