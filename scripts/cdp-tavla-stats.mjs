// All-time counter badge: screenshot + check that normal games fetch a ticket and ?pos= test-hook games don't.
// node scripts/cdp-tavla-stats.mjs <origin> <out.png>
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [origin, out] = process.argv.slice(2);
const port = 9600 + Math.floor(Math.random() * 90);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdps-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
const starts = `performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/tavla/start')).length`;
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
let fails = 0;
await send('Page.navigate', { url: `${origin}/tr/tavla` });
for (let k = 0; k < 40 && !(await ev('!!document.querySelector(".gstats")')); k++) await sleep(500);
await sleep(4000);
const badge = await ev('document.querySelector(".gstats")?.innerText');
const n1 = await ev(starts);
console.log('badge:', JSON.stringify(badge), '· ticket requests:', n1); if (!badge || n1 !== 1) fails++;
const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(out, Buffer.from(r.data, 'base64'));
const P = '0,0,0,0,0,9,0,0,0,0,0,-5,0,0,0,0,-3,0,-5,0,-1,2,0,-1,1,0,3,0';
await send('Page.navigate', { url: `${origin}/tr/tavla?pos=${P}&dice=4,3` });
for (let k = 0; k < 40 && !(await ev('!!window.__tavlaUi && window.__tavlaUi().phase === "move"')); k++) await sleep(500);
await sleep(2000);
const n2 = await ev(starts);
console.log('?pos= test-hook game ticket requests:', n2); if (n2 !== 0) fails++;
ch.kill(); console.log(fails ? `FAIL ${fails}` : 'stats UI OK'); process.exit(fails ? 1 : 0);
