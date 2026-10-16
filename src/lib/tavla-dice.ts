// Tavla dice: crypto.getRandomValues + rejection sampling (no modulo bias, no Math.random, no seed, no game/model input).
// The same function rolls for the human, the model and the opening roll.
const buf = new Uint8Array(64);
let pos = buf.length;
/** Uniform integer 1..6. Bytes ≥ 252 are rejected so 252 = 42·6 values map evenly onto 6 faces. */
export function rollDie(): number {
	for (;;) {
		if (pos >= buf.length) { crypto.getRandomValues(buf); pos = 0; }
		const v = buf[pos++];
		if (v < 252) return (v % 6) + 1;
	}
}
export const rollPair = (): [number, number] => [rollDie(), rollDie()];
/** Opening roll: each side rolls one die, ties are re-rolled (standard rules). Returns every attempt (last one decides; d[0] = human). */
export function openingRoll(): [number, number][] {
	const tries: [number, number][] = [];
	for (;;) { const t = rollPair(); tries.push(t); if (t[0] !== t[1]) return tries; }
}
