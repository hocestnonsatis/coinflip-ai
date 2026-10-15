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
