// Headless play-through of /kedi + honesty checks (the cat's guess must come from the camera frames).
// node scripts/cdp-kedi.mjs <origin> [screensPrefix]
//  - plays real rounds with real mouse input (hide, hand swap, shuffle ×N, ask) and records the cat's answers
//  - blank feed: camera frames replaced by a constant image → output must be ~uniform
//  - mirrored feed: frames flipped left↔right, toy hidden left, no swaps → the cat must point right (and vice versa)
//  - console errors / exceptions must be zero
import { launch, sleep } from './cdp-lib.mjs';
const [origin, shots] = process.argv.slice(2);
const out = { rounds: [], blank: [], mirror: [], errors: [] };
const ui = (b) => b.ev('window.__kediUi()');
async function round(b, { slot = 1, hand = true, n = 0, speed = null, feed = 'normal', shot = null }) {
	if ((await ui(b)).phase === 'over') await b.ev('document.querySelector("button.primary").click()');
	await b.waitFor('window.__kediUi().phase === "hide"', 30000);
	await b.ev(`window.__kediFeed(${JSON.stringify(feed)})`);
	const c = await b.ev(`window.__kedi.s.screenOfSlot(${slot})`); await b.click(c.x, c.y);
	if (!(await b.waitFor('window.__kediUi().phase === "shuffle"', 60000))) throw new Error('never reached shuffle');
	if (hand) { // click two cups (by slot) = one hand swap
		const a = await b.ev('window.__kedi.s.screenOfSlot(0)'), d = await b.ev('window.__kedi.s.screenOfSlot(2)');
		await b.click(a.x, a.y); await sleep(150); await b.click(d.x, d.y); await sleep(200);
	}
	if (n) {
		await b.ev(`(() => { const r = document.querySelector('.speed input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '${speed ?? 0.35}'); r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
		for (let k = 0; k < 60 && (await b.ev('+document.querySelector(".stepper b").textContent')) !== n; k++) await b.ev(`document.querySelectorAll('.stepper button')[${(await b.ev('+document.querySelector(".stepper b").textContent')) > n ? 0 : 1}].click()`);
		await b.ev('document.querySelector(".sh").click()');
	}
	await sleep(300);
	if (shot) await b.shot(shot + '-shuffle.png');
	await b.waitFor('window.__kediUi().queued === 0', 180000);
	await b.ev('document.querySelector("button.primary").click()');
	if (!(await b.waitFor('window.__kediUi().phase === "over"', 120000))) throw new Error('never finished');
	await sleep(1500);
	if (shot) await b.shot(shot + '-reveal.png');
	const u = await ui(b); await b.ev('window.__kediFeed("normal")');
	return { slot, n, speed, feed, swaps: u.swaps, frames: u.nFrames, probs: u.probs.map((p) => +p.toFixed(4)), cat: u.result.cat, choice: u.result.choice, real: u.result.real, engine: u.engine, msPer: +u.msPer.toFixed(3) };
}
// 1) desktop 1920×1080, Turkish, real rounds + screenshots
{
	const b = await launch({ width: 1920, height: 1080 });
	await b.nav(`${origin}/tr/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000);
	await sleep(1200); if (shots) await b.shot(`${shots}-desktop-hide.png`);
	out.rounds.push(await round(b, { slot: 1, hand: true, n: 5, speed: 0.3, shot: shots ? `${shots}-desktop` : null }));
	if (shots) { await b.ev('document.querySelector("details").open = true; document.querySelector(".panel").scrollTop = 1e6'); await sleep(400); await b.shot(`${shots}-desktop-card.png`); await b.ev('document.querySelector("details").open = false'); }
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `desktop: ${l.text}`));
	out.engineDesktop = (await ui(b)).engine;
	b.close();
}
// 2) smaller viewport for speed: more rounds + honesty checks
{
	const b = await launch({ width: 960, height: 540 });
	await b.nav(`${origin}/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000);
	for (const [slot, n, speed] of [[0, 3, 0.3], [2, 6, 0.5], [1, 10, 0.7], [0, 8, 0.95]]) out.rounds.push(await round(b, { slot, hand: false, n, speed }));
	for (const slot of [0, 2]) out.blank.push(await round(b, { slot, hand: false, n: 4, speed: 0.3, feed: 'blank' }));
	for (const slot of [0, 2]) out.mirror.push(await round(b, { slot, hand: false, n: 0, feed: 'mirror' }));
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `small: ${l.text}`));
	b.close();
}
// 3) phone portrait screenshot
if (shots) {
	const b = await launch({ width: 390, height: 844, dpr: 3, mobile: true });
	await b.nav(`${origin}/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000); await sleep(1500);
	await b.shot(`${shots}-mobile.png`);
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `mobile: ${l.text}`));
	b.close();
}
const spread = (p) => Math.max(...p) - Math.min(...p);
out.blankOk = out.blank.every((r) => spread(r.probs) < 0.1);
out.mirrorOk = out.mirror.every((r) => r.choice === 2 - r.slot);
console.log(JSON.stringify(out, null, 1));
if (out.errors.length || !out.blankOk || !out.mirrorOk) process.exitCode = 1;
