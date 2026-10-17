// DiceRoll-6P on ONNX Runtime Web (static/model/diceroll-6p.onnx), silent TS fallback.
import type * as ORT from 'onnxruntime-web';
import { createSession, loadOrt, timeBatch, type Backend } from './engine';
import { logitsOf, softmax } from './dice-model';
import { why } from './why';

let session: ORT.InferenceSession | null = null;
let ort: typeof ORT | null = null;
let loading: Promise<Backend> | null = null;

async function runWith(s: ORT.InferenceSession, o: typeof ORT, g: Float32Array): Promise<number[]> {
	const out = await s.run({ g: new o.Tensor('float32', g, [1, 6]) });
	return Array.from(out.p.data as Float32Array);
}
const probe = Float32Array.of(0.3, -0.2, 1.1, 0.0, -1.0, 0.5);

export function loadDiceEngine(): Promise<Backend> {
	return (loading ??= (async () => {
		try {
			ort = await loadOrt();
			const r = await createSession('/model/diceroll-6p.onnx', async (s, o) => {
				const p = await runWith(s, o, probe), ref = softmax(logitsOf(probe));
				if (p.some((v, i) => Math.abs(v - ref[i]) > 1e-4)) throw new Error('mismatch');
			});
			if (r) { session = r.session; return r.backend; }
		} catch (e) { console.info(`[dice-engine] ORT unavailable, using TS math (${why(e)})`); }
		return 'ts';
	})());
}
/** p over 6 faces from ONNX Runtime if loaded, otherwise TS. */
export async function runDice(g: Float32Array): Promise<number[]> {
	if (session && ort) { try { return await runWith(session, ort, g); } catch (e) { console.info(`[dice-engine] run failed (${why(e)})`); } }
	return softmax(logitsOf(g));
}
export async function benchDice(): Promise<number | null> {
	if (!session || !ort) return null;
	const s = session, o = ort, g = new Float32Array(6);
	return timeBatch((i) => { g[i % 6] = ((i % 13) - 6) / 6; return runWith(s, o, g); });
}
