import { infer, P_EDGE } from '../src/lib/model.ts';
function run(name: string, gen: (i: number) => number, N = 1_000_000) {
	let h = 0, e = 0;
	for (let i = 0; i < N; i++) { const r = infer(gen(i)).result; if (r === 'yazi') h++; else if (r === 'dik') e++; }
	const heads = h / (N - e), edge = e / N;
	console.log(`${name}: N=${N} heads=${heads.toFixed(4)} edge=${edge.toExponential(3)} (1/${(1 / edge).toFixed(0)}, expect 1/${1 / P_EDGE})`);
	if (Math.abs(heads - 0.5) > 0.003 || Math.abs(edge - P_EDGE) > 6 * Math.sqrt(P_EDGE / N)) throw new Error(name + ' FAILED');
}
run('integer-ms 50..3000', (i) => 50 + (i % 2951));
run('sub-ms', (i) => 50 + Math.random() * 2950);
console.log('OK');

// Scale: p = σ(w·z·SCALE), decision = sign(z) outside the edge band; confidence spread
import { SCALE, sigmoid, WEIGHT } from '../src/lib/model.ts';
{
	const cs: number[] = [];
	for (let i = 0; i < 200_000; i++) {
		const o = infer(100 + i);
		if (Math.abs(o.p - sigmoid(WEIGHT * o.z * SCALE)) > 1e-12) throw new Error('p mismatch');
		if (o.trit !== 0 && o.trit !== Math.sign(o.z)) throw new Error('decision != sign(z)');
		if (o.trit !== 0) cs.push(o.confidence);
	}
	cs.sort((a, b) => a - b);
	const q = (x: number) => cs[Math.floor(x * (cs.length - 1))];
	console.log(`confidence (SCALE=${SCALE}): p10=${q(0.1).toFixed(3)} p25=${q(0.25).toFixed(3)} p50=${q(0.5).toFixed(3)} p75=${q(0.75).toFixed(3)} p90=${q(0.9).toFixed(3)}`);
	if (q(0.1) < 0.52 || q(0.9) > 0.96 || q(0.5) < 0.65 || q(0.5) > 0.8) throw new Error('confidence spread out of range');
	console.log('OK scale');
}
