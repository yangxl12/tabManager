import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'TabNest 标签巢',
  description: '新标签页：已打开标签与真实书签的卡片化管理，支持拖拽排序、跨面板拖拽与批量操作。',
  version: '0.1.0',
  // 与 vite build.target 保持一致：_favicon API 需 Chrome 102+，此处取更保守的 114
  minimum_chrome_version: '114',
  default_locale: undefined,
  permissions: ['tabs', 'bookmarks', 'storage', 'favicon'],
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'TabNest 标签巢',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
});
