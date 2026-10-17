// Render every sfx offline (OfflineAudioContext in headless Chrome, dev server only: imports /src/lib/sound.ts) and report
// peak / RMS loudness + length (coinFlip's spin ticks run on real timers, so offline they collapse onto t=0: whoosh only); writes <outDir>/<name>.wav so the sounds can be listened to.  node scripts/cdp-sound-render.mjs http://127.0.0.1:5199 screens/sounds
import { spawn } from 'node:child_process'; import { writeFileSync, mkdirSync } from 'node:fs';
const [origin, outDir] = process.argv.slice(2); mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9400 + Math.floor(Math.random() * 90);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdpsnd-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.navigate', { url: `${origin}/` }); await sleep(2500);
const res = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
	const SR = 44100, LEN = 3, out = [];
	const names = Object.keys((await import('/src/lib/sound.ts?probe')).sfx);
	for (const [i, name] of names.entries()) {
		let oc; window.AudioContext = class { constructor() { oc = new OfflineAudioContext(1, SR * LEN, SR); Object.defineProperty(oc, 'state', { get: () => 'running' }); return oc; } };
		localStorage.removeItem('tm-sound-muted');
		const S = await import('/src/lib/sound.ts?r' + i); S.unlock();
		const stop = name === 'coinFlip' ? S.sfx[name](0.6) : S.sfx[name](); if (typeof stop === 'function') setTimeout(stop, 900);
		await new Promise((r) => setTimeout(r, name === 'coinFlip' ? 1000 : 0));
		const d = (await oc.startRendering()).getChannelData(0);
		let peak = 0, ss = 0, last = 0; for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); peak = Math.max(peak, a); ss += d[k] * d[k]; if (a > 0.003) last = k; }
		const pcm = new Int16Array(last + 2205); for (let k = 0; k < pcm.length; k++) pcm[k] = Math.max(-1, Math.min(1, d[k] || 0)) * 32767;
		let bin = ''; const u8 = new Uint8Array(pcm.buffer); for (let k = 0; k < u8.length; k++) bin += String.fromCharCode(u8[k]);
		out.push({ name, peak, rms: Math.sqrt(ss / Math.max(1, last)), len: last / SR, pcm: btoa(bin) });
	}
	return out;
})()` });
const v = res.result.value; if (!v) { console.error(JSON.stringify(res).slice(0, 600)); process.exit(1); }
const wav = (b64) => { const pcm = Buffer.from(b64, 'base64'), h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(88200, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
let bad = 0;
for (const s of v) {
	writeFileSync(`${outDir}/${s.name}.wav`, wav(s.pcm));
	const db = (x) => (20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);
	const ok = s.peak > 0.1 && s.peak < 0.75 && s.len < 2.5; if (!ok) bad++; // every effect between -20 and -2.5 dBFS peak
	console.log(`${s.name.padEnd(9)} peak ${db(s.peak).padStart(6)} dBFS  rms ${db(s.rms).padStart(6)} dBFS  ${s.len.toFixed(2)} s ${ok ? '' : '  <-- check'}`);
}
ch.kill(); process.exit(bad ? 1 : 0);
