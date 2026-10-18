// Kedi (cups game) timeline: the whole round is a list of timed events, and every pose is a pure function of game time.
// The live game and the training-data generator both render the cat camera from pose(timeline, t_k) at t_k = k / FPS, so the
// frames the model sees while playing are produced exactly like the frames it was trained on.
// Nothing in here is ever given to the model — it only gets the rendered pixels.

export const SLOT_X = [-1.35, 0, 1.35] as const;
export const FPS = 30; // cat-camera sampling rate in game time
export const LIFT_H = 1.25;
export const HIDE_D = 1.9; // lift ↑ 0.55 s, hold, lower ↓ 0.55 s
export const MANUAL_D = 0.55; // one hand-made swap
export type Ev =
	| { k: 'hide'; t: number; d: number; slot: number } // all cups lift, the toy is placed under the cup at `slot`, cups lower
	| { k: 'swap'; t: number; d: number; a: number; b: number; s: 1 | -1 } // cups at slots a and b trade places; s: which passes in front
	| { k: 'lift'; t: number; d: number; slot: number; hold?: boolean }; // reveal: lift one cup (hold = stay up at the end)
export type CupPose = { x: number; y: number; z: number; tilt: number };
export type Pose = { cups: CupPose[]; toy: { x: number; z: number; on: boolean }; at: number[]; toyCup: number };

export const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** Lift profile of a hide/reveal: up, hold, down (0..1). */
export function liftCurve(u: number, upFrac = 0.29): number {
	if (u <= 0 || u >= 1) return 0;
	if (u < upFrac) return smooth(u / upFrac);
	if (u > 1 - upFrac) return smooth((1 - u) / upFrac);
	return 1;
}
/** Swap duration for a speed slider value in [0, 1]: 0.9 s (slow) … 0.15 s (very fast), log-spaced. */
export const swapDur = (speed: number) => 0.9 * Math.pow(0.15 / 0.9, Math.min(1, Math.max(0, speed)));
export const arcR = (a: number, b: number) => (Math.abs(a - b) === 2 ? 1.05 : 0.72);
export const endOf = (ev: Ev[]) => ev.reduce((m, e) => Math.max(m, e.t + e.d), 0);

/** Pose of the three cups (by cup id) and the toy at game time t. Cup i starts at slot i; at[slot] = cup id there. */
export function pose(ev: readonly Ev[], t: number): Pose {
	const at = [0, 1, 2], base = SLOT_X.map((x) => ({ x, y: 0, z: 0, tilt: 0 }));
	let toyCup = -1;
	let cur: CupPose[] = base;
	for (const e of ev) {
		if (t < e.t) break;
		const u = Math.min(1, (t - e.t) / e.d), done = u >= 1;
		if (e.k === 'hide') {
			toyCup = at[e.slot];
			if (!done) { const h = liftCurve(u) * LIFT_H; cur = cur.map((c) => ({ ...c, y: h, tilt: 0 })); }
		} else if (e.k === 'swap') {
			const ca = at[e.a], cb = at[e.b];
			if (done) { at[e.a] = cb; at[e.b] = ca; }
			else {
				const v = ease(u), r = arcR(e.a, e.b) * Math.sin(Math.PI * v), xa = SLOT_X[e.a], xb = SLOT_X[e.b];
				cur = cur.slice();
				cur[slotOf(at, ca)] = { x: xa + (xb - xa) * v, y: 0, z: e.s * r, tilt: 0 };
				cur[slotOf(at, cb)] = { x: xb + (xa - xb) * v, y: 0, z: -e.s * r, tilt: 0 };
			}
		} else if (e.k === 'lift') {
			const h = (e.hold && u > 0.5 ? 1 : liftCurve(u, 0.5)) * LIFT_H * (e.hold ? 1 : 1);
			if (!done || e.hold) { cur = cur.slice(); cur[e.slot] = { x: SLOT_X[e.slot], y: h, z: 0, tilt: 0 }; }
		}
		if (done && e.k !== 'lift') cur = base;
	}
	// cur is indexed by slot (resting order); convert to per-cup poses
	const cups: CupPose[] = [0, 1, 2].map(() => ({ x: 0, y: 0, z: 0, tilt: 0 }));
	for (let s = 0; s < 3; s++) cups[at[s]] = cur[s];
	const tc = toyCup >= 0 ? cups[toyCup] : null;
	return { cups, toy: { x: tc ? tc.x : 0, z: tc ? tc.z : 0, on: toyCup >= 0 }, at: at.slice(), toyCup };
}
function slotOf(at: number[], cup: number) { return at.indexOf(cup); }

