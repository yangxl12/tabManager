/** 精选入口。ID 固定，便于升级时识别分类；站点只在首次升级时加入一次。 */
export const CURATED_QUICK_GROUPS = [
  { id: 'featured-ai', name: 'AI 助手', sites: [
    { name: 'ChatGPT', url: 'https://chatgpt.com/' },
    { name: 'Claude', url: 'https://claude.ai/' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai/' },
    { name: 'DeepSeek', url: 'https://chat.deepseek.com/' },
    { name: 'Kimi', url: 'https://www.kimi.com/' },
    { name: '豆包', url: 'https://www.doubao.com/' },
  ] },
  { id: 'featured-design', name: '设计创作', sites: [
    { name: 'Figma', url: 'https://www.figma.com/' },
    { name: 'Canva 可画', url: 'https://www.canva.cn/' },
    { name: '即时设计', url: 'https://js.design/' },
    { name: 'MasterGo', url: 'https://mastergo.com/' },
    { name: 'Adobe Express', url: 'https://www.adobe.com/express/' },
  ] },
  { id: 'featured-dev', name: '开发工具', sites: [
    { name: 'GitHub', url: 'https://github.com/' },
    { name: 'Vercel', url: 'https://vercel.com/' },
    { name: 'StackBlitz', url: 'https://stackblitz.com/' },
    { name: 'Gitee', url: 'https://gitee.com/' },
    { name: '稀土掘金', url: 'https://juejin.cn/' },
    { name: 'MDN', url: 'https://developer.mozilla.org/' },
  ] },
  { id: 'featured-work', name: '效率协作', sites: [
    { name: 'Notion', url: 'https://www.notion.com/' },
    { name: '飞书', url: 'https://www.feishu.cn/' },
    { name: '语雀', url: 'https://www.yuque.com/' },
    { name: 'Linear', url: 'https://linear.app/' },
    { name: '金山文档', url: 'https://www.kdocs.cn/' },
  ] },
  { id: 'featured-learn', name: '学习成长', sites: [
    { name: 'Coursera', url: 'https://www.coursera.org/' },
    { name: '可汗学院', url: 'https://www.khanacademy.org/' },
    { name: '中国大学 MOOC', url: 'https://www.icourse163.org/' },
    { name: '学堂在线', url: 'https://www.xuetangx.com/' },
    { name: 'freeCodeCamp', url: 'https://www.freecodecamp.org/' },
  ] },
  { id: 'featured-assets', name: '创意素材', sites: [
    { name: 'Unsplash', url: 'https://unsplash.com/' },
    { name: 'Pexels', url: 'https://www.pexels.com/' },
    { name: 'Pixabay', url: 'https://pixabay.com/' },
    { name: '站酷', url: 'https://www.zcool.com.cn/' },
    { name: 'Iconfont', url: 'https://www.iconfont.cn/' },
  ] },
  { id: 'featured-news', name: '精选资讯', sites: [
    { name: '少数派', url: 'https://sspai.com/' },
    { name: '36氪', url: 'https://36kr.com/' },
    { name: 'Hacker News', url: 'https://news.ycombinator.com/' },
    { name: '知乎', url: 'https://www.zhihu.com/' },
    { name: 'Product Hunt', url: 'https://www.producthunt.com/' },
  ] },
] as const;

export const CURATED_QUICK_GROUP_IDS = new Set<string>(CURATED_QUICK_GROUPS.map((group) => group.id));
