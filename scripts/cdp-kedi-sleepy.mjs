// Headless play-through of the /kedi "sleepy cat" mode with real UI clicks: pick 15 / 10 / 5 fps, play rounds at several
// speeds and swap counts, record what the cat answers and how many frames it saw; sleepy rounds must go to the separate
// special counter, never to the honest one. Screenshots: <prefix>-desktop-shuffle / -reveal / -card / -mobile.png
// node scripts/cdp-kedi-sleepy.mjs <origin> [screensPrefix]
import { launch, sleep } from './cdp-lib.mjs';
const [origin, shots] = process.argv.slice(2);
const out = { rounds: [], errors: [] };
const ui = (b) => b.ev('window.__kediUi()');
const q = (b, sel, i = 0) => b.ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
async function tap(b, sel, i = 0) { const p = await q(b, sel, i); if (!p) throw new Error('no ' + sel); await b.click(p.x, p.y); await sleep(120); }
async function hideAt(b, slot) {
	for (let k = 0; k < 4; k++) {
		await sleep(400); const c = await b.ev(`window.__kedi.s.screenOfSlot(${slot})`); await b.click(c.x, c.y);
		if (await b.waitFor('window.__kediUi().phase !== "hide"', 4000) && (await b.waitFor('window.__kediUi().phase === "shuffle"', 60000))) return;
	}
	throw new Error('never reached shuffle');
}
async function shuffle(b, n, speed) {
	await b.waitFor('window.__kediUi().queued === 0', 120000);
	await b.ev(`(() => { const r = document.querySelector('.speed input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '${speed}'); r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
	for (let k = 0; k < 60; k++) { const cur = await b.ev('+document.querySelector(".stepper b").textContent'); if (cur === n) break; await b.ev(`document.querySelectorAll('.stepper button')[${cur > n ? 0 : 1}].click()`); }
	await tap(b, '.sh');
}
const stats = (b) => b.ev(`fetch('/api/kedi/stats').then((r) => r.json())`);
const FPS = [30, 15, 10, 5], setFps = (b, f) => tap(b, '.seg button', FPS.indexOf(f));
async function newRoundIfOver(b) { if ((await ui(b)).phase === 'over') await tap(b, 'button.primary'); await b.waitFor('window.__kediUi().phase === "hide"', 30000); }
async function play(b, name, o) { try { return await play1(b, name, o); } catch (e) { out.errors.push(`${name}: ${e.message}`); out.rounds.push({ name, error: e.message, phase: (await ui(b)).phase }); } }
async function play1(b, name, { fps, slot, n, speed, shot = null }) {
	await newRoundIfOver(b); await setFps(b, fps);
	await hideAt(b, slot); await shuffle(b, n, speed);
	if (shot) { await sleep(1800); await b.shot(`${shot}-shuffle.png`); }
	await b.waitFor('window.__kediUi().queued === 0', 240000);
	await tap(b, 'button.primary');
	if (!(await b.waitFor('window.__kediUi().phase === "over"', 300000))) throw new Error(`never finished (phase ${(await ui(b)).phase})`);
	await sleep(3000); if (shot) await b.shot(`${shot}-reveal.png`);
	const u = await ui(b);
	const r = { name, fps: u.fps, slot, n, speed, swaps: u.swaps, frames: u.nFrames, probs: u.probs.map((p) => +p.toFixed(4)), cat: u.result.cat, choice: u.result.choice, real: u.result.real, special: u.special, counted: u.counted, comment: await b.ev('document.querySelector(".comment").textContent') };
	out.rounds.push(r); return r;
}
{
	const b = await launch({ width: 1920, height: 1080 });
	await b.nav(`${origin}/tr/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000); await sleep(1000);
	const s0 = await stats(b);
	await play(b, '15fps-slow-6', { fps: 15, slot: 0, n: 6, speed: 0.3, shot: shots ? `${shots}-desktop` : null });
	await play(b, '15fps-lightning-8', { fps: 15, slot: 1, n: 8, speed: 0.95 });
	await play(b, '10fps-medium-8', { fps: 10, slot: 2, n: 8, speed: 0.3 });
	await play(b, '10fps-fast-5', { fps: 10, slot: 0, n: 5, speed: 0.5 });
	await play(b, '5fps-slow-3', { fps: 5, slot: 1, n: 3, speed: 0.1 });
	await play(b, '5fps-fast-10', { fps: 5, slot: 2, n: 10, speed: 0.7 });
	await sleep(3000); const s1 = await stats(b);
	out.counter = { before: s0, after: s1, honestUnchanged: s0.games === s1.games && s0.human === s1.human && s0.cat === s1.cat, specialDelta: s0.special && s1.special ? s1.special.games - s0.special.games : null };
	out.counter.ok = out.counter.honestUnchanged && (out.counter.specialDelta === null || out.counter.specialDelta === out.rounds.filter((r) => r.counted).length);
	// back to awake: the round must not be special again (blank test feed so this smoke round never reaches the honest counter)
	await newRoundIfOver(b); await b.ev('window.__kediFeed("blank")');
	await play(b, '30fps-awake-blankfeed', { fps: 30, slot: 2, n: 4, speed: 0.5 }); await b.ev('window.__kediFeed("normal")');
	const s2 = await stats(b); out.counter.honestAfterAwake = s2; out.counter.ok &&= s2.games === s0.games;
	if (shots) { await b.ev('document.querySelector("details").open = true'); await sleep(200); await b.ev('[...document.querySelectorAll(".acc-t")].at(-1).scrollIntoView({ block: "start" })'); await sleep(400); await b.shot(`${shots}-card.png`); await b.ev('document.querySelector("details").open = false'); }
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `desktop: ${l.text}`));
	b.close();
}
if (shots) { // phone portrait, sleepiest cat, mid-shuffle so the zzz and heavy lids show
	const b = await launch({ width: 390, height: 844, dpr: 3, mobile: true });
	await b.nav(`${origin}/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000); await sleep(800);
	await setFps(b, 5); await sleep(2500);
	await b.ev('document.querySelector(".panel").scrollTop = 0'); await sleep(300);
	await b.shot(`${shots}-mobile.png`);
	out.zzzShown = await b.ev('!!document.querySelector(".zzz")');
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `mobile: ${l.text}`));
	b.close();
}
const sl = out.rounds.filter((r) => r.fps < 30), aw = out.rounds.filter((r) => r.fps === 30);
out.flagsOk = sl.length === 6 && sl.every((r) => r.special) && aw.length === 1 && aw.every((r) => !r.special && !r.counted);
out.catAcc = `${sl.filter((r) => r.cat).length}/${sl.length} sleepy`;
console.log(JSON.stringify(out, null, 1));
if (out.errors.length || !out.flagsOk || !out.counter?.ok || (shots && !out.zzzShown)) process.exitCode = 1;
