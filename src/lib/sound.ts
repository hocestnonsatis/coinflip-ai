// Tiny Models sound effects — every sound is synthesised with the Web Audio API at play time (no sample files,
// so nothing to license or download). One lazy AudioContext, created/resumed on the first user gesture (autoplay
// policy), a master gain + soft limiter, and a mute switch remembered in localStorage. Sounds are short, quiet and
// slightly randomised (pitch, timing) so repeats don't sound mechanical.

export const MUTE_KEY = 'tm-sound-muted';
const MASTER = 0.55;

type Ctx = AudioContext;
let ctx: Ctx | null = null, master: GainNode | null = null, noiseBuf: AudioBuffer | null = null;
let muted = false, loaded = false;
const subs = new Set<(m: boolean) => void>();

function store(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
function load() { if (loaded) return; loaded = true; muted = store()?.getItem(MUTE_KEY) === '1'; }

export function isMuted() { load(); return muted; }
export function setMuted(m: boolean) {
	load(); muted = m;
	try { store()?.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ }
	if (ctx && master) master.gain.setTargetAtTime(m ? 0 : MASTER, ctx.currentTime, 0.02);
	if (!m) unlock();
	for (const f of subs) f(m);
}
export const toggleMuted = () => setMuted(!isMuted());
/** Subscribe to mute changes; returns the unsubscribe function. */
export function onMuted(f: (m: boolean) => void) { subs.add(f); return () => void subs.delete(f); }

/** Create (or resume) the AudioContext. Must run inside a user gesture the first time. */
export function unlock(): Ctx | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
			?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return null;
		try { ctx = new AC(); } catch { return null; }
		const lim = ctx.createDynamicsCompressor();
		lim.threshold.value = -14; lim.knee.value = 10; lim.ratio.value = 8; lim.attack.value = 0.002; lim.release.value = 0.15;
		master = ctx.createGain(); master.gain.value = isMuted() ? 0 : MASTER;
		master.connect(lim); lim.connect(ctx.destination);
	}
	if (ctx.state === 'suspended') ctx.resume().catch(() => {});
	return ctx;
}

let installed = false;
/** Install one-time gesture listeners that unlock audio (capture phase, so the context exists before the game reacts). */
export function installUnlock() {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	const go = () => { if (unlock()?.state === 'running') for (const e of EVENTS) window.removeEventListener(e, go, true); };
	for (const e of EVENTS) window.addEventListener(e, go, true);
}
const EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

/** The context if sound may play right now (unlocked, running, not muted), else null. */
function live(): Ctx | null {
	if (isMuted() || !ctx || !master) return null;
	if (ctx.state !== 'running') { ctx.resume().catch(() => {}); return null; }
	return ctx;
}

// ---------- primitives
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** ±pct random pitch / gain variation */
export const vary = (x: number, pct = 0.06) => x * (1 + (Math.random() * 2 - 1) * pct);

function noise(c: Ctx) {
	if (!noiseBuf) {
		noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
		const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	}
	const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
function env(c: Ctx, t: number, peak: number, attack: number, decay: number) {
	const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
	g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
	g.connect(master!); return g;
}
type Tone = { f: number; f2?: number; type?: OscillatorType; gain: number; a?: number; d: number; at?: number };
function tone(c: Ctx, o: Tone) {
	const t = c.currentTime + (o.at ?? 0), a = o.a ?? 0.004, osc = c.createOscillator();
	osc.type = o.type ?? 'sine'; osc.frequency.setValueAtTime(o.f, t);
	if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + a + o.d);
	osc.connect(env(c, t, o.gain, a, o.d)); osc.start(t); osc.stop(t + a + o.d + 0.05);
}
type Noise = { f: number; f2?: number; q?: number; filter?: BiquadFilterType; gain: number; a?: number; d: number; at?: number };
function burst(c: Ctx, o: Noise) {
	const t = c.currentTime + (o.at ?? 0), a = o.a ?? 0.002, n = noise(c), bq = c.createBiquadFilter();
	bq.type = o.filter ?? 'bandpass'; bq.Q.value = o.q ?? 1.5; bq.frequency.setValueAtTime(o.f, t);
	if (o.f2) bq.frequency.exponentialRampToValueAtTime(o.f2, t + a + o.d);
	n.connect(bq); bq.connect(env(c, t, o.gain, a, o.d)); n.start(t, Math.random() * 0.5); n.stop(t + a + o.d + 0.05);
}

// ---------- building blocks
/** hard little impact: a band of noise + a short body tone. pitch ≈ material (wood ~1, bakelite tile ~1.6) */
function clack(c: Ctx, pitch = 1, gain = 0.5, at = 0) {
	const p = vary(pitch, 0.08), g = vary(gain, 0.12);
	burst(c, { f: 2200 * p, q: 2.2, gain: g, d: 0.035, at });
	tone(c, { f: 720 * p, f2: 520 * p, type: 'triangle', gain: g * 0.55, d: 0.05, at });
}
function thud(c: Ctx, gain = 0.6, at = 0) {
	burst(c, { f: 260, filter: 'lowpass', q: 0.7, gain: vary(gain, 0.1), d: 0.09, at });
	tone(c, { f: vary(110, 0.08), f2: 55, gain: gain * 0.9, d: 0.16, at });
}
/** metallic bell: inharmonic partials with their own decays */
function bell(c: Ctx, f: number, gain = 0.25, at = 0, len = 1) {
	for (const [r, g, d] of [[1, 1, 1.1], [2.76, 0.45, 0.55], [5.4, 0.25, 0.3], [8.93, 0.12, 0.18]])
		tone(c, { f: f * r, gain: gain * g, a: 0.002, d: d * len, at });
}
function notes(c: Ctx, fs: number[], step: number, o: Partial<Tone> & { gain: number; d: number }) {
	fs.forEach((f, i) => tone(c, { ...o, f, at: (o.at ?? 0) + i * step }));
}
const N = (semi: number) => 440 * 2 ** ((semi - 9) / 12) * 2; // semitones from C5

