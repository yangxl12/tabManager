/**
 * 便签正文的 HTML 清洗 —— 纯逻辑，不 import chrome / React（正则实现，不依赖 DOM，可在 node 下单测）。
 *
 * 只用于「粘贴」这一个入口：便签只支持标题 / 粗体 / 删除线 / 列表，
 * 从网页、代码编辑器、终端复制过来的 HTML 往往带内联样式 ——
 * `background-color: rgb(0, 0, 0)` 在明亮模式下就是一块黑底，`color` 写死还会在换主题后撞色。
 * 所以这里统一剥掉所有属性 + 丢掉脚本类标签，只留下结构壳。
 */

/** 便签认的结构标签：其余标签一律「拆壳留字」 */
const ALLOWED_TAGS = new Set(['h1', 'h2', 'b', 'strong', 's', 'strike', 'u', 'em', 'i', 'ul', 'ol', 'li', 'p', 'div', 'br', 'a']);

/** 连内容一起丢掉：这些标签里的「文字」不是正文，留下来只会污染便签 */
const DROPPED_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|head|title|textarea|noscript)\b[\s\S]*?<\/\1\s*>/gi;

/** 自闭合 / 无内容的丢弃 */
const DROPPED_SELF = /<(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi;

/** 标签匹配：属性段允许引号里出现 '>'（`<a title="a>b">` 也能整段吃掉） */
const TAG = /<\/?([a-z][a-z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/gi;

function safeHref(attrs: string): string {
  const m = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  const url = (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
  return /^(https?:|mailto:)/i.test(url) ? url : '';
}

export function sanitizePastedHtml(html: string): string {
  return html
    .replace(DROPPED_WITH_CONTENT, '')
    .replace(DROPPED_SELF, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(TAG, (raw, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return ''; // 不认识的壳：脱掉标签，里面的文字照旧留下
      if (tag === 'br') return '<br>';
      if (raw.startsWith('</')) return `</${tag}>`;
      if (tag === 'a') {
        const href = safeHref(rawAttrs);
        return href ? `<a href="${href}">` : '<a>';
      }
      return `<${tag}>`;
    })
    .trim();
}
