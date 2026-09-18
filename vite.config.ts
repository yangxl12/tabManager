import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/** dev server 上扩展真实页面的地址（crxjs 不会改写它，运行时用假 chrome 兜底） */
const NEWTAB_DEV_PATH = '/src/newtab/index.html';

/**
 * 只在本机 dev 时提供自动化自检页（devtools/*.html），不参与打包，
 * 避免被 crxjs 当成扩展入口处理。
 *
 * 顺带把根路径重定向到扩展真实页面：直接开 http://localhost:8173/ 拿到的是项目根的
 * index.html（最初的单文件 demo），它内联的 <script> 会被 crxjs 抽成空壳 —— 只有静态
 * 外壳、卡片全空，看起来就像「扩展没数据」，其实脚本压根没执行。
 */
function devPages(): Plugin {
  return {
    name: 'tabnest-dev-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url === '/' || url === '/index.html') {
          res.writeHead(302, { Location: NEWTAB_DEV_PATH });
          res.end();
          return;
        }
        if (url !== '/_probe.html' && url !== '/_zoom.html') return next();
        const file = path.join(rootDir, 'devtools', url.slice(1));
        if (!fs.existsSync(file)) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fs.readFileSync(file, 'utf8'));
      });

      // 启动后在 vite 默认输出下面再补一行真实预览地址，省得每次去翻文档
      return () => {
        server.httpServer?.once('listening', () => {
          const addr = server.httpServer?.address();
          const port = typeof addr === 'object' && addr ? addr.port : 8173;
          process.stdout.write(
            `\n  \x1b[32m➜\x1b[0m  TabNest 预览页（带测试数据）：\x1b[36m http://localhost:${port}${NEWTAB_DEV_PATH} \x1b[0m\n` +
              `  \x1b[2m根路径会自动跳过去；根 index.html 是原始 demo，需直接双击文件打开\x1b[0m\n\n`,
          );
        });
      };
    },
  };
}

export default defineConfig({
  // devPages 必须排在 crxjs 前面：后者也会接住 `/`（它把根路径当成 html 入口处理，
  // 直接返回 200 空壳），排在后面的话重定向中间件根本轮不到执行
  plugins: [devPages(), react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8173,
    strictPort: true,
    // hmr.port 必须与 server.port 一致，否则客户端 websocket 会连错端口刷报错
    hmr: { port: 8173 },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'chrome114',
    rollupOptions: {
      input: {
        newtab: 'src/newtab/index.html',
      },
    },
  },
});
