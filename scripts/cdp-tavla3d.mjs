// Headless Chrome (SwiftShader WebGL) test of the 3D tavla board: real mouse/touch taps at projected board positions.
// node scripts/cdp-tavla3d.mjs <url> <shotPrefix> <w> <h> <mobile 0|1> <humanTurns>
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [url, out, w = '1300', h = '900', mobile = '0', turns = '4'] = process.argv.slice(2);
const port = 9600 + Math.floor(Math.random() * 300);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdp3-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(), logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + d.params.exceptionDetails.exception?.description); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: mobile === '1' ? 2 : 1, mobile: mobile === '1' });
if (mobile === '1') await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url }); await sleep(6000);
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${n}.png`, Buffer.from(r.data, 'base64')); };
const tap = async (loc) => {
	await ev(`document.querySelector('.board3d').scrollIntoView({block:'center'})`); await sleep(100);
	const p = await ev(`JSON.stringify(window.__tavla3d.screenOf(${loc}))`); const { x, y } = JSON.parse(p);
	if (mobile === '1') { for (const type of ['touchStart', 'touchEnd']) await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] }); }
	else for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
	await sleep(900);
};
const st = () => ev(`JSON.stringify({status:document.querySelector('.turn')?.textContent, dice:[...document.querySelectorAll('.die')].map(d=>d.querySelectorAll('i').length), top: window.__tavla3d?.diceTop(), bar:window.__tavla3d?.board[24], mbar:window.__tavla3d?.board[25], comment:document.querySelector('.comment')?.textContent.slice(0,90)})`);
console.log('mode3d:', await ev(`!!document.querySelector('canvas.board3d') && !document.querySelector('svg.board')`), await st());
await shot('start');
// legal targets come from the polygons-free 3D board → ask the page which locs are targets via the hint we expose in data attributes
const targets = () => ev(`JSON.stringify(window.__tavlaUi?.())`);
let humanTurns = 0, diceOk = 0, diceChecks = 0;
for (let it = 0; it < 120 && humanTurns < +turns; it++) {
	const u = JSON.parse(await targets() || 'null'); if (!u) { await sleep(400); continue; }
	if (u.phase === 'roll') { await ev(`document.querySelector('button.primary')?.click()`); await sleep(1800); const s = JSON.parse(await st()); diceChecks++; const exp = s.dice.length === 4 ? [s.dice[0], s.dice[0]] : s.dice; if (JSON.stringify(s.top) === JSON.stringify(exp)) diceOk++; else console.log('DICE MISMATCH', s.top, s.dice); continue; }
	if (u.phase !== 'move' || u.animating) { await sleep(400); continue; }
	if (u.targets.length) { if (it === 0 || humanTurns === 0) await shot('select'); await tap(u.targets.includes(-1) ? -1 : u.targets[0]); }
	else if (u.sources.length) await tap(u.sources[0]);
	const after = JSON.parse(await targets()); if (after.phase !== 'move') { humanTurns++; if (humanTurns === 1) await shot('after-entry'); await sleep(2500); }
}
await sleep(2000); await shot('end');
console.log(await st()); console.log(`human turns played by taps: ${humanTurns}; 3D dice == crypto roll: ${diceOk}/${diceChecks}`); console.log(logs.join('\n'));
ws.close(); ch.kill();
