// Okey headless test: plays a few human turns through the 3D scene (pile draw, take, click-select + discard zone, drag reorder,
// auto-arrange), then ?test=win → Finish. Screenshots into <outPrefix>-*.png. node scripts/cdp-okey.mjs <origin> <outPrefix> [WxH] [lang]
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [origin, out, size = '1920x1080', lang = 'en'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number), mobile = W < 800;
const port = 9300 + Math.floor(Math.random() * 90);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpo-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(), errors = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result ?? d.error); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' ')); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const ui = () => ev('window.__okeyUi && window.__okeyUi()');
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${name}.png`, Buffer.from(r.data, 'base64')); console.log('  saved', `${out}-${name}.png`); };
const at = (q) => ev(`(() => { const p = window.__okey3d.screenOf(${JSON.stringify(q)}); return [Math.round(p.x), Math.round(p.y)]; })()`);
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' });
const click = async ([x, y]) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await sleep(40); await mouse('mouseReleased', x, y); await sleep(250); };
const drag = async ([x0, y0], [x1, y1]) => { await mouse('mousePressed', x0, y0); for (let k = 1; k <= 8; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * k) / 8, y: y0 + ((y1 - y0) * k) / 8, button: 'left', buttons: 1 }); await sleep(30); } await mouse('mouseReleased', x1, y1); await sleep(300); };
const waitFor = async (pred, ms = 30000) => { const t0 = Date.now(); for (;;) { const u = await ui(); if (u && pred(u)) return u; if (Date.now() - t0 > ms) return u; await sleep(200); } };
const starts = `performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/okey/start')).length`;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile });
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: false });
let fails = 0; const fail = (m) => { fails++; console.log('FAIL', m); };
await send('Page.navigate', { url: `${origin}${lang === "en" ? "" : "/" + lang}/okey` });
let u = await waitFor((u) => u.phase === 'draw' || u.phase === 'discard', 40000);
console.log('ready:', JSON.stringify({ phase: u?.phase, mode3d: u?.mode3d, hand: u?.hand, pile: u?.pile }));
if (!u?.mode3d) fail('no 3D');
await sleep(1500); await shot('start');
const rr = await ev('window.__okey3d.rackRect()'); console.log('rack rect', JSON.stringify(rr), `→ ${Math.round(((rr.x1 - rr.x0) / W) * 100)}% of width`);
let took = false, turns = 0;
for (; turns < 4; turns++) {
	u = await waitFor((u) => u.phase === 'draw' || u.phase === 'discard' || u.phase === 'over', 40000);
	if (u.phase === 'over') break;
	if (u.phase === 'draw') {
		const snapTop = await ev(`document.querySelector('.btns button:nth-child(2) .tl') !== null`);
		const tk = snapTop && !took && turns >= 1; if (tk) { await click(await at({ zone: 'take' })); took = true; } else await click(await at({ zone: 'pile' }));
		u = await waitFor((u) => u.phase === 'discard', 5000);
		if (u.phase !== 'discard' || u.hand !== 15) fail(`draw did not work ${JSON.stringify(u)}`);
		else console.log(`  turn ${turns}: ${tk ? 'took the left discard' : 'drew from pile'} → 15 tiles`);
	}
	if (turns === 1) { // drag a tile into an empty slot
		const r = u.rack, from = r.findIndex((x) => x !== null), to = r.indexOf(null), tile = r[from];
		await drag(await at({ tile }), await at({ slot: to })); await sleep(300);
		const r2 = (await ui()).rack; if (r2[to] !== tile) fail(`drag reorder ${from}→${to}`); else console.log(`  dragged tile ${tile} slot ${from} → ${to}`);
	}
	if (turns === 2) { await ev(`[...document.querySelectorAll('.btns button')].find((b) => /arrange|diz|ordnen|Ordenar|Ranger/.test(b.textContent)).click()`); await sleep(600); console.log('  auto-arranged:', JSON.stringify((await ui()).rack.map((x) => (x === null ? '_' : x)).join(','))); await shot('arranged'); }
	u = await ui(); const tile = u.rack.filter((x) => x !== null && x !== u.sel).at(-1); // the drawn tile is pre-selected; pick another one
	await click(await at({ tile }));
	u = await ui(); if (u.sel !== tile) fail(`select ${tile} → sel ${u.sel}`);
	await click(await at({ zone: 'discard' }));
	u = await waitFor((u) => u.phase !== 'discard', 3000);
	if (u.hand !== 14) fail(`discard: hand ${u.hand}`); else console.log(`  discarded ${tile}, phase ${u.phase}`);
}
await sleep(800); await shot('play');
const n1 = await ev(starts); console.log('ticket requests (normal game):', n1);
await send('Page.navigate', { url: `${origin}${lang === "en" ? "" : "/" + lang}/okey?test=win` });
u = await waitFor((u) => u.phase === 'discard', 30000);
await sleep(1200);
await ev(`document.querySelector('button.fin').click()`); await sleep(1500);
u = await ui(); if (u.winner !== 0 || u.phase !== 'over') fail(`test=win finish → ${JSON.stringify({ w: u.winner, p: u.phase })}`); else console.log('  ?test=win: Finish → human won');
await sleep(1500); await shot('win');
const n2 = await ev(starts); console.log('ticket requests (?test=win):', n2); if (n2 !== 0) fail('test game asked for a ticket');
console.log('page errors:', errors.length ? errors : 'none'); if (errors.length) fails++;
ch.kill(); console.log(fails ? `FAIL ${fails}` : 'okey UI OK'); process.exit(fails ? 1 : 0);
