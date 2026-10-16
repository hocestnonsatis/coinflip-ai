// Full-screen 3D tavla: per viewport, measure the projected board vs the screen and the floating panels; screenshot.
// node scripts/cdp-tavla-full.mjs <baseUrl> <outPrefix>
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [base, out] = process.argv.slice(2);
const port = 9500 + Math.floor(Math.random() * 90);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpf-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
const P = '0,0,0,0,0,9,0,0,0,0,0,-5,0,0,0,0,-3,0,-5,0,-1,2,0,-1,1,0,3,0';
let fails = 0;
const ONLY = process.env.ONLY; for (const [w, h, dpr, mobile, name] of [[1280, 720, 1, 0, '1280x720'], [1920, 1080, 1, 0, '1920x1080'], [3840, 2160, 1, 0, '3840x2160-dpr1'], [1920, 1080, 2, 0, '3840x2160-dpr2'], [390, 844, 3, 1, '390x844'], [390, 844, 2, 1, '390x844-dpr2'], [390, 844, 3, 0, '390x844-nomobile'], [390, 844, 1, 0, '390x844-dpr1'], [600, 700, 2, 1, 'm600']].filter((v) => !ONLY || v[4] === ONLY)) {
	await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: !!mobile });
	await send('Page.navigate', { url: `${base}?pos=${P}&dice=4,3` }); await sleep(4000); for (let k = 0; k < 40 && !(await ev('!!window.__tavla3d && !!window.__tavlaUi && window.__tavlaUi().phase === "move"')); k++) await sleep(500); await sleep(1000);
	const m = JSON.parse(await ev(`(()=>{const b=window.__tavla3d.boardRect();const p=document.querySelector('.panel').getBoundingClientRect();const q=document.querySelector('.prob').getBoundingClientRect();const c=document.querySelector('canvas.stage3d');return JSON.stringify({b,panel:[p.left,p.top,p.right,p.bottom],prob:q.bottom,canvas:[c.width,c.height],vw:innerWidth,vh:innerHeight})})()`));
	const bw = m.b.x1 - m.b.x0, bh = m.b.y1 - m.b.y0, short = Math.min(m.vw, m.vh);
	const sheet = m.panel[2] - m.panel[0] > m.vw * 0.8;
	const overlap = sheet ? m.b.y1 > m.panel[1] + 2 : m.b.x1 > m.panel[0] + 2;
	const occ = (m.vw < m.vh ? bw / m.vw : bh / m.vh);
	console.log(`${name}: canvas ${m.canvas.join('×')} px (pr ${m.b.pr.toFixed(2)}), board ${Math.round(bw)}×${Math.round(bh)} css px = ${(occ * 100).toFixed(0)}% of shorter side, overlaps panel: ${overlap}, under prob bar: ${m.b.y0 < m.prob - 2}`);
	if (!mobile && occ < 0.7) fails++; if (overlap) fails++;
	// raycast after resize: tap the 21-point (bar entry + hit) via projected coordinates
	const before = await ev('window.__tavla3d.board[25]');
	const pt = JSON.parse(await ev('JSON.stringify(window.__tavla3d.screenOf(20))'));
	if (mobile) { for (const type of ['touchStart', 'touchEnd']) await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [pt] }); }
	else for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
	let after = before; for (let k = 0; k < 30 && after === before; k++) { await sleep(400); after = await ev('window.__tavla3d.board[25]'); }
	console.log(`   tap → bar entry + hit: model bar ${before} → ${after} ${after === before + 1 ? 'OK' : 'FAIL'}`); if (after !== before + 1) fails++;
	const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${name}.png`, Buffer.from(r.data, 'base64'));
}
console.log(fails ? `FAILURES: ${fails}` : 'all viewports OK'); ws.close(); ch.kill(); process.exit(fails ? 1 : 0);
