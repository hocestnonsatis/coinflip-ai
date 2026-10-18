// Headless play-through of /kedi + honesty checks (the cat's guess must come from the camera frames).
// node scripts/cdp-kedi.mjs <origin> [screensPrefix]
//  - plays real rounds with real mouse input (hide, hand swap, shuffle ×N, ask) and records the cat's answers
//  - blank feed: camera frames replaced by a constant image → output must be ~uniform
//  - mirrored feed: frames flipped left↔right, toy hidden left, no swaps → the cat must point right (and vice versa)
//  - console errors / exceptions must be zero
import { launch, sleep } from './cdp-lib.mjs';
const [origin, shots] = process.argv.slice(2);
const out = { rounds: [], manual: [], blank: [], mirror: [], errors: [] };
const drag = async (b, a, c) => { const M = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });
	await M('mouseMoved', a.x, a.y, { button: 'none' }); await M('mousePressed', a.x, a.y, { buttons: 1, clickCount: 1 });
	for (let k = 1; k <= 6; k++) await M('mouseMoved', a.x + ((c.x - a.x) * k) / 6, a.y + ((c.y - a.y) * k) / 6, { buttons: 1 });
	await M('mouseReleased', c.x, c.y, { buttons: 0, clickCount: 1 }); };
const ui = (b) => b.ev('window.__kediUi()');
const PAIRS = [[0, 1], [1, 2], [0, 2], [2, 1], [1, 0], [2, 0]];
async function setShuffle(b, n, speed) {
	await b.ev(`(() => { const r = document.querySelector('.speed input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '${speed}'); r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
	for (let k = 0; k < 60; k++) { const cur = await b.ev('+document.querySelector(".stepper b").textContent'); if (cur === n) break; await b.ev(`document.querySelectorAll('.stepper button')[${cur > n ? 0 : 1}].click()`); }
}
async function finish(b) {
	await b.waitFor('window.__kediUi().queued === 0', 180000);
	await b.ev('document.querySelector("button.primary").click()');
	if (!(await b.waitFor('window.__kediUi().phase === "over"', 120000))) throw new Error('never finished');
	await sleep(800); const u = await ui(b); await b.ev('window.__kediFeed("normal")'); return u;
}
/** Real-user style: k hand swaps by click-click or drag (gapMs pause after each), optionally then shuffle ×n at a slider value. */
async function manual(b, { slot, k, mode, gapMs, n = 0, speed = 0.5, seed = 1 }) {
	if ((await ui(b)).phase === 'over') await b.ev('document.querySelector("button.primary").click()');
	await b.waitFor('window.__kediUi().phase === "hide"', 30000);
	const c = await b.ev(`window.__kedi.s.screenOfSlot(${slot})`); await b.click(c.x, c.y);
	if (!(await b.waitFor('window.__kediUi().phase === "shuffle"', 60000))) throw new Error('never reached shuffle');
	const S = await Promise.all([0, 1, 2].map((i) => b.ev(`window.__kedi.s.screenOfSlot(${i})`)));
	let r = seed, sent = 0;
	for (let i = 0; i < k; i++) {
		r = (r * 1103515245 + 12345) >>> 0; const [x, y] = PAIRS[(r >>> 8) % 6];
		// aim at resting cups (a person aims at a cup, not at an empty spot): rapid mode only waits for the running swap
		await b.waitFor('window.__kediUi().queued <= ' + (gapMs < 300 ? 1 : 0), 30000);
		const before = (await ui(b)).queued + (await ui(b)).swaps;
		if (mode === 'drag') await drag(b, S[x], S[y]); else { await b.click(S[x].x, S[x].y); await sleep(40); await b.click(S[y].x, S[y].y); }
		await sleep(30); if ((await ui(b)).queued + (await ui(b)).swaps > before) sent++;
		await sleep(gapMs);
	}
	if (n) { await b.waitFor('window.__kediUi().queued === 0', 60000); await setShuffle(b, n, speed); await b.ev('document.querySelector(".sh").click()'); }
	const u = await finish(b);
	return { slot, k, mode, gapMs, n, speed, sent, swaps: u.swaps, frames: u.nFrames, probs: u.probs.map((p) => +p.toFixed(4)), cat: u.result.cat, choice: u.result.choice, real: u.result.real };
}
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
// 2b) real-user style manual swaps (clicks + drags, rapid and slow) and the slider extremes 0 / 1 (outside the 0.1–0.95 grid)
{
	const b = await launch({ width: 960, height: 540 });
	await b.nav(`${origin}/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000);
	const plan = [
		{ slot: 1, k: 4, mode: 'click', gapMs: 900 }, { slot: 0, k: 6, mode: 'click', gapMs: 0 }, { slot: 2, k: 4, mode: 'drag', gapMs: 600 },
		{ slot: 1, k: 6, mode: 'drag', gapMs: 0 }, { slot: 0, k: 3, mode: 'click', gapMs: 100, n: 12, speed: 1 }, { slot: 2, k: 2, mode: 'drag', gapMs: 100, n: 20, speed: 1 },
		{ slot: 1, k: 0, mode: 'click', gapMs: 0, n: 30, speed: 1 }, { slot: 0, k: 0, mode: 'click', gapMs: 0, n: 6, speed: 0 }, { slot: 2, k: 5, mode: 'click', gapMs: 2500 }
	];
	for (const [i, p] of plan.entries()) { try { out.manual.push(await manual(b, { ...p, seed: 17 + i * 31 })); } catch (e) { out.errors.push(`manual #${i}: ${e.message}`); out.manual.push({ ...p, error: e.message, phase: (await ui(b)).phase }); } }
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `manual: ${l.text}`));
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
out.normalAcc = `${out.rounds.filter((r) => r.cat).length}/${out.rounds.length}`; out.manualAcc = `${out.manual.filter((r) => r.cat).length}/${out.manual.length}`;
console.log(JSON.stringify(out, null, 1));
if (out.errors.length || !out.blankOk || !out.mirrorOk) process.exitCode = 1;
