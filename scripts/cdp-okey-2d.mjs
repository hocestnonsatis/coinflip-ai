// 2D fallback screenshot (?2d) with a real okey in the rack (reloads until the dealt hand holds one). node scripts/cdp-okey-2d.mjs <origin> <out.png> [WxH]
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [origin, out, size = '390x844'] = process.argv.slice(2); const [W, H] = size.split('x').map(Number);
const port = 9500 + Math.floor(Math.random() * 90);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdp2d-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 900 });
let got = null;
for (let k = 0; k < 25 && !got; k++) {
	await send('Page.navigate', { url: `${origin}/tr/okey?2d` });
	for (let j = 0; j < 60 && !(await ev('!!document.querySelector(".rack2d .tl")')); j++) await sleep(200);
	await sleep(500);
	got = await ev(`(() => { const e = document.querySelector('.rack2d .tl.okey'); return e ? getComputedStyle(e).transform : null; })()`);
}
console.log('2D okey tile transform:', got, got && got.startsWith('matrix(-1') ? '(rotated 180°) OK' : 'FAIL');
const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(out, Buffer.from(r.data, 'base64'));
ch.kill(); process.exit(got && got.startsWith('matrix(-1') ? 0 : 1);
