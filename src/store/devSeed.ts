/**
 * 仅在「非扩展环境 + dev」下使用的演示数据，方便在普通浏览器里调 UI。
 * 生产构建中该分支会被 `import.meta.env.DEV` 静态消除。
 *
 * 书签树刻意模拟 Chrome 新版的双存储结构：账号（同步）一套 + 此设备（本地）一套，
 * 顶层特殊文件夹靠 folderType / syncing 区分，名字完全一样 —— 正是要验证的场景。
 */
import type { RawBmNode, TabItem } from '@/lib/types';

export const DEV_TABS: (Omit<TabItem, 'windowId' | 'active' | 'pinned'> & { pinned?: boolean })[] = [
  // 前两个固定标签：Chrome 里 pinned 一定排在最前，这里保持同样的形态
  { id: 101, title: 'GitHub · 构建、发布与协作，一站搞定', url: 'https://github.com', index: 0, pinned: true },
  { id: 102, title: '掘金 - 代码不止，掘金不停', url: 'https://juejin.cn', index: 1, pinned: true },
  { id: 103, title: 'Vite | 下一代的前端构建工具', url: 'https://vitejs.dev', index: 2 },
  { id: 104, title: 'MDN Web Docs · 面向开发者的 Web 技术权威文档', url: 'https://developer.mozilla.org', index: 3 },
  { id: 105, title: 'Dribbble - 发现全球顶尖设计师的灵感社区', url: 'https://dribbble.com', index: 4 },
  { id: 106, title: '腾讯文档 - 在线文档、表格、幻灯片，多人协作', url: 'https://docs.qq.com', index: 5 },
  { id: 107, title: 'ChatGPT', url: 'https://chat.openai.com', index: 6 },
  { id: 108, title: '知乎 - 有问题，就会有答案', url: 'https://www.zhihu.com', index: 7 },
  { id: 109, title: 'Stack Overflow - Where Developers Learn & Share', url: 'https://stackoverflow.com', index: 8 },
  { id: 110, title: 'bilibili - 哔哩哔哩，干杯 (゜-゜)つロ', url: 'https://www.bilibili.com', index: 9 },
  { id: 111, title: '少数派 - 高效工作，品质生活', url: 'https://sspai.com', index: 10 },
  { id: 112, title: 'Figma: 协作式界面设计工具', url: 'https://www.figma.com', index: 11 },
  // 内部页：没有 favicon，走字母 tile 兜底（也是 isInternalUrl 的分支）
  { id: 113, title: '扩展程序', url: 'chrome://extensions', index: 12 },
  // 超长标题：用来盯截断效果，别让它把卡片撑破
  {
    id: 114,
    title:
      '这是一条刻意写得很长很长的标签标题，用来验证标题截断与省略号是否正常工作，顺便看看拖拽时卡片宽度会不会塌掉',
    url: 'https://example.com/a/very/long/path/that/keeps/going/and/going?with=query&and=params',
    index: 13,
  },
];

const mk = (id: string, title: string, url: string): RawBmNode => ({ id, title, url });

export const DEV_TREE: RawBmNode[] = [
  {
    id: '0',
    title: '',
    children: [
      /* ---------- 账号书签（同步到 Google 账号） ---------- */
      {
        id: '1',
        title: '收藏夹栏',
        folderType: 'bookmarks-bar',
        syncing: true,
        children: [
          mk('100', 'GitHub', 'https://github.com'),
          mk('101', '掘金', 'https://juejin.cn'),
          mk('102', '知乎', 'https://www.zhihu.com'),
          mk('103', '哔哩哔哩', 'https://www.bilibili.com'),
          mk('104', '少数派', 'https://sspai.com'),
          mk('105', '微博', 'https://weibo.com'),
          mk('106', '豆瓣', 'https://www.douban.com'),
          mk('107', 'V2EX', 'https://www.v2ex.com'),
          // 超长标题 + 带 query 的长 URL：压一下卡片截断与域名解析
          mk(
            '108',
            'Chrome 扩展 Manifest V3 迁移与性能优化实践指南（2026 修订版）· 含 Service Worker 生命周期与离线缓存章节',
            'https://developer.chrome.com/docs/extensions/develop/migrate?hl=zh-cn&utm_source=tabnest',
          ),
          // 空文件夹：用来验证空态提示，别让它渲染成空白
          { id: '13', title: '稍后读（空）', children: [] },
          {
            id: '11',
            title: '工作',
            children: [
              mk('110', 'Figma', 'https://www.figma.com'),
              mk('111', 'Notion', 'https://www.notion.so'),
              mk('112', '语雀', 'https://www.yuque.com'),
              {
                id: '12',
                title: '常用工具',
                children: [
                  mk('120', 'MDN', 'https://developer.mozilla.org'),
                  mk('121', 'Can I use', 'https://caniuse.com'),
                  mk('122', 'Regex101', 'https://regex101.com'),
                ],
              },
            ],
          },
        ],
      },
      {
        id: '2',
        title: '其他书签',
        folderType: 'other',
        syncing: true,
        children: [
          mk('200', 'Coursera', 'https://www.coursera.org'),
          mk('201', '阮一峰的网络日志', 'https://www.ruanyifeng.com/blog'),
          mk('202', '菜鸟教程', 'https://www.runoob.com'),
        ],
      },

      /* ---------- 此设备书签（本地，没上传账号） ---------- */
      {
        id: '3',
        title: '收藏夹栏',
        folderType: 'bookmarks-bar',
        syncing: false,
        children: [
          mk('300', '本地调试服务', 'http://localhost:8173'),
          mk('301', '公司内网', 'http://192.168.1.10'),
        ],
      },
      {
        id: '4',
        title: '其他书签',
        folderType: 'other',
        syncing: false,
        children: [
          {
            id: '41',
            title: '临时收集',
            children: [mk('400', '待读：Chrome 扩展 MV3 迁移指南', 'https://developer.chrome.com/docs/extensions')],
          },
        ],
      },
    ],
  },
];
