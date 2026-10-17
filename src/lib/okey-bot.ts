// Okey bot decisions (1-ply over the value net). Pure: the evaluator is injected (ORT in the browser, TS forward in tests).
import { features, NF, ttype, tilesAway, counts, cover, pairs } from '#lib/okey-engine';
import { randInt, type OkeyGame } from '#lib/okey-game';
import { TAU } from '#lib/okey-weights';
export type Evaluate = (x: Float32Array, n: number) => Promise<Float32Array> | Float32Array;
const distinct = (hand: number[]) => { const s = new Set<number>(); return hand.filter((i) => { const t = ttype(i); if (s.has(t)) return false; s.add(t); return true; }); };
const wins14 = (h: number[], okey: number) => { const [c, w] = counts(h, okey); return cover(c, w) === 14 || pairs(c, w) >= 7; };

export type Think = { n: number; ms: number; p: number; away: number };
/** Draw decision for seat s (14 tiles): take the previous seat's top discard or draw from the pile. */
export const K_DRAW = 8;
/** Draw decision for seat s (14 tiles): take the previous seat's top discard if the best hand after taking it beats the
 * expected value of a blind pile draw (mean over K sampled unseen tiles of the best discard afterwards) by more than TAU. */
export async function chooseDraw(g: OkeyGame, s: number, evaluate: Evaluate, rand: (n: number) => number = randInt): Promise<{ take: boolean } & Think> {
	const top = g.top(s), hand = g.hands[s];
	if (top === null) return { take: false, n: 0, ms: 0, p: NaN, away: tilesAway(hand, g.okey) };
	const h15 = [...hand, top], cands = distinct(h15);
	for (const i of cands) { const h = h15.slice(); h.splice(h.indexOf(i), 1); if (wins14(h, g.okey)) return { take: true, n: cands.length, ms: 0, p: 1, away: 0 }; }
	const vis = new Set<number>([...hand, g.gosterge, ...g.discards.flat()]);
	const unseen = Array.from({ length: 106 }, (_, i) => i).filter((i) => !vis.has(i));
	const samples: number[] = []; for (let k = 0; k < Math.min(K_DRAW, unseen.length); k++) { const j = k + rand(unseen.length - k); [unseen[k], unseen[j]] = [unseen[j], unseen[k]]; samples.push(unseen[k]); }
	// one batch: [take candidates | sample 1 candidates | sample 2 candidates | …]
	const hands: number[][] = [];
	const spans: [number, number][] = [];
	for (const i of cands) { const h = h15.slice(); h.splice(h.indexOf(i), 1); hands.push(h); }
	spans.push([0, hands.length]);
	for (const t of samples) { const h16 = [...hand, t], st = hands.length; for (const i of distinct(h16)) { const h = h16.slice(); h.splice(h.indexOf(i), 1); hands.push(h); } spans.push([st, hands.length]); }
	const t0 = performance.now(), x = new Float32Array(hands.length * NF);
	hands.forEach((h, k) => features(h, g.okey, g.seen, g.pile.length, x, k * NF));
	const v = await evaluate(x, hands.length); const ms = performance.now() - t0;
	const mx = ([a, b]: [number, number]) => { let m = -1; for (let k = a; k < b; k++) m = Math.max(m, v[k]); return m; };
	const vTake = mx(spans[0]); let vDraw = 0; for (const sp of spans.slice(1)) vDraw += mx(sp); vDraw /= Math.max(1, spans.length - 1);
	const take = vTake > vDraw + TAU;
	return { take, n: hands.length, ms, p: take ? vTake : vDraw, away: tilesAway(hand, g.okey) };
}
/** Discard decision for seat s (15 tiles): finish if possible (preferring an okey discard), else the best 1-ply discard. */
export async function chooseDiscard(g: OkeyGame, s: number, evaluate: Evaluate): Promise<{ tile: number; finish: boolean } & Think> {
	const hand = g.hands[s], cands = distinct(hand).sort((a, b) => +(ttype(a) !== g.okey) - +(ttype(b) !== g.okey) || a - b);
	for (const i of cands) if (g.winWith(s, i)) return { tile: i, finish: true, n: cands.length, ms: 0, p: 1, away: 0 };
	const t0 = performance.now(), x = new Float32Array(cands.length * NF), away: number[] = [];
	cands.forEach((i, k) => { const h = hand.slice(); h.splice(h.indexOf(i), 1); away.push(features(h, g.okey, g.seen, g.pile.length, x, k * NF)); });
	const v = await evaluate(x, cands.length); const ms = performance.now() - t0;
	let best = 0; for (let k = 1; k < cands.length; k++) if (v[k] > v[best]) best = k;
	return { tile: cands[best], finish: false, n: cands.length, ms, p: v[best], away: away[best] };
}
