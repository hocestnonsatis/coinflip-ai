// Tavla engine: TS move generation must equal the Python training engine (train/bg.py) on 1,500 random positions, plus hand-checked rules.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { legalPlays, legalSequences, applyStep, start, flip, encode, key, type Board } from '../src/lib/tavla-engine.ts';

const fx = JSON.parse(readFileSync(new URL('./tavla-fixtures.json', import.meta.url), 'utf8'));
let n = 0;
for (const c of fx.cases) {
	const got = legalPlays(c.b, c.d[0], c.d[1]).map((p) => key(p.board)).sort();
	assert.deepEqual(got, c.r, `mismatch at ${c.b} dice ${c.d}`);
	for (const p of legalPlays(c.b, c.d[0], c.d[1])) {
		let me = p.board[24] + p.board[26], op = p.board[25] + p.board[27];
		for (let i = 0; i < 24; i++) { if (p.board[i] > 0) me += p.board[i]; else op -= p.board[i]; }
		assert.equal(me, 15); assert.equal(op, 15);
	}
	n += got.length;
}
for (const e of fx.enc) { const x = encode(e.b); e.x.forEach((v: number, i: number) => assert.ok(Math.abs(x[i] - v) < 1e-5)); }

const empty = (): Board => new Array(28).fill(0);
// Opening 3-1: 16 distinct plays.
assert.equal(legalPlays(start(), 3, 1).length, 16);
assert.deepEqual(flip(flip(start())), start());
// Bar entry blocked: opponent owns points 18..23 except 20 → only die 4 enters (24-4=20).
{ const b = empty(); b[24] = 1; b[5] = 14; for (const i of [18, 19, 21, 22, 23]) b[i] = -2; b[25] = 0; b[27] = 5;
  const ps = legalPlays(b, 6, 4); assert.ok(ps.every((p) => p.steps[0][0] === 24 && p.steps[0][1] === 20)); }
// Closed board: no move at all.
{ const b = empty(); b[24] = 1; b[5] = 14; for (const i of [18, 19, 20, 21, 22, 23]) b[i] = -2; b[27] = 3;
  const ps = legalPlays(b, 6, 4); assert.equal(ps.length, 1); assert.equal(ps[0].steps.length, 0); }
// Larger-die rule: single checker on 7 (index 7), opponent blocks so only one die playable alone → must play the 6 if possible.
{ const b = empty(); b[7] = 1; b[0] = 14; b[2] = -2; b[3] = -2; b[27] = 11; // 7-5=2 blocked, 7-6=1 open; then 1-5 off? not all home... index1 is home and 0 → all home after first move
  const ps = legalPlays(b, 6, 5); assert.ok(ps.every((p) => p.steps[0][0] === 7 && p.steps[0][1] === 1)); }
{ const b = empty(); b[10] = 1; b[0] = 14; b[5] = -2; b[4] = -2; b[27] = 11; // 10-6=4 blocked, 10-5=5 blocked → nothing
  assert.equal(legalPlays(b, 6, 5)[0].steps.length, 0); }
{ const b = empty(); b[12] = 1; b[0] = 14; b[6] = -2; b[1] = -2; b[2] = -2; b[27] = 9; // 6 then 5→1 blocked; 5 then 6→1 blocked; only one die: must be the 6 (12→6 blocked!) → 12→7 with 5
  const ps = legalPlays(b, 6, 5); assert.equal(ps.length, 1); assert.deepEqual(ps[0].steps, [[12, 7]]); }
// Bear-off with a higher die only from the highest point.
{ const b = empty(); b[3] = 2; b[1] = 1; b[26] = 12; b[20] = -15;
  const ps = legalPlays(b, 6, 6); assert.ok(ps.some((p) => p.board[26] === 15)); }
{ const b = empty(); b[3] = 1; b[1] = 1; b[26] = 13; b[20] = -15;
  const ps = legalPlays(b, 5, 1); // 5 bears off the highest checker (or 1 first, then 5 bears off from the new highest)
  assert.equal(ps.length, 2); assert.ok(ps.every((p) => p.board[26] === 14)); }
