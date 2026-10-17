// Okey value net inference: ONNX Runtime Web (static/model/okey-*.onnx) with a TypeScript fallback (same weights).
// 1-ply: every candidate discard (and, for the draw decision, every discard after taking the top tile) is featurised
// and scored in ONE session.run; the bot keeps the hand with the highest estimated P(win).
import type * as ORT from 'onnxruntime-web';
import { createSession, loadOrt, type Backend } from './engine';
import { NF } from './okey-engine';
import { MODEL_URL } from './okey-weights';
import { forwardTs } from './okey-net';
import { chooseDraw as cd, chooseDiscard as cx } from './okey-bot';
import type { OkeyGame } from './okey-game';
import { why } from './why';
export { forwardTs };
let session: ORT.InferenceSession | null = null, ort: typeof ORT | null = null, loading: Promise<Backend> | null = null;
async function runOrt(s: ORT.InferenceSession, o: typeof ORT, x: Float32Array, n: number) { return (await s.run({ x: new o.Tensor('float32', x, [n, NF]) })).p.data as Float32Array; }
export function loadOkeyEngine(): Promise<Backend> {
	return (loading ??= (async () => {
		try {
			ort = await loadOrt();
			const probe = Float32Array.from({ length: NF }, (_, i) => ((i * 7) % 5) / 5);
			const r = await createSession(MODEL_URL, async (s, o) => { const p = await runOrt(s, o, probe, 1); if (Math.abs(p[0] - forwardTs(probe, 1)[0]) > 1e-4) throw new Error('mismatch'); });
			if (r) { session = r.session; return r.backend; }
		} catch (e) { console.info(`[okey] ORT unavailable, using TS math (${why(e)})`); }
		return 'ts';
	})());
}
export async function evaluate(x: Float32Array, n: number): Promise<Float32Array> {
	if (session && ort) { try { return await runOrt(session, ort, x, n); } catch (e) { console.info(`[okey] run failed (${why(e)})`); } }
	return forwardTs(x, n);
}
export const chooseDraw = (g: OkeyGame, s: number) => cd(g, s, evaluate);
export const chooseDiscard = (g: OkeyGame, s: number) => cx(g, s, evaluate);
