// Tavla-1.6K forward pass in plain TS (fallback when ONNX Runtime is unavailable). 198 → 8 sigmoid → 1 sigmoid.
import { W1, B1, W2, B2 } from '#lib/tavla-weights';
const H = 8, IN = 198;
const sig = (z: number) => 1 / (1 + Math.exp(-z));
/** TS forward pass over N encoded positions (N×198) → N probabilities. */
export function forwardTs(x: Float32Array, n: number): Float32Array {
	const out = new Float32Array(n), h = new Float64Array(H);
	for (let r = 0; r < n; r++) {
		h.set(B1);
		for (let i = 0; i < IN; i++) { const v = x[r * IN + i]; if (v !== 0) for (let j = 0; j < H; j++) h[j] += v * W1[i * H + j]; }
		let o = B2; for (let j = 0; j < H; j++) o += sig(h[j]) * W2[j];
		out[r] = sig(o);
	}
	return out;
}
