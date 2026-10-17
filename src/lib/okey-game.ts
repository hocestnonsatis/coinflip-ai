// Okey table state (4 seats, play order 0 → 1 → 2 → 3; each seat may take the top discard of the previous seat).
// Mirrors train-okey/okey.py Game. Shuffle: crypto.getRandomValues + rejection sampling (no Math.random).
import { ttype, okeyOf, FJ, NT, counts, cover, pairs } from '#lib/okey-engine';

const buf = new Uint32Array(64); let pos = buf.length;
/** Uniform integer in [0, n) without modulo bias. */
export function randInt(n: number): number {
	const lim = Math.floor(0x1_0000_0000 / n) * n;
	for (;;) { if (pos >= buf.length) { crypto.getRandomValues(buf); pos = 0; } const v = buf[pos++]; if (v < lim) return v % n; }
}
export type Finish = { kind: 'sets' | 'cift'; okeyDiscard: boolean };

export class OkeyGame {
	hands: number[][] = [[], [], [], []];
	pile: number[];
	discards: number[][] = [[], [], [], []];
	gosterge: number; okey: number; dealer: number; turn: number;
	winner: number | null = null; finish: Finish | null = null; turns = 0;
	seen = new Array(NT).fill(0);
	constructor(dealer = randInt(4), rand = randInt) {
		const ids = Array.from({ length: 106 }, (_, i) => i);
		for (let i = ids.length - 1; i > 0; i--) { const j = rand(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
		const g = ids.findIndex((i) => ttype(i) !== FJ);
		this.gosterge = ids.splice(g, 1)[0]; this.okey = okeyOf(ttype(this.gosterge));
		this.dealer = dealer; this.turn = dealer;
		for (let s = 0; s < 4; s++) this.hands[s] = ids.splice(ids.length - (s === dealer ? 15 : 14));
		this.pile = ids; this.seen[ttype(this.gosterge)]++;
	}
	prev = (s: number) => (s + 3) % 4;
	top(s: number): number | null { const d = this.discards[this.prev(s)]; return d.length ? d[d.length - 1] : null; }
	needsDraw(s: number) { return this.hands[s].length === 14; }
	drawPile(s: number) { const t = this.pile.pop()!; this.hands[s].push(t); return t; }
	takeDiscard(s: number) { const t = this.discards[this.prev(s)].pop()!; this.seen[ttype(t)]--; this.hands[s].push(t); return t; }
	/** Would discarding `tile` from the 15-tile hand win right now? */
	winWith(s: number, tile: number): Finish | null {
		const h = this.hands[s].slice(); h.splice(h.indexOf(tile), 1);
		const [c, w] = counts(h, this.okey); const okeyDiscard = ttype(tile) === this.okey;
		if (cover(c, w) === 14) return { kind: 'sets', okeyDiscard };
		if (pairs(c, w) >= 7) return { kind: 'cift', okeyDiscard };
		return null;
	}
	discard(s: number, tile: number, finish = false) {
		const f = finish ? this.winWith(s, tile) : null;
		if (finish && !f) throw new Error('not a winning hand');
		this.hands[s].splice(this.hands[s].indexOf(tile), 1); this.turns++;
		if (f) { this.winner = s; this.finish = f; return; }
		this.discards[s].push(tile); this.seen[ttype(tile)]++;
		this.turn = (s + 1) % 4;
	}
	/** Pile exhausted and the seat to move would have to draw → game over without a winner. */
	get exhausted() { return this.winner === null && this.pile.length === 0 && this.needsDraw(this.turn); }
}
