// Tavla dice fairness: 1e6 rolls through the exact functions the game uses (crypto.getRandomValues + rejection sampling).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollDie, rollPair, openingRoll } from '../src/lib/tavla-dice.ts';
const N = 1_000_000;
const chi = (obs: number[], exp: number[]) => obs.reduce((s, o, i) => s + (o - exp[i]) ** 2 / exp[i], 0);
// faces: chi²(5) 99.9% critical = 20.52
const f = new Array(6).fill(0); for (let i = 0; i < N; i++) f[rollDie() - 1]++;
const c1 = chi(f, f.map(() => N / 6));
console.log(`faces N=${N}: [${f.map((x) => (x / N).toFixed(4)).join(', ')}] chi²(5)=${c1.toFixed(2)} (<20.52)`); assert.ok(c1 < 20.52);
// ordered pairs: 36 cells, chi²(35) 99.9% critical = 66.62; doubles ≈ 1/6
const p = new Array(36).fill(0); let dbl = 0;
for (let i = 0; i < N; i++) { const [a, b] = rollPair(); p[(a - 1) * 6 + b - 1]++; if (a === b) dbl++; }
const c2 = chi(p, p.map(() => N / 36)), sd = Math.sqrt((1 / 6) * (5 / 6) / N);
console.log(`pairs N=${N}: chi²(35)=${c2.toFixed(2)} (<66.62) · doubles=${(dbl / N).toFixed(4)} (1/6=0.1667 ±${(5 * sd).toFixed(4)})`);
assert.ok(c2 < 66.62); assert.ok(Math.abs(dbl / N - 1 / 6) < 5 * sd);
// opening roll: never a tie in the decisive attempt; human starts ≈ 1/2; the 30 non-tie pairs equally likely (chi²(29) 99.9% = 58.30)
const M = 300_000, op = new Array(36).fill(0); let human = 0, tries = 0;
for (let i = 0; i < M; i++) { const t = openingRoll(); const [a, b] = t[t.length - 1]; assert.notEqual(a, b); t.slice(0, -1).forEach(([x, y]) => assert.equal(x, y)); op[(a - 1) * 6 + b - 1]++; if (a > b) human++; tries += t.length; }
const nz = op.filter((_, i) => i % 7 !== 0), c3 = chi(nz, nz.map(() => M / 30)), sh = Math.sqrt(0.25 / M);
console.log(`opening N=${M}: human starts ${(human / M).toFixed(4)} (0.5 ±${(5 * sh).toFixed(4)}) · chi²(29)=${c3.toFixed(2)} (<58.30) · avg attempts ${(tries / M).toFixed(3)} (expect 1.2)`);
assert.ok(Math.abs(human / M - 0.5) < 5 * sh); assert.ok(c3 < 58.3);
// The game must use only these functions for dice (no Math.random in dice paths).
const app = readFileSync(new URL('../src/lib/TavlaApp.svelte', import.meta.url), 'utf8');
assert.ok(!/Math\.random\(\)\s*\*\s*6\b/.test(app) && !/rnd\(/.test(app)); assert.ok(app.includes('rollPair()') && app.includes('openingRoll()'));
console.log('tavla dice ok');
