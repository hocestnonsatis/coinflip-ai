// Kedi (cups): timeline invariants, model TS forward == PyTorch == ONNX Runtime (fixture from train-cat/export.py),
// "pixels only" wiring checks, and the stats numbers on the model card come from the eval file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pose, toySlot, randomEpisode, shuffleEvents, rng, swapDur, endOf, SLOT_X, HIDE_D, type Ev } from '../src/lib/kedi-anim.ts';
import { step, unpack, b64ToF32, paramCount, initState, FW, FH } from '../src/lib/kedi-net.ts';
import { META, B64, PARAMS } from '../src/lib/kedi-weights.ts';
import { KEDI_SLEEP } from '../src/lib/i18n-kedi-sleepy.ts';
import { KEDI_SLEEPY } from '../src/lib/kedi-sleepy-stats.ts';

// ---- timeline
{
	const ev: Ev[] = [{ k: 'hide', t: 0, d: HIDE_D, slot: 2 }, { k: 'swap', t: 2, d: 0.5, a: 1, b: 2, s: 1 }, { k: 'swap', t: 3, d: 0.5, a: 0, b: 1, s: -1 }];
	assert.equal(toySlot(pose(ev, -1)), -1, 'no toy before the hide');
	assert.equal(toySlot(pose(ev, 1.95)), 2);
	assert.equal(toySlot(pose(ev, 2.6)), 1, 'followed swap 1↔2');
	assert.equal(toySlot(pose(ev, 3.6)), 0, 'followed swap 0↔1');
	const mid = pose(ev, 2.25); // halfway through 1↔2: the two cups are off the slot line on opposite sides
	assert.ok(Math.abs(mid.cups[1].z + mid.cups[2].z) < 1e-9 && Math.abs(mid.cups[1].z) > 0.5);
	assert.ok(pose(ev, HIDE_D * 0.5).cups.every((c) => c.y > 1), 'cups lifted during the hide');
	assert.ok(pose(ev, 5).cups.every((c, i) => c.y === 0 && c.z === 0 && SLOT_X.includes(c.x as never)), 'cups rest on slots after');
	// toy is always under its cup
	for (let t = 0; t < 4; t += 0.01) { const p = pose(ev, t); if (p.toy.on) { const c = p.cups[p.toyCup]; assert.ok(Math.abs(c.x - p.toy.x) < 1e-9 && Math.abs(c.z - p.toy.z) < 1e-9); } }
	// random episodes: deterministic, label at the end == simulated permutation
	for (let s = 0; s < 200; s++) {
		const e1 = randomEpisode(s), e2 = randomEpisode(s);
		assert.deepEqual(e1, e2);
		let at = [0, 1, 2], toy = -1;
		for (const e of e1.ev) { if (e.k === 'hide') toy = at[e.slot]; else if (e.k === 'swap') [at[e.a], at[e.b]] = [at[e.b], at[e.a]]; }
		assert.equal(toySlot(pose(e1.ev, e1.end)), at.indexOf(toy));
		for (let i = 1; i < e1.ev.length; i++) assert.ok(e1.ev[i].t >= e1.ev[i - 1].t + e1.ev[i - 1].d - 1e-9, 'events never overlap');
	}
	const sh = shuffleEvents(rng(1), 10, 1, 0); assert.equal(sh.length, 10); assert.ok(Math.abs(sh[0].d - swapDur(1)) < 1e-12 && endOf(sh) < 10 * 0.2);
	assert.ok(Math.abs(swapDur(0) - 0.9) < 1e-9 && Math.abs(swapDur(1) - 0.15) < 1e-9);
	console.log('kedi timeline ok');
}

