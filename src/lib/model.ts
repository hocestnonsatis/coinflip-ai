// CoinFlip-1P b1.58: one ternary weight, w ∈ {-1, 0, +1} (log2(3) ≈ 1.58 bit). BitNet b1.58 compatible™.
export type Trit = -1 | 0 | 1;
export const WEIGHT: Trit = 1; // quantized from 0.4271 via round(clip(w/mean|w|)) — the only result possible
export const BITS = Math.log2(3);

export function cryptoUniform(): number {
	const u = new Uint32Array(1); crypto.getRandomValues(u);
	return (u[0] + 0.5) / 4294967296;
}
export function cryptoNormal(): number {
	const a = cryptoUniform(), b = cryptoUniform();
	return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); // Box–Muller
}
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// Inverse standard normal CDF (Acklam's approximation)
function probit(p: number): number {
	const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
	const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
	const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
	const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
	const pl = 0.02425;
	if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
	if (p > 1 - pl) return -probit(1 - p);
	const q = p - 0.5, r = q * q;
	return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** US nickel: 21.21 mm × 1.95 mm (the coin Murray & Teare 1993 studied) → P(edge) ≈ 1/6000. */
export const COIN_DIAMETER_MM = 21.21, COIN_THICKNESS_MM = 1.95;
export const P_EDGE = 1 / 6000;

export type Side = 'yazi' | 'tura' | 'dik';
/** Hold duration (ms, sub-ms jitter) → uniform u → z. Deterministic in the hold; jitter makes it fair. */
export const HOLD_K = 7919.0001; // prime-ish "learned" scaling constant
export function holdToU(holdMs: number): number {
	const x = holdMs * HOLD_K;
	const u = x - Math.floor(x);
	return Math.min(1 - 1e-12, Math.max(1e-12, u));
}
export function infer(holdMs: number) {
	const pEdge = P_EDGE;
	const tau = probit(0.5 + pEdge / 2); // P(|z| < tau) = pEdge  ⇔  u ∈ narrow band around 0.5
	const u = holdToU(holdMs);
	const z = probit(u);
	const a = WEIGHT * z;
	const trit: Trit = Math.abs(a) < tau ? 0 : a > 0 ? 1 : -1;
	const p = sigmoid(a * 10);
	const confidence = trit === 0 ? 1 - Math.abs(a) / tau : Math.max(p, 1 - p);
	const result: Side = trit === 1 ? 'yazi' : trit === -1 ? 'tura' : 'dik';
	return { u, z, a, p, tau, trit, pEdge, result, confidence };
}
