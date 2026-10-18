// Tiny CDP helper for the kedi scripts: launch headless Chrome (SwiftShader WebGL), open one page, evaluate JS.
import { spawn } from 'node:child_process';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function launch({ width = 1280, height = 720, dpr = 1, mobile = false, port = 9300 + Math.floor(Math.random() * 600), extra = [] } = {}) {
	const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpk-' + port, ...extra, 'about:blank'], { stdio: 'ignore' });
	let tabs; for (let i = 0; i < 80; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
	const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
	let id = 0; const pend = new Map(), logs = [];
	ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.error ? { error: d.error } : d.result); pend.delete(d.id); }
		else if (d.method === 'Runtime.consoleAPICalled') logs.push({ type: d.params.type, text: d.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
		else if (d.method === 'Runtime.exceptionThrown') logs.push({ type: 'exception', text: d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text }); };
	const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
	const ev = async (e, awaitPromise = true) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
	await send('Runtime.enable');
	await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
	const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(file, Buffer.from(r.data, 'base64')); };
	const click = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); };
	const waitFor = async (e, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(e)) return true; } catch {} await sleep(150); } return false; };
	const close = () => { try { ws.close(); } catch {} ch.kill('SIGKILL'); };
	return { send, ev, shot, click, waitFor, close, logs, nav: (url) => send('Page.navigate', { url }) };
}
