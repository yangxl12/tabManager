/**
 * 把 release 里的扩展真实加载进 Chrome（走 CDP Extensions.loadUnpacked），
 * 验证「打包产物」在真浏览器里：能装、新标签页覆盖生效、重复开新标签页会去重、
 * chrome.* API 可用、无启动报错，并截图存档。
 *
 * 用法:
 *   node devtools/verify-release.mjs                      # 自动取 release/ 下最新版本
 *   node devtools/verify-release.mjs <扩展目录绝对路径>
 *   node devtools/verify-release.mjs --headful            # 有头模式（窗口挪到屏幕外）
 *
 * 环境变量: SHOT_OUT 截图输出路径；CHROME_BIN 指定 Chrome 可执行文件。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;

/** 没传路径时，挑 release/ 下版本号最大的解压目录 */
function pickLatestRelease() {
  const dir = resolve(process.cwd(), 'release');
  if (!existsSync(dir)) throw new Error('release/ 不存在，先跑 npm run package');
  const cands = readdirSync(dir)
    .filter((n) => !n.endsWith('.zip') && statSync(join(dir, n)).isDirectory())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!cands.length) throw new Error('release/ 下没有解压目录，先跑 npm run package');
  return join(dir, cands[cands.length - 1]);
}

const argv = process.argv.slice(2);
const extPath = resolve(argv.find((a) => !a.startsWith('--')) || pickLatestRelease());
const headful = argv.includes('--headful');

if (!existsSync(join(extPath, 'manifest.json'))) {
  console.error(`[x] 目录里没有 manifest.json，不是有效扩展：${extPath}`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(extPath, 'manifest.json'), 'utf8'));
const newtabRel = manifest.chrome_url_overrides?.newtab;

const profile = mkdtempSync(join(tmpdir(), 'tabnest-cdp-'));
console.log('待验证扩展:', extPath);
console.log('清单版本:', manifest.version, '| 新标签页入口:', newtabRel || '(未配置)');

const args = [
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--enable-unsafe-extension-debugging',
  // 注意：不要加 --disable-extensions-except 限定路径。CDP 的 loadUnpacked 会
  // 重新规范化路径，与命令行白名单对不上，扩展会被自己挡住报 ERR_BLOCKED_BY_CLIENT。
  ...(headful ? ['--window-position=-32000,-32000', '--window-size=1500,900'] : ['--headless=new']),
  'about:blank',
];
const chrome = spawn(CHROME, args, { stdio: 'ignore', windowsHide: true });

let id = 0;
const pending = new Map();
const errs = [];

function send(ws, method, params = {}, sessionId) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => {
    pending.set(msgId, { res, rej });
    setTimeout(() => { if (pending.delete(msgId)) rej(new Error(`超时: ${method}`)); }, 15000);
  });
}

async function waitForCdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return r.json();
    } catch { /* 尚未就绪 */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('CDP 未就绪，Chrome 可能启动失败');
}

