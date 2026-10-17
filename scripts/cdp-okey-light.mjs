// Tile legibility screenshots: dealt ?test=win rack + both okeys, a false joker and a black run, full view and a 2× rack close-up.
// node scripts/cdp-okey-light.mjs <origin> <outPrefix>   → <outPrefix>-{desktop,mobile}.png and -{desktop,mobile}-rack.png
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [origin, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, W, H] of [['desktop', 1920, 1080], ['mobile', 390, 844]]) {
	const port = 9700 + Math.floor(Math.random() * 90);
	const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpli-' + port, 'about:blank'], { stdio: 'ignore' });
	let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
	const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
	let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
	const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
	await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 900 });
	await send('Page.navigate', { url: `${origin}/tr/okey?test=win` });
	for (let k = 0; k < 240 && !(await ev('!!window.__okey3d && window.__okeyUi().phase === "discard"')); k++) await sleep(250);
	for (let k = 0; k < 80 && (await ev('window.__okey3d.busy()')); k++) await sleep(150);
	await ev(`(() => { const s = window.__okey3d, v = s.lastView(); const ty = (i) => (i < 104 ? i >> 1 : 52);
		const put = [v.okey * 2, v.okey * 2 + 1, 104, ...[41, 42, 43, 45].map((t) => t * 2)].filter((i) => i !== v.gosterge && !(ty(i) === v.okey && i >= 82 && i < 92 && false));
		const uniq = [...new Set(put)], strip = (a) => a.filter((x) => !uniq.includes(x));
		const rack = v.rack.map((x) => (uniq.includes(x) ? null : x)); uniq.forEach((id) => { const k = rack.lastIndexOf(null); rack[k] = id; });
		s.update({ ...v, rack, opp: v.opp.map(strip), pile: strip(v.pile), sel: null }, false); })()`);
	await sleep(600);
	const full = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}-${name}.png`, Buffer.from(full.data, 'base64'));
	const r = await ev('window.__okey3d.rackRect()');
	const pad = 12, clip = { x: Math.max(0, r.x0 - pad), y: Math.max(0, r.y0 - pad), width: Math.min(W, r.x1 + pad) - Math.max(0, r.x0 - pad), height: Math.min(H, r.y1 + pad) - Math.max(0, r.y0 - pad), scale: 2 };
	const rk = await send('Page.captureScreenshot', { format: 'png', clip }); writeFileSync(`${out}-${name}-rack.png`, Buffer.from(rk.data, 'base64'));
	console.log('saved', `${out}-${name}.png`, `${out}-${name}-rack.png`);
	ch.kill(); await sleep(300);
}
process.exit(0);
