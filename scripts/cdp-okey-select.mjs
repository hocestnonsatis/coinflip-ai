// Selection must not change tile faces: render the same rack tile unselected / selected / in a set, and an okey with and
// without its gold frame, then compare the numeral ink + face colours (CIELAB ΔE76). Also saves screens.
// node scripts/cdp-okey-select.mjs <origin> <outPrefix>   → <outPrefix>-{desktop,mobile}[-rack].png + <outPrefix>-samples.json
import { spawn, execFileSync } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [origin, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const samples = [];
for (const [name, W, H] of [['desktop', 1920, 1080], ['mobile', 390, 844]]) {
	const port = 9700 + Math.floor(Math.random() * 90);
	const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpsel-' + port, 'about:blank'], { stdio: 'ignore' });
	let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
	const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
	let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
	const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
	await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: name === 'mobile' ? 3 : 1, mobile: W < 900 });
	await send('Page.navigate', { url: `${origin}/tr/okey?test=win` });
	for (let k = 0; k < 240 && !(await ev('!!window.__okey3d && window.__okeyUi().phase === "discard"')); k++) await sleep(250);
	for (let k = 0; k < 80 && (await ev('window.__okey3d.busy()')); k++) await sleep(150);
	// put both okeys in the rack; A = a coloured non-okey rack tile (prefer red), O = an okey
	const ids = await ev(`(() => { const s = window.__okey3d, v = s.lastView(); const ty = (i) => (i < 104 ? i >> 1 : 52);
		const put = [v.okey * 2, v.okey * 2 + 1].filter((i) => i !== v.gosterge), strip = (a) => a.filter((x) => !put.includes(x));
		const rack = v.rack.map((x) => (put.includes(x) ? null : x)); put.forEach((id) => { rack[rack.lastIndexOf(null)] = id; });
		const base = { ...v, rack, opp: v.opp.map(strip), pile: strip(v.pile), sel: null, sets: new Map() }; window.__base = base;
		const cands = rack.filter((x) => x !== null && x < 104 && ty(x) !== v.okey); const A = cands.find((x) => Math.floor(ty(x) / 13) === 0) ?? cands[0];
		const k = rack.indexOf(A), a = s.screenOf({ slot: 0 }), b = s.screenOf({ slot: 1 });
		return { A, O: put[0], pitch: Math.hypot(b.x - a.x, b.y - a.y) }; })()`);
	const shot = async (tag, js) => {
		await ev(`(() => { const s = window.__okey3d; ${js} })()`); await sleep(500);
		for (let k = 0; k < 40 && (await ev('window.__okey3d.busy()')); k++) await sleep(100);
		const pos = await ev(`[window.__okey3d.faceRect(${ids.A}), window.__okey3d.faceRect(${ids.O})]`);
		const r = await send('Page.captureScreenshot', { format: 'png' }); const f = `/tmp/sel-${name}-${tag}.png`; writeFileSync(f, Buffer.from(r.data, 'base64'));
		return { tag, file: f, A: pos[0], O: pos[1] };
	};
	const st = [];
	st.push(await shot('none', `s.update(window.__base, false)`));
	st.push(await shot('selA', `s.update({ ...window.__base, sel: ${ids.A} }, false)`));
	const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${name}.png`, Buffer.from(r.data, 'base64'));
	const rr = await ev('window.__okey3d.rackRect()'); const pad = 12;
	const clip = { x: Math.max(0, rr.x0 - pad), y: Math.max(0, rr.y0 - pad - 30), width: Math.min(W, rr.x1 + pad) - Math.max(0, rr.x0 - pad), height: Math.min(H, rr.y1 + pad) - Math.max(0, rr.y0 - pad - 30), scale: name === 'mobile' ? 1 : 2 };
	writeFileSync(`${out}-${name}-rack.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip })).data, 'base64'));
	{ const lo = await ev(`window.__base.rack.slice(13).find((x) => x !== null && x !== ${ids.O} && x !== ${ids.O ^ 1})`); await ev(`(() => window.__okey3d.update({ ...window.__base, sel: ${lo} }, false))()`); await sleep(700);
	  writeFileSync(`${out}-${name}-rack-bottom.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip })).data, 'base64')); }
	st.push(await shot('setA', `s.update({ ...window.__base, sets: new Map([[${ids.A}, 1]]) }, false)`));
	st.push(await shot('selO', `s.update({ ...window.__base, sel: ${ids.O} }, false)`));
	st.push(await shot('noframe', `s.update(window.__base, false); s.hideFrames()`));
	samples.push({ name, dpr: name === 'mobile' ? 3 : 1, ...ids, states: st });
	console.log('saved', `${out}-${name}.png`, `${out}-${name}-rack.png`);
	ch.kill(); await sleep(300);
}
writeFileSync(`${out}-samples.json`, JSON.stringify(samples, null, 1));
console.log(execFileSync('python3', [new URL('./okey-select-de.py', import.meta.url).pathname, `${out}-samples.json`], { encoding: 'utf8' }));
process.exit(0);
