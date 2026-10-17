// Real-output sound check: Chrome with the normal autoplay policy (user activation required), real CDP mouse/key input,
// ?sounddebug=1 analyser tap on the output bus → measured peak/RMS of rendered audio and AudioContext state per game.
// Run headful under Xvfb for a real (non-headless) browser:  xvfb-run -a node scripts/cdp-sound-real.mjs <origin> [--headless] [--tap]
// --tap measures through a patched AudioNode.connect instead of ?sounddebug (for builds without the debug tap).
import { spawn } from 'node:child_process';
const [origin, mode] = process.argv.slice(2); const TAP = process.argv.includes('--tap');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9100 + Math.floor(Math.random() * 90);
const args = ['--no-sandbox', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=document-user-activation-required', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpreal-' + port, '--window-size=1400,900', 'about:blank'];
if (process.argv.includes('--headless')) args.unshift('--headless=new');
const ch = spawn('google-chrome', args, { stdio: 'ignore' });
let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* starting */ } await sleep(250); }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(), logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
	if (d.method === 'Runtime.consoleAPICalled') logs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160)}`);
	if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 200)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send('Runtime.enable'); await send('Page.enable');
if (TAP) await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const orig = AudioNode.prototype.connect; const taps = new WeakMap();
	AudioNode.prototype.connect = function (dst, ...a) { const r = orig.call(this, dst, ...a);
		if (dst instanceof AudioDestinationNode) { const c = this.context; let t = taps.get(c); if (!t) { const an = c.createAnalyser(); an.fftSize = 2048; const buf = new Float32Array(2048); t = { an, peak: 0, ss: 0, n: 0, loud: 0, polls: 0 }; taps.set(c, t);
			setInterval(() => { an.getFloatTimeDomainData(buf); t.polls++; let any = false; for (const v of buf) { const x = Math.abs(v); if (x > t.peak) t.peak = x; t.ss += v * v; t.n++; if (x > 0.001) any = true; } if (any) t.loud++; }, 20);
			window.__soundDebug = (reset) => { const r = { state: c.state, currentTime: c.currentTime, peakDb: 20 * Math.log10(Math.max(t.peak, 1e-9)), rmsDb: 10 * Math.log10(Math.max(t.ss / Math.max(t.n, 1), 1e-18)), loudPolls: t.loud, polls: t.polls }; if (reset) { t.peak = 0; t.ss = 0; t.n = 0; t.loud = 0; t.polls = 0; } return r; }; }
			orig.call(this, t.an); }
		return r; }; })();` });
const mouse = async (x, y) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }); };
const clickSel = async (sel) => { const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`); if (r) await mouse(r.x, r.y); return !!r; };
const key = async (k, code, kc, hold = 80) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: kc }); await sleep(hold); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc }); };
const until = async (js, ms = 30000) => { for (let t = 0; t < ms / 200; t++) { if (await ev(js)) return true; await sleep(200); } return false; };
const dbg = (reset = false) => ev(`window.__soundDebug ? window.__soundDebug(${reset}) : null`);
let fail = 0; const out = [];
const report = (game, what, d, minPeak = -40) => { const ok = d && d.state === 'running' && d.peakDb > minPeak && d.loudPolls > 0; if (!ok) fail++;
	out.push(`${ok ? 'ok  ' : 'FAIL'} ${game.padEnd(6)} ${what.padEnd(26)} ${d ? `state=${d.state} peak ${d.peakDb.toFixed(1)} dBFS rms ${d.rmsDb.toFixed(1)} dBFS audible polls ${d.loudPolls}/${d.polls}` : 'no AudioContext'}`); };
const open = async (path) => { await send('Page.navigate', { url: TAP ? origin + path : `${origin}${path}${path.includes('?') ? '&' : '?'}sounddebug=1` }); await sleep(1500); await until('document.readyState === "complete"'); };

// coin / dice: the first gesture is the throw itself (Space hold)
for (const g of ['coin', 'dice']) {
	await open(`/${g}`); await until(`!!document.querySelector('button.snd') && !document.querySelector('.loader')`, 20000); await sleep(1500);
	out.push(`     ${g.padEnd(6)} before any gesture: ${JSON.stringify(await dbg())}`);
	// first gesture: press-and-hold the throw button with the mouse; second: Space
	{ const r = await ev(`(() => { const b = document.querySelector('button.hold').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
	  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1 });
	  await sleep(150); out.push(`     ${g.padEnd(6)} right after the first mousedown: ${JSON.stringify(await dbg())}`); await sleep(350);
	  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', buttons: 0, clickCount: 1 }); }
	await sleep(5500); report(g, 'first throw (mouse hold)', await dbg(true));
	await key(' ', 'Space', 32, 400); await sleep(5500); report(g, 'second throw (Space)', await dbg(true));
}
// tavla: first gesture = clicking the roll button (or whatever the human must click)
await open('/tavla'); await until(`window.__tavlaUi && ['roll','move'].includes(window.__tavlaUi().phase)`, 40000); await sleep(500);
if ((await ev('window.__tavlaUi().phase')) === 'roll') { await clickSel('button.primary'); await sleep(2500); report('tavla', 'roll button → dice', await dbg(true)); }
for (let k = 0; k < 30 && (await ev('window.__tavlaUi().phase')) === 'move'; k++) { const u = await ev('window.__tavlaUi()'); const loc = u.targets.length ? (u.targets.includes(-1) ? -1 : u.targets[0]) : u.sources[0]; const p = await ev(`window.__tavla3d.screenOf(${loc})`); await mouse(p.x, p.y); await sleep(900); }
await until(`['roll','over'].includes(window.__tavlaUi().phase)`, 40000); report('tavla', 'moves + model turn', await dbg(true));
// okey
await open('/okey'); await until(`window.__okeyUi && ['draw','discard'].includes(window.__okeyUi().phase) && !window.__okey3d.busy()`, 60000); await sleep(400);
if ((await ev('window.__okeyUi().phase')) === 'draw') { const p = await ev(`window.__okey3d.screenOf({ zone: 'pile' })`); await mouse(p.x, p.y); await sleep(900); report('okey', 'draw from pile (1st click)', await dbg(true)); }
{ const t = await ev(`(() => { const u = window.__okeyUi(); return u.rack.filter((x) => x !== null && x !== u.sel).pop(); })()`); let p = await ev(`window.__okey3d.screenOf({ tile: ${t} })`); await mouse(p.x, p.y); await sleep(300);
  p = await ev(`window.__okey3d.screenOf({ zone: 'discard' })`); await mouse(p.x, p.y); await sleep(800); report('okey', 'select + discard', await dbg(true)); }
await until(`['draw','over'].includes(window.__okeyUi().phase)`, 40000); report('okey', 'bot turns', await dbg(true));
console.log(out.join('\n')); console.log('console:', logs.filter((l) => !/^(log|debug)/.test(l)).join('\n  ') || 'clean');
console.log(fail ? `${fail} FAILED` : 'real audio OK'); ch.kill(); process.exit(fail ? 1 : 0);
