// Okey table layout audit across viewports: gösterge visible (first ray hit, inside the free area), no tile boxes of different
// groups intersecting, for (a) the real dealt table and (b) a synthetic crowded table (10 discards per corner) with and without
// revealed hands. node scripts/cdp-okey-layout.mjs <origin> <outPrefix>
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [origin, out] = process.argv.slice(2);
const VPS = [['desktop', 1920, 1080], ['4k', 3840, 2160], ['laptop', 1366, 768], ['mobile', 390, 844], ['mobile-small', 360, 740], ['mobile-land', 844, 390], ['tablet', 768, 1024]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
for (const [name, W, H] of VPS) {
	const port = 9400 + Math.floor(Math.random() * 90);
	const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpl-' + port, 'about:blank'], { stdio: 'ignore' });
	let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
	const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
	let id = 0; const pend = new Map();
	ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
	const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
	await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 900 });
	await send('Page.navigate', { url: `${origin}/tr/okey?test=win` });
	for (let k = 0; k < 120 && !(await ev('!!window.__okeyUi && window.__okeyUi().phase === "discard"')); k++) await sleep(250);
	await sleep(800); for (let k = 0; k < 80 && (await ev('window.__okey3d.busy()')); k++) await sleep(150); // let the deal animation settle
	await sleep(300);
	const real = await ev('window.__okey3d.audit()');
	const shot = async (tag) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${name}${tag}.png`, Buffer.from(r.data, 'base64')); };
	await shot('');
	const hud = await ev(`(() => { const e = document.querySelector('.hud'); const r = e.getBoundingClientRect(); return { text: e.innerText.replace(/\\s+/g, ' '), visible: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight }; })()`);
	// synthetic crowded table: reuse the live view's tiles, move 40 pile tiles into the four discard corners
	const crowd = async (reveal) => ev(`(() => { const s = window.__okey3d, v = s.lastView(); const pile = v.pile.slice(); const discards = [0, 1, 2, 3].map(() => pile.splice(0, 10));
		s.update({ ...v, pile, discards, reveal: ${reveal}, sel: null, turn: 1 }, false); return s.audit(); })()`);
	const c1 = await crowd(false); await sleep(400); await shot('-crowded');
	const c2 = await crowd(true); await sleep(400); await shot('-revealed');
	const bad = (a) => !a || a.overlaps.length || !a.gostergeVisible || !a.gostergeInFreeArea;
	for (const [tag, a] of [['dealt', real], ['crowded', c1], ['revealed', c2]]) {
		const ok = !bad(a); if (!ok) fails++;
		console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${W}×${H} ${tag}: gösterge visible=${a?.gostergeVisible} inFree=${a?.gostergeInFreeArea} overlaps=${a?.overlaps.length}${a?.overlaps.length ? ' ' + a.overlaps.slice(0, 4).join(' ') : ''}`);
	}
	if (!hud.visible) fails++;
	console.log(`     HUD "${hud.text}" visible=${hud.visible}`);
	ch.kill(); await sleep(300);
}
console.log(fails ? `FAIL ${fails}` : 'layout OK'); process.exit(fails ? 1 : 0);