/** 打开一个 URL 并返回渲染探针结果 */
async function probePage(ws, url, waitMs = 3000) {
  const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await send(ws, 'Runtime.enable', {}, sessionId);
  await send(ws, 'Page.enable', {}, sessionId);
  // 固定桌面视口，否则 headless 默认窗口很窄，布局会退化
  await send(ws, 'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send(ws, 'Page.navigate', { url }, sessionId);
  await new Promise((r) => setTimeout(r, waitMs));

  const expr = `(() => {
    const root = document.querySelector('#root');
    let api = {};
    try {
      api = {
        有chrome对象: typeof chrome !== 'undefined',
        tabs可用: typeof chrome?.tabs?.query === 'function',
        bookmarks可用: typeof chrome?.bookmarks?.getTree === 'function',
      };
    } catch (e) { api = { 取值异常: String(e) }; }
    return JSON.stringify({
      标题: document.title,
      实际地址: location.href.slice(0, 55),
      是否错误页: location.href.startsWith('chrome-error://'),
      root子节点数: root ? root.children.length : -1,
      可见文字长度: document.body.innerText.trim().length,
      可见文字开头: document.body.innerText.trim().slice(0, 90).replace(/\\n/g, ' | '),
      可拖拽卡片数: document.querySelectorAll('[draggable="true"]').length,
      chromeAPI: api,
    }, null, 2);
  })()`;
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  return { sessionId, targetId, result: JSON.parse(r.result.value) };
}

let failed = false;

async function main() {
  const ver = await waitForCdp();
  console.log('浏览器:', ver.Browser);

  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws 连接失败')); });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push('[异常] ' + m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errs.push('[console.error] ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };

  const { id: extId } = await send(ws, 'Extensions.loadUnpacked', { path: extPath });
  console.log('已加载扩展 ID:', extId, '\n');

  // ① 直接访问扩展内页面
  console.log('=== ① 扩展新标签页文件 ===');
  const direct = await probePage(ws, `chrome-extension://${extId}/${newtabRel}`);
  console.log(JSON.stringify(direct.result, null, 2));
  if (direct.result.是否错误页 || direct.result.root子节点数 < 1) failed = true;
  // 必须先关掉它：② 会再开一个 TabNest 页面，而新标签页去重会让「后开的那个」自动让位
  await send(ws, 'Target.closeTarget', { targetId: direct.targetId });

  // ② 打开 chrome://newtab/ 验证 chrome_url_overrides 是否真的接管
  console.log('\n=== ② chrome://newtab/ 覆盖 ===');
  const ntp = await probePage(ws, 'chrome://newtab/');
  console.log(JSON.stringify(ntp.result, null, 2));
  if (ntp.result.是否错误页 || ntp.result.可见文字长度 < 50) failed = true;

  // ③ 新标签页去重：同窗口再开一个 → 应该自动让位，焦点回到已打开的那个
  console.log('\n=== ③ 重复新标签页去重 ===');
  const dedupe = await send(
    ws,
    'Runtime.evaluate',
    {
      expression: `(async () => {
        // 注意：点「+」开出来的标签，tab.url 是虚拟地址 chrome://newtab/，
        // 不是扩展地址，别只按扩展 URL 判定
        const norm = (u) => String(u || '').split(/[?#]/)[0].replace(/\\/$/, '');
        const isNtp = (u) =>
          norm(u) === 'chrome://newtab' ||
          norm(u).startsWith('chrome-extension://' + chrome.runtime.id + '/');
        const mine = await chrome.tabs.getCurrent();
        const before = await chrome.tabs.query({ windowId: mine.windowId });
        await chrome.tabs.create({ url: location.href });   // 等价于点标签栏的「+」
        await new Promise((r) => setTimeout(r, 1800));
        const after = await chrome.tabs.query({ windowId: mine.windowId });
        const active = after.find((t) => t.active);
        return JSON.stringify({
          标签总数: before.length + ' -> ' + after.length,
          剩余新标签页数: after.filter((t) => isNtp(t.url)).length,
          焦点回到已打开页面: !!active && active.id === mine.id,
        });
      })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    ntp.sessionId,
  );
  console.log(dedupe.result.value);
  const dd = JSON.parse(dedupe.result.value);
  if (dd.标签总数.split(' -> ')[0] !== dd.标签总数.split(' -> ')[1]) failed = true;
  if (dd.剩余新标签页数 !== 1 || !dd.焦点回到已打开页面) failed = true;

  // ④ 运行期报错
  console.log('\n=== ④ 运行期报错 ===');
  console.log(errs.length ? errs.join('\n') : '无 ✓');
  if (errs.length) failed = true;

  // 截图存档
  const shotPath = process.env.SHOT_OUT || join(tmpdir(), 'tabnest-newtab.png');
  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' }, ntp.sessionId);
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('\n截图已存:', shotPath);

  await send(ws, 'Extensions.uninstall', { id: extId }).catch(() => {});
  ws.close();

  console.log(failed ? '\n[x] 验证未通过' : '\n[ok] 验证通过：打包产物可在真实浏览器中运行');
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('[x]', e.message); process.exitCode = 1; })
  .finally(() => { chrome.kill(); setTimeout(() => process.exit(process.exitCode || 0), 300); });
