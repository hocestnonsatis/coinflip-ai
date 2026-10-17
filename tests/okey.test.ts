// Okey: TS engine ↔ Python reference parity (tests/okey-fixtures.json from train-okey/fixtures.py) + rule checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { counts, cover, pairs, solveSets, features, okeyOf, isWin14, tcol, tval, NF } from '../src/lib/okey-engine.ts';

const fx = JSON.parse(readFileSync(new URL('./okey-fixtures.json', import.meta.url), 'utf8'));
let worst = 0;
for (const r of fx) {
	const [c, w] = counts(r.h, r.o);
	assert.equal(cover(c, w), r.cov, `cover ${JSON.stringify(r.h)}`);
	assert.equal(pairs(c, w), r.pr);
	const { sets } = solveSets(c, w);
	assert.deepEqual(sets.map((s) => s.length).sort((a, b) => a - b), r.sz, 'same partition sizes');
	const f = new Float32Array(NF); features(r.h, r.o, r.s, r.p, f);
	for (let k = 0; k < NF; k++) worst = Math.max(worst, Math.abs(f[k] - r.f[k]));
}
assert.ok(worst < 1e-5, `feature mismatch ${worst}`);
console.log(`okey parity: ${fx.length} hands (cover, pairs, partition, ${NF} features) max |Δ| ${worst.toExponential(1)}`);

// rules
const R = (v: number, k = 0) => (v - 1) * 2 + k, Y = (v: number, k = 0) => 26 + (v - 1) * 2 + k, B = (v: number, k = 0) => 52 + (v - 1) * 2 + k, K = (v: number, k = 0) => 78 + (v - 1) * 2 + k;
const cov = (h: number[], okey = 51) => { const [c, w] = counts(h, okey); return cover(c, w); };
assert.equal(cov([R(12), R(13), R(1)]), 3, '12-13-1 is a run');
assert.equal(cov([R(13), R(1), R(2)]), 0, '13-1-2 is not');
assert.equal(cov([R(5), Y(5), B(5), K(5)]), 4, 'group of 4');
assert.equal(cov([R(5), R(5, 1), Y(5)]), 0, 'a group needs different colours');
assert.equal(okeyOf(12), 0, 'gösterge red 13 → okey red 1');
assert.equal(okeyOf(5), 6);
assert.equal(cov([R(3), R(4), R(7)], 6), 3, 'okey (red 7) is a wildcard');
assert.equal(cov([R(6), R(8), 104], 6), 3, 'false joker plays as the okey tile');
const win = [R(1), R(2), R(3), Y(7), B(7), K(7), B(9), B(10), B(11), B(12), K(1), K(2), K(3), K(4)];
assert.equal(isWin14(win, 51), 'sets');
const cift = [R(1), R(1, 1), Y(4), Y(4, 1), B(9), B(9, 1), K(2), K(2, 1), R(11), R(11, 1), Y(13), Y(13, 1), B(5), 102];
assert.equal(isWin14(cift, 51), 'cift', '6 pairs + single + okey = çift');
assert.equal(isWin14([...win.slice(0, 13), R(9)], 51), null);
// partition is valid
const { sets } = solveSets(...counts(win, 51));
for (const s of sets) { const real = s.filter((t) => t >= 0); assert.ok(new Set(real.map(tcol)).size === 1 || new Set(real.map(tval)).size === 1); }
// speed
const t0 = performance.now(); let n = 0;
for (const r of fx) for (let k = 0; k < 3; k++) { const [c, w] = counts(r.h, (r.o + k) % 52); cover(c, w); n++; }
console.log(`okey solver: ${((performance.now() - t0) / n).toFixed(3)} ms per 14-tile hand`);
console.log('okey ok');

// model: TS fallback forward == onnxruntime (tests/okey-model.json from scripts/build-onnx-okey.py)
import { forwardTs } from '../src/lib/okey-net.ts';
import { chooseDraw as cd, chooseDiscard as cx } from '../src/lib/okey-bot.ts';
const chooseDraw = (g: OkeyGame, s: number) => cd(g, s, forwardTs), chooseDiscard = (g: OkeyGame, s: number) => cx(g, s, forwardTs);
import { OkeyGame, randInt } from '../src/lib/okey-game.ts';
const mf = JSON.parse(readFileSync(new URL('./okey-model.json', import.meta.url), 'utf8'));
let mw = 0;
for (const r of mf) mw = Math.max(mw, Math.abs(forwardTs(Float32Array.from(r.x), 1)[0] - r.p));
assert.ok(mw < 1e-5, `model mismatch ${mw}`);
console.log(`okey model: TS forward vs onnxruntime max |Δ| ${mw.toExponential(1)}`);

