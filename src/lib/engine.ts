// Real inference engine: ONNX Runtime Web running static/model/coinflip-1p.onnx (one Mul by one weight).
// ORT is loaded lazily from jsDelivr (pinned) because its WebGPU wasm (~27 MB) exceeds the 25 MiB Workers asset limit.
// Any failure → silent fallback to the TS math in model.ts.
import type * as ORT from 'onnxruntime-web';
import { sigmoid, WEIGHT } from './model';

export const ORT_VERSION = '1.30.0';
const CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
export type Backend = 'ts' | 'webgpu' | 'wasm';

let session: ORT.InferenceSession | null = null;
let ort: typeof ORT | null = null;
export let backend: Backend = 'ts';
let loading: Promise<Backend> | null = null;

export function loadEngine(): Promise<Backend> {
	return (loading ??= (async () => {
		try {
			ort = (await import(/* @vite-ignore */ `${CDN}ort.webgpu.min.mjs`)) as typeof ORT;
			ort.env.wasm.wasmPaths = CDN;
			ort.env.wasm.numThreads = 1;
			ort.env.logLevel = 'error';
			const model = new Uint8Array(await (await fetch('/model/coinflip-1p.onnx')).arrayBuffer());
			const eps: Backend[] = 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];
			for (const ep of eps) {
				try {
					const s = await ort.InferenceSession.create(model, { executionProviders: [ep] });
					const p = await runWith(s, 0.1);
					if (Math.abs(p - sigmoid(WEIGHT * 0.1 * 10)) > 1e-4) throw new Error('mismatch');
					const t0 = performance.now(); await runWith(s, -0.1);
					if (ep === 'webgpu' && performance.now() - t0 > 50) throw new Error('software GPU too slow'); // e.g. SwiftShader
					session = s; backend = ep; return ep;
				} catch (e) { console.info(`[engine] ${ep} unavailable`, e); }
			}
		} catch (e) { console.info('[engine] ORT unavailable, using TS math', e); }
		return (backend = 'ts');
	})());
}

async function runWith(s: ORT.InferenceSession, z: number): Promise<number> {
	const out = await s.run({ z: new ort!.Tensor('float32', Float32Array.of(z), [1]) });
	return (out.p.data as Float32Array)[0];
}

/** p = σ(w·z·10) from ONNX Runtime if loaded, otherwise TS. */
export async function runP(z: number): Promise<number> {
	if (session) { try { return await runWith(session, z); } catch (e) { console.info('[engine] run failed', e); } }
	return sigmoid(WEIGHT * z * 10);
}

/** Average ms per real session.run over n calls (null if no session). */
export async function bench(n = 8): Promise<number | null> {
	if (!session) return null;
	const t0 = performance.now();
	let i = 0; // up to n runs, but never stall the flip for more than ~120 ms (slow/software GPUs)
	do await runWith(session, (i - n / 2) / n); while (++i < n && performance.now() - t0 < 120);
	return Math.max((performance.now() - t0) / i, 0.0001);
}
