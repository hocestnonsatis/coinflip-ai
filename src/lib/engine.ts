// Real inference engine: ONNX Runtime Web running static/model/coinflip-1p.onnx (one Mul by one weight).
// ORT is loaded lazily from jsDelivr (pinned) because its WebGPU wasm (~27 MB) exceeds the 25 MiB Workers asset limit.
// Any failure → silent fallback to the TS math in model.ts.
import type * as ORT from 'onnxruntime-web';
import { sigmoid, WEIGHT, SCALE } from './model';

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
					if (Math.abs(p - sigmoid(WEIGHT * 0.1 * SCALE)) > 1e-4) throw new Error('mismatch');
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

/** p = σ(w·z·1.5) from ONNX Runtime if loaded, otherwise TS. */
export async function runP(z: number): Promise<number> {
	if (session) { try { return await runWith(session, z); } catch (e) { console.info('[engine] run failed', e); } }
	return sigmoid(WEIGHT * z * SCALE);
}

/** Run fn repeatedly until ≥minMs elapsed (cap maxRuns / maxMs) → ms per run. Batching beats coarse (0.1 ms) timers. */
export async function timeBatch(fn: (i: number) => unknown, minMs = 50, maxRuns = 200, maxMs = 150): Promise<number> {
	const t0 = performance.now();
	let i = 0, el = 0;
	do { await fn(i); el = performance.now() - t0; } while (++i < maxRuns && el < minMs && el < maxMs);
	return Math.max(el / i, 1e-6);
}
/** Average ms per real session.run (null if no session). */
export async function bench(): Promise<number | null> {
	if (!session) return null;
	const s = session;
	return timeBatch((i) => runWith(s, ((i % 17) - 8) / 8));
}
