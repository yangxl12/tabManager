/**
 * 无头 Chrome 小工具（CDP，零依赖）—— 跑探针 / 取 DOM / 截图都从这里走。
 *
 * 为什么不用命令行 `--dump-dom`：Chrome 137 起它对任何 http 地址都是 exit 21 + 0 字节输出
 * （只剩 about:blank 这类内部页还能吐 DOM），跑 `devtools/_probe.html` 会得到空文件 →
 * grep 到的是上一次的旧结果，非常坑。CDP 会话是真实时间，动画照常推进，也没有
 * `--virtual-time-budget` 耗尽的问题。
 *
 * 用法（Windows 上 CHROME / ZUD 必须给 Windows 路径，MSYS 的 /c/... 会让 spawn ENOENT）：
 *   CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" \
 *   ZUD="C:/Users/<you>/AppData/Local/Temp/tabnest/ud1" \
 *   node devtools/cdp.mjs <url> <out> [port] [模式] [--w=] [--h=] [--wait=ms]
 *
 * 模式：
 *   --eval=<js文件>   在该页执行 JS（awaitPromise，返回值写 <out>）；可与 --shot 叠加
 *   --probe           等 `document.title === 'DONE'`（探针跑完自己改标题）再吐出 #log 文本
 *   --dom             把 documentElement.outerHTML 写 <out>
 *   （默认）           截图 PNG 写 <out>
 *   --shot            配合 --eval / --probe 时，执行完再截一张 <out 去掉扩展名>.png
 *
 * 跑探针的标准姿势：
 *   node devtools/cdp.mjs "http://localhost:8173/_probe.html" "$OUT/probe.txt" 9406 \
 *     --probe --w=1500 --h=900 --wait=4000
 *   ⚠️ 探针地址写 localhost，别写 127.0.0.1：vite 只监听 localhost(::1)。
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

/** 等探针把标题改成 DONE，再把 <pre id="log"> 的文本整段吐出来 */
const PROBE_EXPR = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let w = 0;
  while (document.title !== 'DONE' && w < 260000) { await sleep(1500); w += 1500; }
  const txt = (document.getElementById('log') || {}).textContent || '(no log)';
  return 'title=' + document.title + ' waited=' + Math.round(w / 1000) + 's\\n' + txt;
})()`;

const CHROME = process.env.CHROME;
const url = process.argv[2];
const out = process.argv[3];
const port = Number(process.argv[4] || 9333);
const evalArg = process.argv.find((a) => a.startsWith('--eval='));
const mode = process.argv.includes('--probe') ? 'probe' : evalArg ? 'eval' : process.argv.includes('--dom') ? 'dom' : 'shot';
const num = (flag, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(flag));
  return hit ? Number(hit.slice(flag.length)) : fallback;
};
const winW = num('--w=', 900);
const winH = num('--h=', 700);
const waitMs = num('--wait=', 1500);

if (!CHROME || !url || !out) {
  console.error('用法: CHROME=<chrome.exe> ZUD=<临时 profile 目录> node devtools/cdp.mjs <url> <out> [port] [--eval=<js>|--dom] [--shot] [--w=] [--h=] [--wait=]');
  process.exit(2);
}

const child = spawn(
  CHROME,
  [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-proxy-server',
    `--user-data-dir=${process.env.ZUD}`,
    `--window-size=${winW},${winH}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 等调试端口起来（最多 ~30s） */
async function waitForChrome() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('chrome 调试端口未就绪');
}

/** 极简 CDP 会话：send(method, params) → Promise<result> */
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('open', () =>
      resolve({
        send(method, params = {}) {
          const mid = ++id;
          ws.send(JSON.stringify({ id: mid, method, params }));
          return new Promise((res, rej) => pending.set(mid, { res, rej }));
        },
        close: () => ws.close(),
      })
    );
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const slot = pending.get(msg.id);
      if (!slot) return;
      pending.delete(msg.id);
      msg.error ? slot.rej(new Error(JSON.stringify(msg.error))) : slot.res(msg.result);
    });
  });
}

async function shoot(cdp) {
  const metrics = await cdp.send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize || metrics.contentSize;
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.min(size.width, winW), height: Math.min(size.height, winH), scale: 1 },
  });
  return Buffer.from(shot.data, 'base64');
}

try {
  await waitForChrome();
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  ).json();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(waitMs);

  if (mode === 'eval' || mode === 'probe') {
    const r = await cdp.send('Runtime.evaluate', {
      expression: mode === 'probe' ? PROBE_EXPR : readFileSync(evalArg.slice('--eval='.length), 'utf8'),
      awaitPromise: true,
      returnByValue: true,
    });
    const text = r.exceptionDetails
      ? 'EXCEPTION: ' + JSON.stringify(r.exceptionDetails)
      : typeof r.result.value === 'string'
        ? r.result.value
        : JSON.stringify(r.result.value ?? null, null, 2);
    writeFileSync(out, text, 'utf8');
    if (process.argv.includes('--shot')) {
      await sleep(400);
      writeFileSync(out.replace(/\.(json|txt)$/, '') + '.png', await shoot(cdp));
    }
  } else if (mode === 'dom') {
    const r = await cdp.send('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML',
      returnByValue: true,
    });
    writeFileSync(out, String(r.result.value ?? ''), 'utf8');
  } else {
    writeFileSync(out, await shoot(cdp));
  }

  cdp.close();
  console.log('OK ->', out);
} finally {
  child.kill();
}
