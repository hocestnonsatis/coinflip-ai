// Kedi cat model, forward pass in plain TypeScript (one step per cat-camera frame). Same math as train-cat/train.py and the
// exported ONNX step model: conv(2→8,5×5,s2) → conv(8→16,3×3,s2) → conv(16→16,3×3,s2) → fc → GRU → 3 logits.
// Input = the 64×32 grayscale frame and its difference to the previous frame. Nothing else.
export const FW = 64, FH = 32;
export type Meta = { hid: number; feat: number; arch?: 'gru' | 'belief'; shapes: [string, number[]][] };
export type Weights = Record<string, Float32Array>;

export function unpack(meta: Meta, flat: Float32Array): Weights {
	const w: Weights = {}; let o = 0;
	for (const [name, shape] of meta.shapes) { const n = shape.reduce((a, b) => a * b, 1); w[name] = flat.subarray(o, o + n); o += n; }
	if (o !== flat.length) throw new Error(`weights: expected ${o} floats, got ${flat.length}`);
	return w;
}
export function b64ToF32(b64: string): Float32Array {
	const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
	return new Float32Array(u8.buffer);
}

function conv(x: Float32Array, C: number, H: number, W: number, w: Float32Array, b: Float32Array, O: number, K: number, S: number, P: number) {
	const OH = Math.floor((H + 2 * P - K) / S) + 1, OW = Math.floor((W + 2 * P - K) / S) + 1, y = new Float32Array(O * OH * OW);
	for (let o = 0; o < O; o++) for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
		let s = b[o];
		for (let c = 0; c < C; c++) for (let ky = 0; ky < K; ky++) {
			const iy = oy * S - P + ky; if (iy < 0 || iy >= H) continue;
			const wo = ((o * C + c) * K + ky) * K, xo = (c * H + iy) * W;
			for (let kx = 0; kx < K; kx++) { const ix = ox * S - P + kx; if (ix >= 0 && ix < W) s += w[wo + kx] * x[xo + ix]; }
		}
		y[(o * OH + oy) * OW + ox] = s > 0 ? s : 0;
	}
	return { y, H: OH, W: OW };
}
const sig = (v: number) => 1 / (1 + Math.exp(-v));

/** Recurrent state: GRU memory h, and (belief arch) the log-belief over the 3 slots. */
export type State = { h: Float32Array; lb: Float32Array };
export const initState = (meta: Meta): State => ({ h: new Float32Array(meta.hid), lb: new Float32Array(3).fill(-Math.log(3)) });
const lse = (a: number[]) => { const m = Math.max(...a); return m + Math.log(a.reduce((s, v) => s + Math.exp(v - m), 0)); };

/** One step: frame (+ previous frame, null at the start) and state → new state and P(slot 0..2). */
export function step(w: Weights, meta: Meta, frame: Uint8Array, prev: Uint8Array | null, st: State): { st: State; p: Float32Array } {
	const h = st.h;
	const n = FW * FH, x = new Float32Array(2 * n), pv = prev ?? frame;
	for (let i = 0; i < n; i++) { const a = frame[i] / 255; x[i] = (a - 0.4) * 3; x[n + i] = (a - pv[i] / 255) * 6; }
	let r = conv(x, 2, FH, FW, w['c1.weight'], w['c1.bias'], 8, 5, 2, 2);
	r = conv(r.y, 8, r.H, r.W, w['c2.weight'], w['c2.bias'], 16, 3, 2, 1);
	r = conv(r.y, 16, r.H, r.W, w['c3.weight'], w['c3.bias'], 16, 3, 2, 1);
	const F = meta.feat, Hd = meta.hid, fin = r.y.length, f = new Float32Array(F);
	for (let j = 0; j < F; j++) { let s = w['fc.bias'][j]; const o = j * fin; for (let i = 0; i < fin; i++) s += w['fc.weight'][o + i] * r.y[i]; f[j] = s > 0 ? s : 0; }
	// GRU (PyTorch gate order r, z, n)
	const Wi = w['gru.weight_ih_l0'], Wh = w['gru.weight_hh_l0'], bi = w['gru.bias_ih_l0'], bh = w['gru.bias_hh_l0'];
	const gi = new Float32Array(3 * Hd), gh = new Float32Array(3 * Hd);
	for (let k = 0; k < 3 * Hd; k++) { let a = bi[k], c = bh[k]; for (let i = 0; i < F; i++) a += Wi[k * F + i] * f[i]; for (let i = 0; i < Hd; i++) c += Wh[k * Hd + i] * h[i]; gi[k] = a; gh[k] = c; }
	const h2 = new Float32Array(Hd);
	for (let j = 0; j < Hd; j++) { const rr = sig(gi[j] + gh[j]), z = sig(gi[Hd + j] + gh[Hd + j]), nn = Math.tanh(gi[2 * Hd + j] + rr * gh[2 * Hd + j]); h2[j] = (1 - z) * nn + z * h[j]; }
	const K = meta.arch === 'belief' ? 12 : 3, o = new Float32Array(K);
	for (let k = 0; k < K; k++) { let s = w['head.bias'][k]; for (let j = 0; j < Hd; j++) s += w['head.weight'][k * Hd + j] * h2[j]; o[k] = s; }
	let lb: Float32Array;
	if (meta.arch === 'belief') {
		// b ∝ (b · T) ⊙ exp(e): T rows = from-slot, softmax over to-slot; all in log space
		const lt = [0, 1, 2].map((i) => { const row = [o[3 * i], o[3 * i + 1], o[3 * i + 2]], z = lse(row); return row.map((v) => v - z); });
		const nb = [0, 1, 2].map((j) => lse([0, 1, 2].map((i) => st.lb[i] + lt[i][j])) + o[9 + j]), z = lse(nb);
		lb = Float32Array.from(nb, (v) => v - z);
	} else { const z = lse(Array.from(o)); lb = Float32Array.from(o, (v) => v - z); }
	return { st: { h: h2, lb }, p: Float32Array.from(lb, (v) => Math.exp(v)) };
}
export const paramCount = (meta: Meta) => meta.shapes.reduce((a, [, s]) => a + s.reduce((x, y) => x * y, 1), 0);
