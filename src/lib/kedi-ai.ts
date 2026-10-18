// The cat's brain at play time: one model step per cat-camera frame, strictly in order. ONNX Runtime Web (WebGPU → WASM) on
// static/model/kedi-*.onnx if it loads and matches the TS math on a probe, otherwise the TS forward pass (same weights).
// Input: camera frames only (Uint8Array 64×32). This module knows nothing about cups, swaps or the game.
import type * as ORT from 'onnxruntime-web';
import { createSession, loadOrt, type Backend } from './engine';
import { MODEL_URL, META, B64 } from './kedi-weights';
import { step, unpack, b64ToF32, initState, FW, FH, type Weights, type State } from './kedi-net';
import { why } from './why';

let W: Weights | null = null;
const weights = () => (W ??= unpack(META, b64ToF32(B64)));
let session: ORT.InferenceSession | null = null, ort: typeof ORT | null = null, loading: Promise<Backend> | null = null;
const N = FW * FH;
const toF = (f: Uint8Array) => { const x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = f[i] / 255; return x; };
async function runOrt(s: ORT.InferenceSession, o: typeof ORT, f: Uint8Array, prev: Uint8Array, st: State): Promise<{ st: State; p: Float32Array }> {
	const r = await s.run({ x: new o.Tensor('float32', toF(f), [1, 1, FH, FW]), prev: new o.Tensor('float32', toF(prev), [1, 1, FH, FW]), h: new o.Tensor('float32', st.h, [1, META.hid]), lb: new o.Tensor('float32', st.lb, [1, 3]) });
	return { p: Float32Array.from(r.p.data as Float32Array), st: { h: Float32Array.from(r.h1.data as Float32Array), lb: Float32Array.from(r.lb1.data as Float32Array) } };
}
export function loadKediEngine(): Promise<Backend> {
	return (loading ??= (async () => {
		try {
			ort = await loadOrt();
			const a = Uint8Array.from({ length: N }, (_, i) => (i * 37) % 251), b = Uint8Array.from({ length: N }, (_, i) => (i * 11) % 241), s0 = initState(META);
			const ref = step(weights(), META, b, a, s0).p;
			const r = await createSession(MODEL_URL, async (s, o) => { const q = (await runOrt(s, o, b, a, s0)).p; if (Math.max(...q.map((v, k) => Math.abs(v - ref[k]))) > 1e-4) throw new Error('mismatch'); });
			if (r) { session = r.session; return r.backend; }
		} catch (e) { console.info(`[kedi] ORT unavailable, using TS math (${why(e)})`); }
		return 'ts';
	})());
}

/** Recurrent belief over one round: reset() when the toy is hidden, then push() every camera frame. */
export class Brain {
	st: State = initState(META); prev: Uint8Array | null = null; p: Float32Array = Float32Array.of(1 / 3, 1 / 3, 1 / 3); n = 0; ms = 0;
	private q: Promise<void> = Promise.resolve(); private gen = 0;
	reset() { this.gen++; this.st = initState(META); this.prev = null; this.p = Float32Array.of(1 / 3, 1 / 3, 1 / 3); this.n = 0; this.ms = 0; this.q = Promise.resolve(); }
	push(frame: Uint8Array, done?: (p: Float32Array) => void) {
		const g = this.gen;
		this.q = this.q.then(async () => {
			if (g !== this.gen) return;
			const t0 = performance.now(); let r: { p: Float32Array; st: State } | null = null;
			if (session && ort) { try { r = await runOrt(session, ort, frame, this.prev ?? frame, this.st); } catch (e) { console.info(`[kedi] run failed, using TS (${why(e)})`); session = null; } }
			if (!r) r = step(weights(), META, frame, this.prev, this.st);
			if (g !== this.gen) return;
			this.st = r.st; this.p = r.p; this.prev = frame; this.n++; this.ms += performance.now() - t0;
			done?.(r.p);
		});
	}
	/** Resolves when every pushed frame has been processed. */
	idle() { return this.q; }
}