/** Ground-truth label for training: the slot whose x is nearest to the toy (the cup it is under). -1 before the hide. */
export function toySlot(p: Pose): number {
	if (!p.toy.on) return -1;
	let best = 0; for (let s = 1; s < 3; s++) if (Math.abs(p.toy.x - SLOT_X[s]) < Math.abs(p.toy.x - SLOT_X[best])) best = s;
	return best;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** n random swaps starting at time t0 (used by the "shuffle ×N" button and by the data generator). */
export function shuffleEvents(r: () => number, n: number, speed: number, t0: number, gap = 0.03): Ev[] {
	const out: Ev[] = []; let t = t0; const d = swapDur(speed);
	for (let i = 0; i < n; i++) {
		const a = Math.floor(r() * 3); let b = Math.floor(r() * 2); if (b >= a) b++;
		out.push({ k: 'swap', t, d, a: Math.min(a, b), b: Math.max(a, b), s: r() < 0.5 ? 1 : -1 });
		t += d + gap;
	}
	return out;
}
export type Episode = { ev: Ev[]; end: number; swaps: number; speed: number; seed: number };
/** A random training round: hide, then a mix of hand-made swaps (with pauses), shuffle bursts and waits. */
export function randomEpisode(seed: number, opts: { maxSwaps?: number; speed?: number; pure?: boolean } = {}): Episode {
	const r = rng(seed), ev: Ev[] = [];
	ev.push({ k: 'hide', t: 0, d: HIDE_D, slot: Math.floor(r() * 3) });
	if (opts.pure) { // evaluation grid: exactly n swaps back to back at one speed (like one press of "shuffle ×n")
		const n = opts.maxSwaps ?? 0, sp = opts.speed ?? 0.5; ev.push(...shuffleEvents(r, n, sp, HIDE_D + 0.3));
		return { ev, end: endOf(ev) + 0.4, swaps: n, speed: sp, seed };
	}
	let t = HIDE_D + 0.1 + r() * 0.6;
	const target = opts.maxSwaps ?? Math.floor(Math.pow(r(), 1.3) * 41); // 0..40, more short rounds
	const speed = opts.speed ?? r();
	let swaps = 0;
	if (r() < 0.04) { const e = { k: 'hide' as const, t, d: HIDE_D, slot: Math.floor(r() * 3) }; ev.push(e); t += HIDE_D + 0.2; } // occasional re-hide
	while (swaps < target) {
		const left = target - swaps;
		if (r() < 0.3) { // hand-made swap, then a pause
			const a = Math.floor(r() * 3); let b = Math.floor(r() * 2); if (b >= a) b++;
			ev.push({ k: 'swap', t, d: MANUAL_D * (0.8 + r() * 0.5), a: Math.min(a, b), b: Math.max(a, b), s: r() < 0.5 ? 1 : -1 });
			t = endOf(ev) + 0.05 + r() * 1.2; swaps++;
		} else { // shuffle burst at roughly the episode speed
			const n = Math.min(left, 1 + Math.floor(r() * 12)), sp = Math.min(1, Math.max(0, speed + (r() - 0.5) * 0.25));
			ev.push(...shuffleEvents(r, n, sp, t, 0.02 + r() * 0.05));
			t = endOf(ev) + 0.05 + r() * 0.8; swaps += n;
		}
	}
	return { ev, end: endOf(ev) + 0.4, swaps, speed, seed };
}
