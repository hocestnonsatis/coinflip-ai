// Classic Turkish Okey: rules, exact set solver, hand features. TypeScript port of train-okey/okey.py + ai.py (parity-tested in tests/okey.test.ts).
// Tiles: ids 0..105; id < 104 → type = id >> 1 = colour*13 + (value-1) (0 red, 1 yellow, 2 blue, 3 black); 104, 105 = false jokers (type 52).
// The solver returns the actual sets, so 101 Okey (sum of set values, opening ≥ 101, pairs) can be added on top later.
export const NT = 53, FJ = 52;
export const tcol = (t: number) => Math.floor(t / 13);
export const tval = (t: number) => (t % 13) + 1;
export const ttype = (i: number) => (i < 104 ? i >> 1 : FJ);
export const okeyOf = (g: number) => tcol(g) * 13 + (tval(g) % 13);

/** → [counts over 52 types, wildcards]: real okeys are wild, false jokers count as the okey type. */
export function counts(hand: number[], okey: number): [number[], number] {
	const c = new Array(52).fill(0); let w = 0;
	for (const i of hand) { const t = ttype(i); if (t === okey) w++; else if (t === FJ) c[okey]++; else c[t]++; }
	return [c, w];
}

type Opt = [number[], number, number, number]; // used real types (incl. current), wilds used, set size, room for more wilds
const COMB2 = [[0, 1], [0, 2], [1, 2]], COMB3 = [[0, 1, 2]];
function options(c: number[], w: number, i: number, col: number, v: number): Opt[] {
	const out: Opt[] = [];
	const others = [0, 1, 2, 3].filter((k) => k !== col);
	for (const [n, combs] of [[2, COMB2], [3, COMB3]] as [number, number[][]][]) {
		for (const cb of combs) {
			const used = [i]; let wu = 0;
			for (const j of cb) { const t = others[j] * 13 + v - 1; if (c[t] > 0) used.push(t); else wu++; }
			if (wu <= w) out.push([used, wu, n + 1, n === 2 ? 1 : 0]);
		}
	}
	const base = col * 13, at = (p: number) => base + (p <= 13 ? p - 1 : 0);
	for (let s = Math.max(1, v - w); s <= v; s++) {
		const used = [i]; let wu = v - s; const cnt = new Map<number, number>([[i, 1]]);
		for (let e = v + 1; e < 15; e++) {
			const t = at(e);
			if (e === 14 && s === 1) break;
			const have = c[t] - (cnt.get(t) ?? 0);
			if (have > 0) { used.push(t); cnt.set(t, (cnt.get(t) ?? 0) + 1); } else wu++;
			if (wu > w) break;
			const L = e - s + 1;
			if (L >= 3) out.push([used.slice(), wu, L, Math.min(2, 13 - L)]);
			if (L >= 13) break;
		}
	}
	if (v === 1) {
		for (let s = 12; s > 1; s--) {
			const used = [i]; let wu = 0;
			for (let p = s; p < 14; p++) { const t = base + p - 1; if (c[t] > 0 && used.filter((u) => u === t).length < c[t]) used.push(t); else wu++; }
			if (wu <= w) { const L = 14 - s + 1; if (L <= 13) out.push([used, wu, L, Math.min(2, 13 - L)]); }
		}
	}
	return out;
}

const memo = new Map<string, number>();
const key = (c: number[], w: number, cap: number) => String.fromCharCode(...c, 48 + w, 48 + cap);
function best(c: number[], w: number, cap: number): number {
	const k = key(c, w, cap); const r = memo.get(k);
	if (r !== undefined) return r;
	let i = 0; while (i < 52 && c[i] === 0) i++;
	let b: number;
	if (i === 52) b = Math.min(w, cap);
	else {
		c[i]--; b = best(c, w, cap); c[i]++;
		for (const [used, wu, size, room] of options(c, w, i, tcol(i), tval(i))) {
			for (const t of used) c[t]--;
			const v = size + best(c, w - wu, Math.min(2, cap + room));
			for (const t of used) c[t]++;
			if (v > b) b = v;
		}
	}
	memo.set(k, b); return b;
}
/** Max number of tiles that fit into valid sets (exact). */
export function cover(c: number[], w: number): number { if (memo.size > 300_000) memo.clear(); return best(c.slice(), w, 0); }
/** Çift: identical pairs; wildcards pair with any single, or with each other. */
export function pairs(c: number[], w: number): number {
	let p = 0, singles = 0; for (const x of c) { p += x >> 1; singles += x & 1; }
	const u = Math.min(w, singles); return p + u + ((w - u) >> 1);
}
export type Set_ = number[]; // entries: type, or -1 for a wildcard
function room(s: Set_): number {
	const real = s.filter((t) => t >= 0);
	if (real.length >= 2 && tval(real[0]) === tval(real[1]) && tcol(real[0]) !== tcol(real[1])) return 4 - s.length;
	if (new Set(real.map(tval)).size === 1 && real.length === 1) return s.length < 4 ? 4 - s.length : 0;
	return 13 - s.length;
}
/** One optimal partition → { sets, left } (left: leftover types, -1 for an unplaceable wildcard). */
export function solveSets(c0: number[], w: number): { sets: Set_[]; left: number[] } {
	const c = c0.slice(), sets: Set_[] = [], left: number[] = [];
	const target = best(c0.slice(), w, 0); let cap = 0, got = 0;
	for (;;) {
		let i = 0; while (i < 52 && c[i] === 0) i++;
		if (i === 52) break;
		const need = target - got;
		c[i]--;
		if (best(c, w, cap) === need) { left.push(i); continue; }
		c[i]++;
		let ok = false;
		for (const [used, wu, size, rm] of options(c, w, i, tcol(i), tval(i))) {
			for (const t of used) c[t]--;
			const ncap = Math.min(2, cap + rm);
			if (size + best(c, w - wu, ncap) === need) { sets.push([...used, ...new Array(wu).fill(-1)]); w -= wu; cap = ncap; got += size; ok = true; break; }
			for (const t of used) c[t]++;
		}
		if (!ok) throw new Error('okey solver: reconstruction failed');
	}
	for (const s of sets) while (w > 0 && room(s) > 0) { s.push(-1); w--; }
	for (; w > 0; w--) left.push(-1);
	return { sets, left };
}
export function isWin14(hand: number[], okey: number): 'sets' | 'cift' | null {
	const [c, w] = counts(hand, okey);
	if (cover(c, w) === 14) return 'sets';
	if (pairs(c, w) >= 7) return 'cift';
	return null;
}

