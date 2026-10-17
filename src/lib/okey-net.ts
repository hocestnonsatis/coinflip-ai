// Okey value net forward pass in plain TS (fallback when ONNX Runtime is unavailable). NF → NH tanh → 1 sigmoid.
import { NF, NH } from '#lib/okey-engine';
import { W1, B1, W2, B2 } from '#lib/okey-weights';
export function forwardTs(x: Float32Array, n: number): Float32Array {
	const out = new Float32Array(n);
	for (let r = 0; r < n; r++) {
		let o = B2;
		for (let j = 0; j < NH; j++) { let z = B1[j]; for (let i = 0; i < NF; i++) z += W1[j * NF + i] * x[r * NF + i]; o += W2[j] * Math.tanh(z); }
		out[r] = 1 / (1 + Math.exp(-o));
	}
	return out;
}
