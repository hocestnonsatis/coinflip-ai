// Sound smoke test per game (real key/mouse gestures in headless Chrome): counts Web Audio sources started after each
// action, checks the 🔊 button + M shortcut (mute silences, survives reload), the hub stays silent, and no page errors.
// node scripts/cdp-sound.mjs <origin> [lang]
import { spawn } from 'node:child_process';
const [origin, lang = 'en'] = process.argv.slice(2);
const pre = lang === 'en' ? '' : `/${lang}`;
const LOCAL = /localhost|127\.0\.0\.1/.test(origin); // dev server has no stats Durable Object (503 on /api/*/stats|start)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 90);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpsfx-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(), errors = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
	if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
	if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
	if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon|cloudflareinsights/.test(`${d.params.entry.url ?? ''} ${d.params.entry.text}`) && !(LOCAL && /\/api\/(tavla|okey)\/(stats|start)/.test(d.params.entry.url ?? ''))) errors.push(`${d.params.entry.text} ${d.params.entry.url ?? ''}`); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
// count every oscillator / buffer source that starts (the sound kit only uses these two)
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__sfxN = 0; window.__sfxCtx = 0;
	for (const C of [window.OscillatorNode, window.AudioBufferSourceNode]) { const s = C.prototype.start; C.prototype.start = function (...a) { window.__sfxN++; return s.apply(this, a); }; }
	const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__sfxCtx++; } };` });
const key = async (k, code, hold = 60) => { const kc = { ' ': 32, m: 77, a: 65 }[k] ?? 0;
	await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: kc, text: k === ' ' ? ' ' : k }); await sleep(hold);
	await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc }); };
const n = () => ev('window.__sfxN');
const until = async (js, ms = 30000) => { for (let t = 0; t < ms / 200; t++) { if (await ev(js)) return true; await sleep(200); } return false; };
const results = []; let fail = 0;
const check = (game, what, ok, extra = '') => { results.push(`${ok ? 'ok  ' : 'FAIL'} ${game.padEnd(6)} ${what}${extra ? ' · ' + extra : ''}`); if (!ok) fail++; };
const open = async (path) => { errors.length = 0; await send('Page.navigate', { url: origin + path }); await sleep(1500); await until('document.readyState === "complete"'); };
const btn = () => ev(`(() => { const b = document.querySelector('button.snd'); return b ? { muted: b.dataset.muted, text: b.textContent, label: b.getAttribute('aria-label') } : null; })()`);

// hub: no button, no audio context even after a gesture
await open('/'); await ev('localStorage.removeItem("tm-sound-muted")');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
check('hub', 'silent (no toggle, no AudioContext)', !(await btn()) && (await ev('window.__sfxCtx')) === 0);

for (const [game, path] of [['coin', `${pre}/coin`], ['dice', `${pre}/dice`]]) {
	await open(path); await until(`!!document.querySelector('button.snd') && !document.querySelector('.loader')`, 20000); await sleep(800);
	const b = await btn(); check(game, 'toggle in HUD', !!b && b.text === '🔊', b?.label);
	let a = await n(); await key(' ', 'Space', 500); await sleep(400); const flying = (await n()) - a; await sleep(game === 'coin' ? 6500 : 6500);
	const total = (await n()) - a; check(game, 'throw + landing sounds', flying > 0 && total > flying, `${flying} sources at throw, ${total} total`);
	await key('m', 'KeyM'); const mb = await btn(); a = await n(); await key(' ', 'Space', 300); await sleep(6000);
	check(game, 'M mutes (silent throw)', mb?.muted === '1' && mb.text === '🔇' && (await n()) === a);
	await open(path); await until(`!!document.querySelector('button.snd')`, 15000); await sleep(300);
	check(game, 'mute remembered after reload', (await btn())?.muted === '1');
	await ev(`document.querySelector('button.snd').click()`); check(game, 'click unmutes', (await btn())?.muted === '0' && (await ev('localStorage.getItem("tm-sound-muted")')) === '0');
	check(game, 'no page errors', !errors.length, errors.slice(0, 3).join(' | '));
}

// tavla: Space rolls (gesture → unlock), then the model's moves click on their own
await open(`${pre}/tavla`); await until(`window.__tavlaUi && window.__tavlaUi().phase === 'roll' || (window.__tavlaUi && window.__tavlaUi().phase === 'move')`, 40000);
check('tavla', 'toggle in HUD', (await btn())?.text === '🔊');
{ let a = await n(); await key('m', 'KeyM'); await key('m', 'KeyM'); // a gesture (keydown) that leaves sound on
  if ((await ev('window.__tavlaUi().phase')) === 'roll') { a = await n(); await key(' ', 'Space'); await sleep(2500); check('tavla', 'dice rattle + land', (await n()) - a > 5, `${(await n()) - a} sources`); }
  let moved = [], ticks = 0;
  for (let k = 0; k < 40 && (await ev('window.__tavlaUi().phase')) === 'move'; k++) {
	const u = await ev('window.__tavlaUi()'); const loc = u.targets.length ? (u.targets.includes(-1) ? -1 : u.targets[0]) : u.sources[0];
	const { x, y } = await ev(`window.__tavla3d.screenOf(${loc})`); a = await n();
	for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
	await sleep(150); await until(`!window.__tavlaUi().animating`, 5000); await sleep(150); if (u.targets.length) moved.push((await n()) - a); else if ((await n()) > a) ticks++; }
  check('tavla', 'human: select tick + checker clack', moved.length > 0 && moved.every((d) => d > 0), `${ticks} select ticks, clacks ${moved.join('/')}`);

  a = await n(); await until(`window.__tavlaUi().phase === 'roll' || window.__tavlaUi().phase === 'over'`, 40000);
  check('tavla', 'model moves click (checker / hit / bear-off)', (await n()) - a > 0, `${(await n()) - a} sources during the model turn`);
}
check('tavla', 'no page errors', !errors.length, errors.slice(0, 3).join(' | '));

// okey: ?test=win (never counted). 'a' = auto-arrange (shuffle) is a key gesture; selecting/finishing via the UI
await open(`${pre}/okey?test=win`); await until(`window.__okeyUi && window.__okeyUi().phase === 'discard'`, 60000);
check('okey', 'toggle in HUD', (await btn())?.text === '🔊');
{ let a = await n(); await key('a', 'KeyA'); await sleep(900); check('okey', 'arrange shuffle', (await n()) - a > 3, `${(await n()) - a} sources`);
  a = await n(); await ev(`document.querySelector('button.fin')?.click()`); await sleep(1800);
  check('okey', 'finish → tile clack + win jingle', (await ev('window.__okeyUi().phase')) === 'over' && (await n()) - a > 6, `${(await n()) - a} sources`); }
await open(`${pre}/okey`); await until(`window.__okeyUi && ['draw','discard','bots'].includes(window.__okeyUi().phase)`, 60000);
{ await key('m', 'KeyM'); await key('m', 'KeyM'); await until(`window.__okeyUi().phase === 'discard' && !window.__okey3d.busy()`, 40000);
  const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' });
  const click = async (js) => { const { x, y } = await ev(js); await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await sleep(40); await mouse('mouseReleased', x, y); await sleep(250); };
  let a = await n();
  if ((await ev('window.__okeyUi().phase')) === 'draw') { await click(`window.__okey3d.screenOf({ zone: 'pile' })`); await sleep(700);
	check('okey', 'draw from pile clack', (await n()) - a > 0 && (await ev('window.__okeyUi().phase')) === 'discard', `${(await n()) - a} sources`); await until('!window.__okey3d.busy()', 5000); }
  const tile = await ev(`(() => { const u = window.__okeyUi(); return u.rack.filter((x) => x !== null && x !== u.sel).pop(); })()`);
  a = await n(); await click(`window.__okey3d.screenOf({ tile: ${tile} })`); await sleep(200); const sel = (await n()) - a;
  a = await n(); await click(`window.__okey3d.screenOf({ zone: 'discard' })`); await sleep(700); const disc = (await n()) - a;
  check('okey', 'select tick + discard clack', sel > 0 && disc > 0 && (await ev('window.__okeyUi().phase')) !== 'discard', `${sel} / ${disc} sources`);
  a = await n(); await until(`window.__okeyUi().phase === 'draw' || window.__okeyUi().phase === 'over'`, 40000); await sleep(300);
  check('okey', 'bots draw + discard clacks', (await n()) - a >= 6, `${(await n()) - a} sources over 3 bot turns`); }
check('okey', 'no page errors', !errors.length, errors.slice(0, 3).join(' | '));
console.log(results.join('\n')); console.log(fail ? `${fail} FAILED` : 'sound OK');
ch.kill(); process.exit(fail ? 1 : 0);