// ---------------- features (must match ai.py) ----------------
export const NF = 14, NH = 16;
function partials(left: number[]): [number, Set<number>] {
	let n = 0; const need = new Set<number>(); const L = left.filter((t) => t >= 0);
	for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
		const x = L[a], y = L[b], cx = tcol(x), vx = tval(x), cy = tcol(y), vy = tval(y);
		if (vx === vy && cx !== cy) { n++; for (let k = 0; k < 4; k++) if (k !== cx && k !== cy) need.add(k * 13 + vx - 1); }
		else if (cx === cy && vx !== vy) {
			const lo = Math.min(vx, vy), hi = Math.max(vx, vy);
			let g = hi - lo; if (lo === 1) g = Math.min(g, 14 - hi);
			if (g === 1) {
				n++;
				if (hi - lo === 1) { if (lo > 1) need.add(cx * 13 + lo - 2); need.add(cx * 13 + (hi % 13)); }
				else need.add(cx * 13 + 11);
			} else if (g === 2) { n++; const mid = hi - lo === 2 ? lo + 1 : 13; need.add(cx * 13 + mid - 1); }
		}
	}
	return [n, need];
}
function extendsOf(sets: Set_[], need: Set<number>) {
	for (const s of sets) {
		const real = s.filter((t) => t >= 0); if (!real.length) continue;
		const cols = new Set(real.map(tcol)), vals = [...new Set(real.map(tval))].sort((a, b) => a - b);
		const groupLike = vals.length === 1 && cols.size === real.length, runLike = cols.size === 1;
		if (groupLike && s.length < 4) for (let k = 0; k < 4; k++) if (!cols.has(k)) need.add(k * 13 + vals[0] - 1);
		if (runLike && (real.length === 1 || !groupLike)) {
			const col = tcol(real[0]);
			if (real.length > 1 && vals.length === 1) continue;
			let lo = vals[0]; const hi = vals[vals.length - 1];
			const topOne = vals.includes(1) && vals.includes(13) && vals.length < 13;
			if (topOne) { lo = vals.filter((v) => v !== 1)[0]; if (lo > 2) need.add(col * 13 + lo - 2); }
			else { if (lo > 1) need.add(col * 13 + lo - 2); if (hi < 13) need.add(col * 13 + hi); else if (hi === 13) need.add(col * 13); }
		}
	}
}
function isolated(left: number[]): number {
	const L = left.filter((t) => t >= 0); let n = 0;
	for (let a = 0; a < L.length; a++) {
		const x = L[a]; let ok = false;
		for (let b = 0; b < L.length && !ok; b++) {
			if (a === b) continue; const y = L[b];
			if (tval(x) === tval(y) && tcol(x) !== tcol(y)) ok = true;
			else if (tcol(x) === tcol(y) && tval(x) !== tval(y)) {
				let d = Math.abs(tval(x) - tval(y)); if (Math.min(tval(x), tval(y)) === 1) d = Math.min(d, 14 - Math.max(tval(x), tval(y)));
				if (d <= 2) ok = true;
			}
		}
		if (!ok) n++;
	}
	return n;
}
/** Features of a 14-tile hand (after discarding) → returns tiles away from a win (dw). seen: public type counts (discards + gösterge). Must match ai.py. */
export function features(hand: number[], okey: number, seen: number[], pileLeft: number, out = new Float32Array(NF), off = 0): number {
	const [c, w] = counts(hand, okey);
	const dw = 14 - cover(c, w);
	const { sets, left } = solveSets(c, w);
	const pr = pairs(c, w);
	const [np, need] = partials(left);
	const raw = new Array(NT).fill(0); for (const i of hand) raw[ttype(i)]++;
	const ext = new Set<number>(); extendsOf(sets, ext); for (const t of ext) need.add(t);
	let outs = 0, kinds = 0;
	for (const t of need) if (t !== okey) { const u = Math.max(0, 2 - seen[t] - raw[t]); outs += u; if (u > 0) kinds++; }
	outs += Math.max(0, 2 - seen[okey] - raw[okey]);
	const iso = isolated(left);
	const f = [dw / 14, +(dw <= 1), +(dw <= 2), +(dw <= 3), pr / 7, +(pr >= 5), w / 2, Math.min(np, 16) / 8, Math.min(outs, 60) / 40, Math.min(kinds, 30) / 15,
		pileLeft / 48, sets.length / 5, iso / 10, Math.min(ext.size, 20) / 10];
	for (let k = 0; k < NF; k++) out[off + k] = f[k];
	return dw;
}
export const tilesAway = (hand: number[], okey: number) => { const [c, w] = counts(hand, okey); return 14 - Math.max(cover(c, w), pairs(c, w) >= 7 ? 14 : 0); };
