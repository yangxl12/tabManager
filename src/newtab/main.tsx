import { createRoot } from 'react-dom/client';
import '../styles/theme.css';
import { hasChromeApi } from '@/services/storage';
import { collapseDuplicateNewTab } from '@/services/chromeTabs';
import { App } from '../components/App';

async function boot() {
  // 普通浏览器里跑 dev server 时，用内存版 chrome.* 兜底，方便本地预览与自测
  if (import.meta.env.DEV && !hasChromeApi()) {
    const { installFakeChrome } = await import('@/devtools/fakeChrome');
    installFakeChrome();
  } else if (await collapseDuplicateNewTab()) {
    // 真实 Chrome：同窗口已开着 TabNest 页面时，焦点已经切过去了，自己不渲染
    return;
  }
  const el = document.getElementById('root');
  if (el) createRoot(el).render(<App />);
}

void boot();
