// Tavla-1.6K inference: ONNX Runtime Web (static/model/tavla-1.6k.onnx) with a silent TypeScript fallback (same weights).
// 1-ply search: every legal play is encoded and scored in ONE session.run; the model picks the max P(win).
import type * as ORT from 'onnxruntime-web';
import { createSession, loadOrt, type Backend } from './engine';
import { encode, legalPlays, type Board, type Play } from './tavla-engine';
import { forwardTs } from './tavla-net';
export { forwardTs };
const IN = 198;

let session: ORT.InferenceSession | null = null, ort: typeof ORT | null = null, loading: Promise<Backend> | null = null;
async function runOrt(s: ORT.InferenceSession, o: typeof ORT, x: Float32Array, n: number) {
	const out = await s.run({ x: new o.Tensor('float32', x, [n, IN]) });
	return out.p.data as Float32Array;
}
export function loadTavlaEngine(): Promise<Backend> {
	return (loading ??= (async () => {
		try {
			ort = await loadOrt();
			const probe = encode([2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, -2, 0, 0, 0, 0]);
			const r = await createSession('/model/tavla-1.6k.onnx', async (s, o) => {
				const p = await runOrt(s, o, probe, 1);
				if (Math.abs(p[0] - forwardTs(probe, 1)[0]) > 1e-4) throw new Error('mismatch');
			});
			if (r) { session = r.session; return r.backend; }
		} catch (e) { console.info('[tavla] ORT unavailable, using TS math', e); }
		return 'ts';
	})());
}
/** P(win for the player who just moved) for each board (boards in that player's view). */
export async function evaluate(boards: Board[]): Promise<Float32Array> {
	const n = boards.length, x = new Float32Array(n * IN);
	boards.forEach((b, i) => encode(b, x, i * IN));
	if (session && ort) { try { return await runOrt(session, ort, x, n); } catch (e) { console.info('[tavla] run failed', e); } }
	return forwardTs(x, n);
}
export type Choice = { play: Play; p: number; n: number; ms: number };
/** Pick the model's play for board b (model's view) and dice. */
export async function choose(b: Board, d1: number, d2: number): Promise<Choice> {
	const plays = legalPlays(b, d1, d2);
	const t0 = performance.now();
	const v = await evaluate(plays.map((p) => p.board));
	const ms = performance.now() - t0;
	let k = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[k]) k = i;
	const won = plays[k].board[26] === 15;
	return { play: plays[k], p: won ? 1 : v[k], n: plays.length, ms };
}
