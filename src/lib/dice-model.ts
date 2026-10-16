// DiceRoll-6P: six parameters (one bias per face) → softmax over 6 faces.
// Input: 6 Gumbel samples g_i = -ln(-ln u_i), u_i = hash(hold time ⊕ crypto jitter_i). Equal biases ⇒ argmax uniform.
import { hashU } from '#lib/model';

export const FACES = 6;
/** The six "learned" parameters. Hand-tuned for fairness. (They are all the same. That's the point.) */
export const BIAS: readonly number[] = Object.freeze([1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);
export const TEMP = 1.0;
const P_RARE = 1 / 10000;

export function softmax(x: ArrayLike<number>): number[] {
	let m = -Infinity; for (let i = 0; i < x.length; i++) m = Math.max(m, x[i]);
	const e = Array.from(x, (v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0);
	return e.map((v) => v / s);
}
export const logitsOf = (g: ArrayLike<number>) => Array.from(g, (v, i) => (v + BIAS[i]) * TEMP);

const words = new Uint32Array(FACES + 1);
export function gumbels(holdMs: number, jitter?: Uint32Array) {
	const j = jitter ?? (crypto.getRandomValues(words), words);
	const g = new Float32Array(FACES);
	for (let i = 0; i < FACES; i++) g[i] = -Math.log(-Math.log(hashU(holdMs, j[i], i)));
	return { g, rare: hashU(holdMs, j[FACES], 99) < P_RARE };
}
export type DiceResult = { g: Float32Array; p: number[]; face: number; confidence: number; rare: boolean };
export function finish(g: Float32Array, p: number[], rare: boolean): DiceResult {
	let k = 0; for (let i = 1; i < FACES; i++) if (g[i] > g[k]) k = i; // decision from the hashed noise (= argmax p)
	return { g, p, face: k + 1, confidence: p[k], rare };
}
export function inferDice(holdMs: number): DiceResult {
	const { g, rare } = gumbels(holdMs);
	return finish(g, softmax(logitsOf(g)), rare);
}
