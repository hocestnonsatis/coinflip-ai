// Headless Chrome smoke test: open /tavla, play some moves by clicking legal targets, take screenshots.
// Usage: node scripts/cdp-play.mjs <url> <outPrefix> [width height mobile] [moves]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [url, out, w = '1300', h = '900', mobile = '0', moves = '6'] = process.argv.slice(2);
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdp-' + port, '--enable-unsafe-swiftshader', '--use-angle=swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args.map((a) => a.value ?? a.description).join(' ')); if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails.exception?.description)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: mobile === '1' ? 2 : 1, mobile: mobile === '1' });
if (mobile === '1') await send('Emulation.setTouchEmulationEnabled', { enabled: true });
await send('Page.navigate', { url }); await sleep(5000);
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${name}.png`, Buffer.from(r.data, 'base64')); };
await shot('start');
let humanMoves = 0;
for (let it = 0; it < 400 && humanMoves < +moves; it++) {
	const st = await ev(`(() => { const b=[...document.querySelectorAll('button')]; const roll=b.find(x=>x.classList.contains('primary')); if (roll && !roll.disabled) { roll.click(); return 'roll:'+roll.textContent; }
		const c=[...document.querySelectorAll('rect.hit.clickable')]; if (!c.length) return 'wait';
		const tgt=c.filter(x=>{const i=+x.getAttribute('aria-label')-1; return document.querySelectorAll('polygon')[i]?.classList.contains('hl')}); const off=document.querySelector('rect.target');
		const pick = off ? [...c].find(x=>x.getAttribute('aria-label')==='off') : tgt.length ? tgt[Math.floor(Math.random()*tgt.length)] : c[Math.floor(Math.random()*c.length)];
		pick.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'click:'+pick.getAttribute('aria-label')+(tgt.length||off?':t':':s'); })()`);
	if (st?.startsWith('roll') && it > 0) humanMoves++;
	if (humanMoves === 2 && st?.startsWith('click') && st.endsWith(':s')) await shot('select');
	await sleep(st === 'wait' ? 500 : 350);
}
await sleep(2500); await shot('after');
const info = await ev(`JSON.stringify({status: document.querySelector('.turn')?.textContent, comment: document.querySelector('.comment')?.textContent, info: document.querySelector('.info')?.textContent, engine: document.querySelector('.engine')?.textContent, prob: document.querySelector('.prob')?.textContent})`);
console.log(info); console.log(logs.slice(-10).join('\n'));
ws.close(); chrome.kill();
