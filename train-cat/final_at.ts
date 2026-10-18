// For eval_stick.py: final cup order (at[slot] = cup id) of the pure grid rounds rendered by cdp-kedi-datagen.mjs.
// node --experimental-strip-types train-cat/final_at.ts <seed0> <n> <GRID>
import { randomEpisode, pose } from '../src/lib/kedi-anim.ts';
const [s0, n, G] = process.argv.slice(2);
const [a, b] = G.split(':').map((x) => x.split(',').map(Number)); const grid = a.flatMap((k) => b.map((sp) => ({ n: k, sp })));
const out: Record<number, number[]> = {};
for (let i = 0; i < +n; i++) { const seed = +s0 + i, g = grid[i % grid.length], ep = randomEpisode(seed, { pure: true, maxSwaps: g.n, speed: g.sp }); out[seed] = pose(ep.ev, ep.end).at; }
console.log(JSON.stringify(out));
