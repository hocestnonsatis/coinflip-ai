// Backgammon (tavla) rules engine, no doubling cube. Port of train/bg.py — keep in sync.
// Board is always from the side-to-move's view: b[0..23] points (mine > 0, opponent < 0);
// I move from high index to low and bear off below 0. b[24]=my bar, b[25]=opp bar, b[26]=my off, b[27]=opp off.
export type Board = number[];
export type Step = [from: number, to: number]; // from 24 = bar, to -1 = off
export type Play = { board: Board; steps: Step[] };

export function start(): Board {
	const b = new Array(28).fill(0);
	b[23] = 2; b[12] = 5; b[7] = 3; b[5] = 5;
	b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -5;
	return b;
}
export function flip(b: Board): Board {
	const n = new Array(28).fill(0);
	for (let i = 0; i < 24; i++) n[i] = -b[23 - i] || 0;
	n[24] = b[25]; n[25] = b[24]; n[26] = b[27]; n[27] = b[26];
	return n;
}
export function singleMoves(b: Board, d: number): { step: Step; board: Board }[] {
	const out: { step: Step; board: Board }[] = [];
	if (b[24] > 0) {
		const t = 24 - d;
		if (b[t] >= -1) {
			const n = b.slice(); n[24]--;
			if (n[t] === -1) { n[t] = 0; n[25]++; }
			n[t]++; out.push({ step: [24, t], board: n });
		}
		return out;
	}
	let allHome = true;
	for (let i = 6; i < 24; i++) if (b[i] > 0) { allHome = false; break; }
	let hi = -1;
	if (allHome) for (let i = 5; i >= 0; i--) if (b[i] > 0) { hi = i; break; }
	for (let p = 23; p >= 0; p--) {
		if (b[p] <= 0) continue;
		const t = p - d;
		if (t >= 0) {
			if (b[t] >= -1) {
				const n = b.slice(); n[p]--;
				if (n[t] === -1) { n[t] = 0; n[25]++; }
				n[t]++; out.push({ step: [p, t], board: n });
			}
		} else if (allHome && (t === -1 || p === hi)) {
			const n = b.slice(); n[p]--; n[26]++; out.push({ step: [p, -1], board: n });
		}
	}
	return out;
}
export const key = (b: Board) => b.join(',');
/** All legal plays (distinct resulting positions). Enforces: use as many dice as possible; if only one die can be used, the larger one when possible. */
export function legalPlays(b: Board, d1: number, d2: number): Play[] {
	const seen = new Map<string, Play>();
	for (const r of legalSequences(b, d1, d2)) { const k = key(r.board); if (!seen.has(k)) seen.set(k, { board: r.board, steps: r.steps }); }
	return [...seen.values()];
}
export type Seq = { board: Board; used: number[]; steps: Step[] };
/** Every legal step sequence (all orders), after the max-dice / larger-die filters. Used by the click-to-move UI. */
export function legalSequences(b: Board, d1: number, d2: number): Seq[] {
	const res: { board: Board; used: number[]; steps: Step[] }[] = [];
	const rec = (bb: Board, dice: number[], used: number[], steps: Step[]) => {
		let ext = false;
		if (dice.length) for (const m of singleMoves(bb, dice[0])) { ext = true; rec(m.board, dice.slice(1), [...used, dice[0]], [...steps, m.step]); }
		if (!ext) res.push({ board: bb, used, steps });
	};
	const orders = d1 === d2 ? [[d1, d1, d1, d1]] : [[d1, d2], [d2, d1]];
	for (const o of orders) rec(b, o, [], []);
	const mx = Math.max(...res.map((r) => r.used.length));
	let cand = res.filter((r) => r.used.length === mx);
	if (mx === 1 && d1 !== d2) {
		const big = Math.max(d1, d2);
		if (cand.some((r) => r.used[0] === big)) cand = cand.filter((r) => r.used[0] === big);
	}
	return cand;
}
/** Apply one step (from,to) to b (side-to-move view). */
export function applyStep(b: Board, [f, t]: Step): Board {
	const n = b.slice();
	if (f === 24) n[24]--; else n[f]--;
	if (t === -1) n[26]++;
	else { if (n[t] === -1) { n[t] = 0; n[25]++; } n[t]++; }
	return n;
}
export const pips = (b: Board) => {
	let me = 25 * b[24], op = 25 * b[25];
	for (let i = 0; i < 24; i++) { if (b[i] > 0) me += (i + 1) * b[i]; else if (b[i] < 0) op += (24 - i) * -b[i]; }
	return { me, op };
};
/** Tesauro 198-input encoding of a board seen by the player who just moved (opponent to move). Writes into out at offset. */
export function encode(b: Board, out: Float32Array = new Float32Array(198), off = 0): Float32Array {
	for (let side = 0; side < 2; side++) {
		const sg = side === 0 ? 1 : -1;
		for (let i = 0; i < 24; i++) {
			const c = Math.max(0, b[i] * sg), o = off + side * 96 + i * 4;
			out[o] = c >= 1 ? 1 : 0; out[o + 1] = c >= 2 ? 1 : 0; out[o + 2] = c >= 3 ? 1 : 0; out[o + 3] = c > 3 ? (c - 3) / 2 : 0;
		}
	}
	out[off + 192] = b[24] / 2; out[off + 193] = b[25] / 2; out[off + 194] = b[26] / 15; out[off + 195] = b[27] / 15;
	out[off + 196] = 0; out[off + 197] = 1;
	return out;
}

/** Click-to-move resolution for the UI. nextSteps = legal next single steps; sel = selected source (or null); i = clicked point (24 = bar, -1 = off).
 * A click on a legal destination plays it even when nothing (or another checker) is selected, as long as exactly one source can reach it
 * (e.g. entering from the bar onto a point that already holds your own checkers). */
export function resolveClick(nextSteps: Step[], sel: number | null, i: number): { step: Step } | { sel: number | null } {
	const from = (f: number) => nextSteps.filter((s) => s[0] === f);
	if (sel !== null && from(sel).some((s) => s[1] === i)) return { step: [sel, i] };
	const srcs = [...new Set(nextSteps.map((s) => s[0]))];
	if (srcs.includes(i)) return { sel: sel === i && srcs.length > 1 ? null : i };
	const reach = [...new Set(nextSteps.filter((s) => s[1] === i).map((s) => s[0]))];
	if (reach.length === 1) return { step: [reach[0], i] };
	return { sel: srcs.length === 1 ? srcs[0] : null };
}
