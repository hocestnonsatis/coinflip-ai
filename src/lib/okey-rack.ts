// Istaka (rack) helpers: 26 slots in 2 rows × 13. Pure functions, used by OkeyApp and tests.
import { counts, solveSets, ttype, tcol, tval, FJ } from '#lib/okey-engine';
export const SLOTS = 26, ROW = 13;
export type Rack = (number | null)[];

/** Order the types of one solver set for display: runs ascending with wildcards (-1) in their gaps, groups by colour. */
export function orderSet(set: number[]): number[] {
	const real = set.filter((t) => t >= 0), wilds = set.length - real.length;
	const vals = real.map(tval), group = real.length >= 2 && new Set(vals).size === 1;
	if (group || real.length <= 1) return [...real.sort((a, b) => tcol(a) - tcol(b)), ...new Array(wilds).fill(-1)];
	// run: 1 may sit low (1-2-3) or high (12-13-1)
	const pos = (low: boolean) => real.map((t) => (tval(t) === 1 && !low ? 14 : tval(t)));
	const span = (p: number[]) => Math.max(...p) - Math.min(...p);
	const p = vals.includes(1) && span(pos(false)) < span(pos(true)) ? pos(false) : pos(true);
	const byPos = new Map(real.map((t, k) => [p[k], t])); const lo = Math.min(...p), hi = Math.max(...p);
	const out: number[] = []; let w = wilds;
	for (let v = lo; v <= hi; v++) if (byPos.has(v)) out.push(byPos.get(v)!); else { out.push(-1); w--; }
	for (let v = hi + 1; w > 0 && v <= 14; v++, w--) out.push(-1);
	for (; w > 0; w--) out.unshift(-1);
	return out;
}
/** Solver partition of a hand as tile-id chunks (sets first, then the leftovers sorted by colour/value). */
export function partition(hand: number[], okey: number): { sets: number[][]; left: number[] } {
	const [c, w] = counts(hand, okey), { sets, left } = solveSets(c, w);
	// pools by solver type: real okeys are wildcards (-1); false jokers stand in for the okey type
	const pool = new Map<number, number[]>();
	for (const id of hand) { const k = ttype(id) === okey ? -1 : ttype(id) === FJ ? okey : ttype(id); (pool.get(k) ?? pool.set(k, []).get(k)!).push(id); }
	const take = (k: number) => pool.get(k)!.pop()!;
	const ids = sets.map((s) => orderSet(s).map(take));
	const rest = left.map(take).sort((a, b) => ord(a, okey) - ord(b, okey));
	return { sets: ids, left: rest };
}
const ord = (id: number, okey: number) => (ttype(id) === okey ? 99 : ttype(id) === FJ ? tcol(okey) * 13 + tval(okey) - 1 : tcol(ttype(id)) * 13 + tval(ttype(id)) - 1) * 2 + (id & 1);
/** Lay chunks onto the rack, one gap between chunks, never splitting a chunk across rows (unless it can't fit). */
export function layout(chunks: number[][], loose: number[]): Rack {
	const r: Rack = new Array(SLOTS).fill(null);
	const fits = (gap: number) => {
		let row = 0, col = 0; const at: [number, number][] = [];
		for (const ch of chunks) {
			if (col > 0 && col + gap + ch.length > ROW) { row++; col = 0; } else if (col > 0) col += gap;
			if (row > 1 || col + ch.length > ROW) return null;
			at.push([row * ROW + col, ch.length]); col += ch.length;
		}
		let p = row * ROW + col + (col > 0 && loose.length ? gap : 0);
		if (p + loose.length > SLOTS) return null;
		return { at, p };
	};
	const plan = fits(1) ?? fits(0);
	if (!plan) { [...chunks.flat(), ...loose].forEach((id, k) => (r[k] = id)); return r; }
	plan.at.forEach(([s], k) => chunks[k].forEach((id, j) => (r[s + j] = id)));
	loose.forEach((id, j) => (r[plan.p + j] = id));
	return r;
}
export const arrange = (hand: number[], okey: number): Rack => { const p = partition(hand, okey); return layout(p.sets, p.left); };
/** Put a newly drawn tile into the rightmost free slot of the bottom row (or any free slot). */
export function placeNew(r: Rack, id: number): Rack {
	const n = r.slice(); let k = n.lastIndexOf(null); if (k < 0) k = n.length;
	n[k] = id; return n;
}
export const remove = (r: Rack, id: number): Rack => r.map((x) => (x === id ? null : x));
/** Move tile `id` to `slot`; a tile already there swaps into the old slot. */
export function move(r: Rack, id: number, slot: number): Rack {
	const n = r.slice(), from = n.indexOf(id); if (from < 0 || slot < 0 || slot >= SLOTS || from === slot) return n;
	n[from] = n[slot]; n[slot] = id; return n;
}
/** Set index per tile id of an optimal partition (for highlighting). */
export function setMap(hand: number[], okey: number): Map<number, number> {
	const m = new Map<number, number>(); partition(hand, okey).sets.forEach((s, k) => s.forEach((id) => m.set(id, k))); return m;
}