// ---------- the sound kit
export const sfx = {
	// ui
	tick() { const c = live(); if (c) tone(c, { f: vary(3200, 0.05), type: 'triangle', gain: 0.1, d: 0.025 }); },
	/** soft "nope" for an invalid action */
	nope() { const c = live(); if (c) { tone(c, { f: 330, f2: 300, type: 'triangle', gain: 0.12, d: 0.09 }); tone(c, { f: 262, f2: 240, type: 'triangle', gain: 0.12, d: 0.12, at: 0.1 }); } },
	win() { const c = live(); if (c) { notes(c, [N(0), N(4), N(7), N(12)], 0.09, { type: 'triangle', gain: 0.16, d: 0.35 }); bell(c, N(24), 0.05, 0.36, 0.8); } },
	lose() { const c = live(); if (c) notes(c, [N(-5), N(-9), N(-12)], 0.16, { type: 'sine', gain: 0.15, d: 0.4 }); },
	draw() { const c = live(); if (c) notes(c, [N(0), N(-5)], 0.14, { type: 'sine', gain: 0.12, d: 0.35 }); },

	// coin
	/** flip: whoosh + a few metallic spin ticks that slow down; returns stop() for the ticks (call on landing) */
	coinFlip(power = 0.5) {
		const c = live(); if (!c) return () => {};
		burst(c, { f: 500, f2: 1800, q: 1.1, gain: 0.18 + power * 0.08, a: 0.04, d: 0.35 });
		let stop = false, gap = 55 + (1 - power) * 30, h = 0;
		const loop = () => { if (stop || !live()) return; tone(c, { f: vary(5200, 0.08), type: 'sine', gain: 0.035, d: 0.018 }); gap *= 1.07; if (gap < 260) h = window.setTimeout(loop, gap); };
		h = window.setTimeout(loop, 90);
		return () => { stop = true; clearTimeout(h); };
	},
	coinLand(heads: boolean) { const c = live(); if (!c) return; clack(c, 1.9, 0.18); bell(c, vary(heads ? 1960 : 1740, 0.015), 0.16); bell(c, vary(heads ? 1960 : 1740, 0.02), 0.06, 0.24, 0.5); },
	/** the coin lands somewhere unusual: a lower, wobbling ring */
	coinOdd() { const c = live(); if (!c) return; clack(c, 1.6, 0.16); for (let i = 0; i < 6; i++) bell(c, 1320 * (1 + i * 0.012), 0.07 * (1 - i * 0.12), i * 0.11, 0.6); },
	/** rare-event sparkle (used for any rare outcome) */
	sparkle() { const c = live(); if (!c) return; notes(c, [N(12), N(16), N(19), N(24), N(28)], 0.07, { type: 'sine', gain: 0.07, d: 0.5 }); bell(c, N(31), 0.05, 0.4, 1.2); },

	// dice (also used by tavla)
	/** rattle: n quick clacks spread over ms; returns nothing (fire and forget) */
	rattle(ms = 600, n = 9) { const c = live(); if (!c) return; for (let i = 0; i < n; i++) clack(c, rnd(0.9, 1.25), rnd(0.12, 0.28), (i / n) * (ms / 1000) + rnd(0, 0.03)); },
	/** landing thud, then a few decaying tumble clacks */
	diceLand() { const c = live(); if (!c) return; thud(c, 0.45); clack(c, 1.05, 0.3, 0.01); let t = 0.08; for (const g of [0.16, 0.1, 0.06]) { clack(c, rnd(1, 1.2), g, t); t += rnd(0.07, 0.12); } },

	// tavla
	checker() { const c = live(); if (!c) return; clack(c, 0.85, 0.52); tone(c, { f: vary(240, 0.06), f2: 180, gain: 0.28, d: 0.07 }); },
	hit() { const c = live(); if (!c) return; clack(c, 0.8, 0.5); clack(c, 0.95, 0.32, 0.07); thud(c, 0.25, 0.02); },
	bearOff() { const c = live(); if (!c) return; clack(c, 0.95, 0.45); tone(c, { f: vary(520, 0.04), f2: 880, type: 'sine', gain: 0.1, d: 0.12, at: 0.03 }); },

	// okey
	tilePick() { const c = live(); if (!c) return; clack(c, 1.55, 0.45); },
	tileDrop(gain = 0.45) { const c = live(); if (!c) return; clack(c, 1.4, gain); clack(c, 1.6, gain * 0.35, 0.045); },
	slide() { const c = live(); if (!c) return; burst(c, { f: vary(1400, 0.1), f2: 900, q: 1.2, gain: 0.08, a: 0.02, d: 0.12 }); clack(c, 1.7, 0.12, 0.13); },
	shuffle(ms = 500) { const c = live(); if (!c) return; for (let i = 0; i < 7; i++) burst(c, { f: rnd(1100, 1700), q: 1.3, gain: 0.05, a: 0.01, d: 0.06, at: (i / 7) * (ms / 1000) }); for (let i = 0; i < 5; i++) clack(c, rnd(1.4, 1.8), rnd(0.08, 0.16), rnd(0.05, ms / 1000)); },
};
export type Sfx = typeof sfx;