// full games with the TS bots on all four seats (game flow, finishing, pile exhaustion)
{
	const t0 = performance.now(); let wins = 0, draws = 0, turns = 0; const N = 40;
	for (let k = 0; k < N; k++) {
		const g = new OkeyGame();
		assert.equal(g.hands.reduce((a, h) => a + h.length, 0) + g.pile.length + 1, 106);
		assert.equal(g.pile.length, 48);
		for (;;) {
			const s = g.turn;
			if (g.needsDraw(s)) { if (g.exhausted) { draws++; break; } const d = await chooseDraw(g, s); if (d.take) g.takeDiscard(s); else g.drawPile(s); }
			const c = await chooseDiscard(g, s); g.discard(s, c.tile, c.finish);
			if (g.winner !== null) { wins++; assert.ok(g.finish); break; }
		}
		turns += g.turns;
	}
	console.log(`okey TS self-play: ${N} games, ${wins} won, ${draws} pile-out, ${(turns / N).toFixed(1)} turns, ${((performance.now() - t0) / N).toFixed(0)} ms/game`);
	assert.ok(wins > N / 2);
}
// crypto shuffle is uniform-ish
{ const h = new Array(7).fill(0); for (let i = 0; i < 70000; i++) h[randInt(7)]++; for (const x of h) assert.ok(Math.abs(x - 10000) < 500); }
console.log('okey game ok');

// istaka helpers: auto-arrange lays out every tile once, each chunk is a valid set, and the set count matches the solver
import { arrange, partition, orderSet, move, placeNew, remove, SLOTS } from '../src/lib/okey-rack.ts';
import { counts as cnt, cover as cov2, ttype as tt } from '../src/lib/okey-engine.ts';
{
	let checked = 0;
	for (let k = 0; k < 400; k++) {
		const g = new OkeyGame(0), h = g.hands[0].slice(0, 14 + (k & 1));
		const r = arrange(h, g.okey); assert.equal(r.length, SLOTS);
		assert.deepEqual(r.filter((x) => x !== null).sort((a, b) => a! - b!), h.slice().sort((a, b) => a - b));
		const p = partition(h, g.okey); const [c, w] = cnt(h, g.okey);
		const inSets = p.sets.reduce((a, s) => a + s.length, 0);
		for (const s of p.sets) { const [sc, sw] = cnt(s, g.okey); assert.equal(cov2(sc, sw), s.length, 'every chunk is a valid set'); checked++; }
		assert.ok(inSets <= cov2(c, w) && inSets >= cov2(c, w) - w, 'partition covers the optimum (leftover wilds may float)');
		// each set sits in consecutive slots of one row, in display order
		for (const s of p.sets) { const at = s.map((id) => r.indexOf(id)); at.forEach((x, j) => j && assert.equal(x, at[0] + j)); assert.equal(Math.floor(at[0] / 13), Math.floor(at.at(-1)! / 13)); }
	}
	assert.deepEqual(orderSet([5, 4, -1]), [4, 5, -1]); // red 5,6 + wild → 5-6-(7)
	assert.deepEqual(orderSet([0, 12, 11]), [11, 12, 0]); // 12-13-1
	assert.deepEqual(orderSet([0, 2, -1]), [0, -1, 2]); // 1-(2)-3
	assert.deepEqual(orderSet([3, 3 + 13, 3 + 39]), [3, 16, 42]); // group
	let rk = placeNew(new Array(SLOTS).fill(null), 7); assert.equal(rk[SLOTS - 1], 7);
	rk = placeNew(rk, 9); assert.equal(rk[SLOTS - 2], 9);
	rk = move(rk, 7, 0); assert.equal(rk[0], 7); assert.equal(rk[SLOTS - 1], null);
	rk = move(rk, 9, 0); assert.equal(rk[0], 9); assert.equal(rk[SLOTS - 2], 7, 'swap');
	rk = remove(rk, 9); assert.equal(rk.filter((x) => x !== null).length, 1);
	void tt; console.log(`okey rack ok (${checked} arranged sets verified)`);
}

// ink legibility: WCAG contrast on ivory ≥ 3 for every ink, CIELAB ΔE76 ≥ 45 for every pair, 2D CSS uses the same inks
import { INK, IVORY } from '../src/lib/okey-ink.ts';
{
	const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
	const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const lum = (h: string) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
	const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
	const lab = (h: string) => { const [r, g, b] = rgb(h).map(lin); const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
		const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
	const dE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
	const cr = INK.map((c) => contrast(c, IVORY)); cr.forEach((c, i) => assert.ok(c >= 3, `ink ${i} contrast ${c.toFixed(2)}`));
	const pairs: string[] = []; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const d = dE(INK[i], INK[j]); assert.ok(d >= 45, `ΔE ${i}-${j} ${d.toFixed(1)}`); pairs.push(`${'RYBK'[i]}${'RYBK'[j]} ${d.toFixed(0)}`); }
	const css = readFileSync(new URL('../src/lib/OkeyApp.svelte', import.meta.url), 'utf8');
	INK.forEach((c, i) => assert.ok(css.includes(`.c${i} { color: ${c}; }`), `2D CSS ink ${i} out of sync`));
	console.log(`okey inks: contrast on ivory ${cr.map((c) => c.toFixed(2)).join(' / ')} (R/Y/B/K) · ΔE ${pairs.join(', ')}`);
}
