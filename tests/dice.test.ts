import { inferDice, softmax, logitsOf, BIAS, FACES } from '../src/lib/dice-model.ts';
function run(name: string, gen: (i: number) => number, N = 1_000_000) {
	const c = new Array(FACES + 1).fill(0); let rare = 0;
	for (let i = 0; i < N; i++) { const r = inferDice(gen(i)); c[r.face]++; if (r.rare) rare++; }
	const fr = c.slice(1).map((x) => x / N), sd = Math.sqrt((1 / 6) * (5 / 6) / N);
	console.log(`${name}: N=${N} faces=[${fr.map((x) => x.toFixed(4)).join(', ')}] (expect 0.1667 ±${(sd * 5).toFixed(4)}) rare=${rare} (1/${Math.round(N / Math.max(rare, 1))}, expect ~1/10000)`);
	if (fr.some((x) => Math.abs(x - 1 / 6) > 5 * sd)) throw new Error(name + ' faces not uniform');
	if (Math.abs(rare - N / 10000) > 6 * Math.sqrt(N / 10000)) throw new Error(name + ' rare rate off');
	// chi-square, 5 dof: 99.9% critical value 20.5
	const chi = c.slice(1).reduce((s, x) => s + (x - N / 6) ** 2 / (N / 6), 0);
	console.log(`  chi²(5) = ${chi.toFixed(2)} (< 20.5)`); if (chi > 20.5) throw new Error('chi² too large');
}
run('integer-ms 50..3000', (i) => 50 + (i % 2951));
run('sub-ms', (i) => 50 + Math.random() * 2950);
// softmax / decision consistency + confidence spread
{
	const cs: number[] = [];
	for (let i = 0; i < 100_000; i++) {
		const r = inferDice(100 + i);
		const ref = softmax(logitsOf(r.g));
		if (r.p.some((v, k) => Math.abs(v - ref[k]) > 1e-12)) throw new Error('p mismatch');
		if (r.p.indexOf(Math.max(...r.p)) + 1 !== r.face) throw new Error('face != argmax p');
		cs.push(r.confidence);
	}
	cs.sort((a, b) => a - b); const q = (x: number) => cs[Math.floor(x * (cs.length - 1))].toFixed(3);
	console.log(`confidence: p10=${q(0.1)} p50=${q(0.5)} p90=${q(0.9)}; params=${BIAS.length}`);
	if (BIAS.length !== 6) throw new Error('must have 6 params');
}
console.log('OK dice');