// Hitting sends checker to opponent bar.
{ const b = empty(); b[10] = 15; b[7] = -1; b[20] = -14; const ps = legalPlays(b, 3, 3); assert.ok(ps.some((p) => p.board[25] === 1)); }
// Every UI step sequence replays (applyStep) to its result, and covers exactly the legal result set.
for (const c of fx.cases.slice(0, 500)) {
	const seqs = legalSequences(c.b, c.d[0], c.d[1]);
	for (const q of seqs) assert.equal(key(q.steps.reduce((b: Board, st) => applyStep(b, st), c.b)), key(q.board));
	assert.deepEqual([...new Set(seqs.map((q) => key(q.board)))].sort(), c.r);
}
console.log(`tavla ok: ${fx.cases.length} positions, ${n} legal plays identical to Python; rule checks passed`);
// TS fallback forward pass == onnxruntime (python) on the shipped weights.
{
	const { forwardTs } = await import('../src/lib/tavla-net.ts');
	const mf = JSON.parse(readFileSync(new URL('./tavla-model.json', import.meta.url), 'utf8'));
	for (const m of mf) assert.ok(Math.abs(forwardTs(encode(m.b), 1)[0] - m.p) < 1e-5);
	console.log(`tavla model ok: TS forward matches onnxruntime on ${mf.length} positions`);
}
// Bar entry (bug report: entering onto a point that already holds your own checkers must work, in engine AND click UI).
{
	const { resolveClick } = await import('../src/lib/tavla-engine.ts');
	const base = (): Board => { const b = new Array(28).fill(0); b[5] = 9; b[11] = -5; b[16] = -3; b[18] = -5; b[23] = -2; b[21] = 2; b[24] = 1; b[26] = 3; return b; };
	const next = (b: Board, d1: number, d2: number) => legalSequences(b, d1, d2).map((q) => q.steps[0]);
	const tgt = (b: Board, d1: number, d2: number) => new Set(next(b, d1, d2).filter((s) => s[0] === 24).map((s) => s[1]));
	// own checkers on 22-point (idx 21): die 3 enters there; empty 20-point (idx 19): die 5
	let b = base(); assert.ok(tgt(b, 3, 5).has(21) && tgt(b, 3, 5).has(19));
	// opponent blot on idx 20 → die 4 enters and hits
	b = base(); b[20] = -1; b[23] = -1; assert.ok(legalSequences(b, 4, 6).some((q) => q.steps[0][0] === 24 && q.steps[0][1] === 20 && q.board[25] === 1));
	// blocked by 2+ opponent checkers on idx 23 (die 1) → no entry with the 1
	b = base(); assert.ok(!tgt(b, 1, 3).has(23));
	// doubles from the bar onto own point: 3-3 enters on idx 21 and continues
	b = base(); assert.ok(legalSequences(b, 3, 3).every((q) => q.steps[0][0] === 24 && q.steps[0][1] === 21 && q.steps.length === 4));
	// two on the bar: both must enter before anything else moves
	b = base(); b[24] = 2; b[5] = 8; assert.ok(legalSequences(b, 3, 5).every((q) => q.steps[0][0] === 24 && q.steps[1][0] === 24));
	// UI: bar auto-selected → click own point 22 (idx 21) plays the entry
	b = base(); const ns = next(b, 3, 5);
	assert.deepEqual(resolveClick(ns, 24, 21), { step: [24, 21] });
	// UI: selection was cleared (e.g. user tapped the bar checker again) → clicking the own-checker target must still enter
	assert.deepEqual(resolveClick(ns, null, 21), { step: [24, 21] });
	// UI: tapping the only source (bar) again keeps it selected instead of deselecting
	assert.deepEqual(resolveClick(ns, 24, 24), { sel: 24 });
	console.log('tavla bar-entry ok: own point, empty, hit, blocked, doubles, two on bar, click UI');
}
// 3D layout: every position places exactly 15 + 15 checkers, no two overlapping, human/model colors match the board.
{
	const { layout } = await import('../src/lib/tavla-layout.ts');
	for (const c of fx.cases.slice(0, 400)) for (const b of [c.b, flip(c.b)]) {
		const L = layout(b); let h = 0, m = 0; const all: { x: number; y: number; z: number }[] = [];
		for (const [loc, { human, pos }] of L) { if (human) h += pos.length; else m += pos.length; if (loc < 24) assert.equal(human, b[loc] > 0); all.push(...pos); }
		assert.equal(h, 15); assert.equal(m, 15);
		for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y, all[i].z - all[j].z) > 0.15);
	}
	console.log('tavla 3D layout ok: 30 checkers, no overlaps, 800 positions');
}
