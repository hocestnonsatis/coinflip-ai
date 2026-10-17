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
