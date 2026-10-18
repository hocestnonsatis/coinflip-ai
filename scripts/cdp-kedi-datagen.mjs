// Training data for the cat: render random rounds with the real /kedi three.js scene in headless Chrome and store the
// cat-camera frames (64×32 gray, fixed 30 Hz game time, identical consecutive frames dropped — exactly like live play).
// node scripts/cdp-kedi-datagen.mjs <origin> <outDir> <workers> <episodes> [seed0]
//  → <outDir>/w<k>.u8 (frames back to back) + <outDir>/w<k>.jsonl (one line per episode: seed, offset, n, swaps, speed, light, labels, times)
import { launch, sleep } from './cdp-lib.mjs';
import { openSync, writeSync, existsSync, readFileSync, mkdirSync, statSync, ftruncateSync } from 'node:fs';
const [origin, out, W = '6', N = '3000', S0 = '1000000', GRID] = process.argv.slice(2);
// GRID (optional) = 'swaps1,swaps2,..:speed1,speed2,..' → evaluation set: episode i uses pure shuffles at grid cell i % cells
const grid = GRID ? (() => { const [a, b] = GRID.split(':').map((x) => x.split(',').map(Number)); return a.flatMap((n) => b.map((sp) => ({ n, sp }))); })() : null;
const workers = +W, total = +N, seed0 = +S0;
mkdirSync(out, { recursive: true });
// NOTOY=1 (leak ablation, never used for training data): the toy is only drawn while some cup is lifted off the table, so
// after the hide the frames carry no toy pixels or toy shadow at all — only the moving cups. Labels are unchanged.
const NOTOY_JS = `(() => { const sc = window.__kedi.s._scene; let toy = null; const cups = [];
	sc.traverse((o) => { if (o.isMesh && o.geometry.type === 'IcosahedronGeometry') toy = o; if (o.isMesh && o.userData.cup !== undefined) cups.push(o); });
	const rest = Math.min(...cups.map((c) => c.position.y)); let v = true;
	Object.defineProperty(toy, 'visible', { get: () => v && cups.some((c) => c.position.y > rest + 0.05), set: (x) => { v = x; } });
	return cups.length; })()`;
async function worker(w) {
	const idx = `${out}/w${w}.jsonl`, bin = `${out}/w${w}.u8`;
	// resume: keep complete lines whose frames are fully on disk
	const done = new Set(); let off = 0;
	if (existsSync(idx)) for (const l of readFileSync(idx, 'utf8').split('\n')) { if (!l) continue; try { const e = JSON.parse(l); done.add(e.seed); off = Math.max(off, e.off + e.n * 2048); } catch {} }
	const fi = openSync(idx, 'a'), fb = openSync(bin, existsSync(bin) ? 'r+' : 'w');
	if (existsSync(bin) && statSync(bin).size > off) ftruncateSync(fb, off);
	let b = null, count = 0;
	const fresh = async () => { b?.close(); b = await launch({ width: 320, height: 200 }); await b.nav(`${origin}/kedi?datagen=1`); if (!(await b.waitFor('!!window.__kedi', 90000))) throw new Error('no __kedi'); await b.ev('window.__kedi.s.mainView(false)'); if (process.env.NOTOY) await b.ev(NOTOY_JS); };
	await fresh();
	for (let i = w; i < total; i += workers) {
		const seed = seed0 + i; if (done.has(seed)) continue;
		if (count && count % 150 === 0) await fresh();
		let r;
		for (let attempt = 0; ; attempt++) {
			try {
				r = await b.ev(`(() => { const { s, anim } = window.__kedi; const ep = anim.randomEpisode(${seed}${grid ? `, { pure: true, maxSwaps: ${grid[i % grid.length].n}, speed: ${grid[i % grid.length].sp} }` : ''}); const R = anim.rng(${seed} ^ 0x5bd1e995);
				const light = { key: 120 * (0.7 + 0.6 * R()), hemi: 0.7 * (0.6 + 0.8 * R()), kx: 0.6 + (R() - 0.5) * 2.4, kz: 1.4 + (R() - 0.5) * 2.0 };
				const o = s.renderEpisode(ep.ev, 0, ep.end, light); const n = o.frames.length, all = new Uint8Array(n * 2048); o.frames.forEach((f, k) => all.set(f, k * 2048));
				let bin = ''; for (let k = 0; k < all.length; k += 0x8000) bin += String.fromCharCode.apply(null, all.subarray(k, k + 0x8000));
				return { b64: btoa(bin), n, swaps: ep.swaps, speed: ep.speed, light, labels: o.poses.map((p) => anim.toySlot(p)).join(''), times: o.times.map((t) => Math.round(t * 1000)), hides: ep.ev.filter((e) => e.k === 'hide').map((e) => [Math.round(e.t * 1000), e.slot]), durs: ep.ev.filter((e) => e.k === 'swap').map((e) => Math.round(e.d * 1000)) }; })()`);
				break;
			} catch (e) { if (attempt > 2) throw e; console.error(`w${w} seed ${seed}: ${e.message} — restarting chrome`); await fresh(); }
		}
		const buf = Buffer.from(r.b64, 'base64'); if (buf.length !== r.n * 2048) throw new Error('size');
		writeSync(fb, buf, 0, buf.length, off);
		const { b64, ...meta } = r; writeSync(fi, JSON.stringify({ seed, off, ...meta }) + '\n'); off += buf.length; count++;
		if (count % 50 === 0) console.log(`w${w}: ${count} episodes, ${(off / 2048) | 0} frames`);
	}
	b.close();
}
const t0 = Date.now();
await Promise.all(Array.from({ length: workers }, (_, w) => worker(w)));
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
