// sound module with a mocked Web Audio API: lazy unlock, mute persistence, every sound builds a short, quiet graph
import assert from 'node:assert/strict';

type Rec = { kind: string; t?: number; stop?: number; peak?: number; f?: number };
const made: Rec[] = [];
class Param { value = 0; target: number | null = null; r?: Rec; g: boolean; constructor(r?: Rec, g = false) { this.r = r; this.g = g; } // g: a gain param (only those count as loudness)
	setValueAtTime(v: number, t: number) { this.value = v; if (this.r && this.r.f === undefined) this.r.f = v; if (this.r) this.r.t = t; }
	linearRampToValueAtTime(v: number) { if (this.r && this.g) this.r.peak = Math.max(this.r.peak ?? 0, v); }
	exponentialRampToValueAtTime() {} setTargetAtTime(v: number) { this.target = v; } }
class Node { connect(n: unknown) { return n; } }
class Gain extends Node { r: Rec = { kind: 'gain' }; gain = new Param(this.r, true); constructor() { super(); made.push(this.r); } }
class Osc extends Node { r: Rec = { kind: 'osc' }; type = 'sine'; frequency = new Param(this.r); constructor() { super(); made.push(this.r); } start(t: number) { this.r.t = t; } stop(t: number) { this.r.stop = t; } }
class Src extends Node { r: Rec = { kind: 'noise' }; buffer: unknown = null; loop = false; constructor() { super(); made.push(this.r); } start(t: number) { this.r.t = t; } stop(t: number) { this.r.stop = t; } }
class Filt extends Node { type = 'bandpass'; Q = new Param(); frequency = new Param(); }
class Comp extends Node { threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param(); }
let contexts = 0, resumes = 0; let last: AC | null = null;
class AC {
	state = 'suspended'; t0 = performance.now(); sampleRate = 8000; destination = new Node();
	get currentTime() { return (performance.now() - this.t0) / 1000; }
	constructor() { contexts++; last = this; }
	resume() { resumes++; this.state = 'running'; return Promise.resolve(); }
	close() { this.state = 'closed'; return Promise.resolve(); }
	createAnalyser() { return new Node(); }
	createGain() { return new Gain(); } createOscillator() { return new Osc(); } createBufferSource() { return new Src(); }
	createBiquadFilter() { return new Filt(); } createDynamicsCompressor() { return new Comp(); }
	createBuffer(_c: number, n: number) { const d = new Float32Array(n); return { getChannelData: () => d }; }
}
const ls = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
Object.assign(globalThis, {
	localStorage: { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v) },
	window: { AudioContext: AC, setTimeout, addEventListener: (e: string, f: () => void) => (listeners.get(e) ?? listeners.set(e, new Set()).get(e)!).add(f), removeEventListener: (e: string, f: () => void) => listeners.get(e)?.delete(f) },
});
const S = await import('../src/lib/sound.ts');
const all = Object.keys(S.sfx) as (keyof typeof S.sfx)[];

// nothing plays (and no context exists) before a user gesture
for (const k of all) (S.sfx[k] as () => void)();
assert.equal(contexts, 0); assert.equal(made.length, 0, 'no audio graph before unlock');
// first gesture unlocks (capture listeners), later gestures don't create more contexts
S.installUnlock(); for (const f of [...(listeners.get('pointerdown') ?? [])]) f();
assert.equal(contexts, 1); assert.ok(resumes >= 1);
// a gesture after the browser suspended the context resumes it again (listeners stay installed)
last!.state = 'suspended'; const r0 = resumes; for (const f of [...(listeners.get('keydown') ?? [])]) f();
assert.ok(resumes > r0 && last!.state === 'running', 'every gesture resumes a suspended context');
S.unlock(); assert.equal(contexts, 1);
// a sound requested while the context is still starting is played once it runs (not dropped)
last!.state = 'suspended'; made.length = 0; S.sfx.checker(); assert.equal(made.length, 0); await new Promise((r) => setTimeout(r, 5));
assert.ok(made.length > 0, 'first sound after unlock is deferred, not lost');
// scheduled slightly ahead of the audio clock (never in the past)
made.length = 0; const now = last!.currentTime; S.sfx.tick(); assert.ok(made.filter((n) => n.kind === 'osc').every((n) => (n.t ?? 0) > now + 0.02), 'lookahead');

// every sound: some nodes, all short (< 2.5 s), envelope peaks bounded (the output limiter caps the bus at -3 dBFS)
for (const k of all) {
	made.length = 0; const r = (S.sfx[k] as (a?: number) => unknown)();
	if (typeof r === 'function') (r as () => void)();
	assert.ok(made.length > 0, `${k} builds a graph`);
	for (const n of made) { if (n.stop !== undefined) assert.ok(n.stop - (n.t ?? 0) < 2.5, `${k} too long`); if (n.peak !== undefined) assert.ok(n.peak <= 2.2, `${k} too loud ${n.peak}`); }
}
// slight random pitch: repeated clacks differ
const freqs = new Set<number>(); for (let i = 0; i < 5; i++) { made.length = 0; S.sfx.tilePick(); freqs.add(made.find((n) => n.kind === 'osc')!.f!); }
assert.ok(freqs.size > 1, 'pitch is randomised');

// mute: persisted, silences immediately, survives a reload
let seen: boolean | null = null; const off = S.onMuted((m) => (seen = m));
S.setMuted(true); assert.equal(ls.get(S.MUTE_KEY), '1'); assert.equal(seen, true); assert.equal(S.isMuted(), true);
made.length = 0; for (const k of all) (S.sfx[k] as () => void)(); assert.equal(made.length, 0, 'muted → silent');
S.toggleMuted(); assert.equal(S.isMuted(), false); assert.equal(ls.get(S.MUTE_KEY), '0'); off();
S.setMuted(true);
const S2 = await import('../src/lib/sound.ts?reload'); assert.equal(S2.isMuted(), true, 'mute remembered across page loads');
ls.delete(S.MUTE_KEY); const S3 = await import('../src/lib/sound.ts?fresh'); assert.equal(S3.isMuted(), false, 'default is sound on');

// labels in all 5 languages
const { SOUND } = await import('../src/lib/i18n-sound.ts');
for (const l of ['en', 'tr', 'de', 'es', 'fr'] as const) { assert.ok(SOUND[l].mute && SOUND[l].unmute && SOUND[l].mute !== SOUND[l].unmute); assert.ok(SOUND[l].mute.includes('(M)')); }
console.log(`sound: ${all.length} effects OK (lazy unlock, mute persisted, short + quiet, randomised pitch, 5 languages)`);

// wiring: every game HUD has the toggle and uses the kit; the hub stays silent
{
	const { readFileSync } = await import('node:fs');
	const src = (f: string) => readFileSync(new URL(`../src/lib/${f}`, import.meta.url), 'utf8');
	for (const app of ['CoinApp', 'DiceApp', 'TavlaApp', 'OkeyApp']) { const s = src(`${app}.svelte`); assert.ok(s.includes('<SoundToggle {lang} />'), `${app}: toggle`); assert.ok(/sfx\.\w+\(/.test(s), `${app}: sounds`); }
	assert.ok(!/sound|SoundToggle|sfx/.test(src('Hub.svelte')), 'hub has no sound');
	console.log('sound wiring: 4 game HUDs, hub silent');
}