// ---- model: TS == PyTorch == ONNX on a real cat-camera clip
{
	const fx = JSON.parse(readFileSync(new URL('./kedi-fixtures.json', import.meta.url), 'utf8'));
	const w = unpack(META, b64ToF32(B64)); assert.equal(paramCount(META), PARAMS);
	const fr = Buffer.from(fx.frames, 'base64'), n = FW * FH, T = fr.length / n;
	let st = initState(META), prev: Uint8Array | null = null, dT = 0, dO = 0;
	for (let t = 0; t < T; t++) {
		const f = new Uint8Array(fr.buffer, fr.byteOffset + t * n, n), r = step(w, META, f, prev, st); st = r.st; prev = f;
		for (let k = 0; k < 3; k++) { dT = Math.max(dT, Math.abs(r.p[k] - fx.p[t][k])); dO = Math.max(dO, Math.abs(r.p[k] - fx.p_onnx[t][k])); }
	}
	assert.ok(dT < 2e-4 && dO < 2e-4, `TS vs torch ${dT}, TS vs onnx ${dO}`);
	// no information → no preference: a blank feed must give ≈ uniform output (trained for; checked again in the browser on prod)
	st = initState(META); prev = null; let p = new Float32Array(3);
	const blank = new Uint8Array(n).fill(90);
	for (let t = 0; t < 120; t++) { const r = step(w, META, blank, prev, st); st = r.st; prev = blank; p = r.p; }
	console.log(`kedi model: ${PARAMS} params, TS vs PyTorch max |Δ| ${dT.toExponential(1)}, vs ONNX ${dO.toExponential(1)}; blank feed → [${Array.from(p, (v) => v.toFixed(3)).join(', ')}]`);
	if (process.env.KEDI_TRAINED !== '0') assert.ok(Math.max(...p) - Math.min(...p) < 0.1, 'blank feed is near uniform');
}

// ---- honesty wiring: the model module never imports the timeline / scene, and the app feeds it only captured frames
{
	const net = readFileSync(new URL('../src/lib/kedi-net.ts', import.meta.url), 'utf8'), ai = readFileSync(new URL('../src/lib/kedi-ai.ts', import.meta.url), 'utf8');
	for (const src of [net, ai]) assert.ok(!/kedi-anim|kedi-scene|pose\(|SLOT_X/.test(src), 'model code must not see game state');
	const app = readFileSync(new URL('../src/lib/KediApp.svelte', import.meta.url), 'utf8');
	const pushes = [...app.matchAll(/brain\.push\(([^,]+),/g)].map((m) => m[1].trim());
	assert.ok(pushes.length >= 1 && pushes.every((a) => a === 'feed(f)'), `brain.push only gets camera frames: ${pushes}`);
	console.log('kedi honesty wiring ok');
}
// the cheat preview inset renders the cat camera for the player only: its frames must never reach the model
{
	const { readFileSync } = await import('node:fs');
	const app = readFileSync(new URL('../src/lib/KediApp.svelte', import.meta.url), 'utf8');
	const pushes = app.match(/brain\.push\(/g) ?? [];
	assert.equal(pushes.length, 1, 'exactly one place feeds the model');
	assert.ok(!/feed\([^)]*captureNow|brain\.push\([^)]*captureNow/.test(app), 'captureNow previews are never fed to the model');
	assert.ok(/drawPreview\(s3\.captureNow\(\)\)/.test(app) && !/function drawPreview[\s\S]{0,400}brain/.test(app), 'drawPreview only draws');
	console.log('kedi cheat preview never feeds the model ok');
}

{
	// sleepy cat: 5 languages, same line counts, only known placeholders; stats table complete; stride wired into the capture pump
	const ref = KEDI_SLEEP.en, ok = new Set(['{pos}', '{p}', '{fps}', '{n}', '{s}', '{real}', '{ms}']);
	for (const [l, d] of Object.entries(KEDI_SLEEP)) for (const k of ['seen', 'decide', 'won', 'lost'] as const) {
		assert.equal(d[k].length, ref[k].length, `${l}.${k}`);
		for (const line of d[k]) for (const m of line.match(/\{[a-z]+\}/g) ?? []) assert.ok(ok.has(m), `${l}.${k}: ${m}`);
	}
	assert.deepEqual(KEDI_SLEEPY.fps, [30, 15, 10, 5]);
	for (const f of KEDI_SLEEPY.cells) { assert.equal(f.length, KEDI_SLEEPY.swaps.length); for (const r of f) { assert.equal(r.length, KEDI_SLEEPY.speeds.length); for (const [a, n] of r) assert.ok(n > 0 && a >= 0 && a <= n); } }
	const tot = (i: number) => KEDI_SLEEPY.cells[i].flat().reduce((a, c) => a + c[0], 0);
	assert.equal(tot(0), 900, 'awake cat stays 900/900');
	const scene = readFileSync(new URL('../src/lib/kedi-scene.ts', import.meta.url), 'utf8');
	assert.match(scene, /kk % stride\) continue/, 'pump skips non-stride ticks');
	const app = readFileSync(new URL('../src/lib/KediApp.svelte', import.meta.url), 'utf8');
	assert.match(app, /startCapture\(t0, 30 \/ roundFps\)/);
	console.log(`kedi sleepy ok (awake ${tot(0)}, 15 fps ${tot(1)}, 10 fps ${tot(2)}, 5 fps ${tot(3)} / 900)`);
}
