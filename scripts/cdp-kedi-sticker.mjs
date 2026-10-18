// Headless play-through of the /kedi sticker cheat with real UI clicks: stick toy pictures on cups (before / after the hide,
// wrong / all / empty / right cup), play the round, record what the cat answers; cheated rounds must not reach the honest counter (they go to the separate special one);
// honesty checks (blank / mirrored feed) still pass with the stickers peeled off. Screenshots: <prefix>-*.png
// node scripts/cdp-kedi-sticker.mjs <origin> [screensPrefix]
import { launch, sleep } from './cdp-lib.mjs';
import { writeFileSync } from 'node:fs';
const [origin, shots] = process.argv.slice(2);
const out = { rounds: [], honesty: [], errors: [] };
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
async function newRoundIfOver(b) { if ((await ui(b)).phase === 'over') await tap(b, 'button.primary'); await b.waitFor('window.__kediUi().phase === "hide"', 30000); }
async function finish(b, shot) {
	await b.waitFor('window.__kediUi().queued === 0', 180000);
	await tap(b, 'button.primary');
	if (!(await b.waitFor('window.__kediUi().phase === "over"', 300000))) throw new Error(`never finished (phase ${(await ui(b)).phase})`);
	await sleep(1500); if (shot) await b.shot(shot);
	return ui(b);
}
// sticker buttons: .st row 0 = per slot (0..2), row 1 = all / empty / clear
const stickSlot = (b, k) => tap(b, '.st button', k), stickAll = (b) => tap(b, '.st button', 3), stickEmpty = (b) => tap(b, '.st button', 4), peel = (b) => tap(b, '.st button', 5);
async function play(b, name, o) { try { return await play1(b, name, o); } catch (e) { out.errors.push(`${name}: ${e.message}`); out.rounds.push({ name, error: e.message, phase: (await ui(b)).phase, cheated: true }); } }
async function play1(b, name, { slot, before = [], after = null, n = 6, speed = 0.5, hand = 0, shot = null }) {
	await newRoundIfOver(b);
	if ((await ui(b)).stick.some(Boolean)) await peel(b);
	for (const k of before) await stickSlot(b, k);
	if (shot) { await sleep(900); await b.shot(`${shot}-before.png`); }
	await hideAt(b, slot);
	if (after === 'all') await stickAll(b); else if (after === 'empty') await stickEmpty(b); else if (typeof after === 'number') await stickSlot(b, after);
	for (let i = 0; i < hand; i++) { const S = await Promise.all([0, 1, 2].map((s) => b.ev(`window.__kedi.s.screenOfSlot(${s})`))); await b.waitFor('window.__kediUi().queued === 0', 30000); const [x, y] = [[0, 2], [1, 2], [0, 1]][i % 3]; await b.click(S[x].x, S[x].y); await sleep(60); await b.click(S[y].x, S[y].y); await sleep(300); }
	if (n) await shuffle(b, n, speed);
	if (shot) { await sleep(500); await b.shot(`${shot}-shuffle.png`); }
	const u = await finish(b, shot ? `${shot}-reveal.png` : null);
	const r = { name, slot, before, after, n, speed, hand, swaps: u.swaps, frames: u.nFrames, probs: u.probs.map((p) => +p.toFixed(4)), cat: u.result.cat, choice: u.result.choice, real: u.result.real, cheated: u.cheated, stick: u.stick, comment: await b.ev('document.querySelector(".comment").textContent') };
	out.rounds.push(r); return r;
}
// 1) desktop, Turkish
{
	const b = await launch({ width: 1920, height: 1080 });
	await b.nav(`${origin}/tr/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000); await sleep(1000);
	const s0 = await stats(b);
	await tap(b, '.ct input'); // cheat mode on
	await play(b, 'wrong-before', { slot: 0, before: [2], n: 6, speed: 0.5, shot: shots ? `${shots}-desktop` : null });
	if (shots) { // the cat's-eye inset, upscaled, as its own picture
		const url = await b.ev('document.querySelector(".inset canvas").toDataURL("image/png")'); writeFileSync(`${shots}-catview-64x32.png`, Buffer.from(url.split(',')[1], 'base64'));
	}
	await play(b, 'all-after', { slot: 1, after: 'all', n: 8, speed: 0.95 });
	await play(b, 'empty-after', { slot: 2, after: 'empty', n: 10, speed: 0.7 });
	await play(b, 'right-before', { slot: 1, before: [1], n: 10, speed: 0.7 });
	await play(b, 'wrong-after-hand', { slot: 0, after: 1, n: 0, hand: 4 });
	await play(b, 'empty-after-0swaps', { slot: 2, after: 'empty', n: 0 });
	await sleep(3000); const s1 = await stats(b); // cheated rounds: the honest counter must not move; they go to the separate special counter instead
	out.counter = { before: s0, after: s1, honestUnchanged: s0.games === s1.games && s0.human === s1.human && s0.cat === s1.cat, specialDelta: s0.special && s1.special ? s1.special.games - s0.special.games : null };
	out.counter.ok = out.counter.honestUnchanged && (out.counter.specialDelta === null || out.counter.specialDelta >= 1);
	if (shots) { await b.ev('document.querySelector("details").open = true'); await sleep(200); await b.ev('document.querySelector(".stk").scrollIntoView({ block: "center" })'); await sleep(400); await b.shot(`${shots}-card.png`); await b.ev('document.querySelector("details").open = false'); }
	// honesty checks with the stickers peeled off
	await newRoundIfOver(b); await peel(b); await tap(b, '.ct input');
	for (const [feed, slot] of [['blank', 0], ['blank', 2], ['mirror', 0], ['mirror', 2]]) {
		await newRoundIfOver(b); await b.ev(`window.__kediFeed(${JSON.stringify(feed)})`); await hideAt(b, slot);
		if (feed === 'blank') await shuffle(b, 4, 0.3);
		const u = await finish(b, null); await b.ev('window.__kediFeed("normal")');
		out.honesty.push({ feed, slot, probs: u.probs.map((p) => +p.toFixed(4)), choice: u.result.choice, cheated: u.cheated });
	}
	await sleep(3000); out.counter.honestAfterFeeds = await stats(b); out.counter.ok &&= out.counter.honestAfterFeeds.games === s0.games; // test-feed rounds never count
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `desktop: ${l.text}`));
	b.close();
}
// 2) phone portrait with a sticker
if (shots) {
	const b = await launch({ width: 390, height: 844, dpr: 3, mobile: true });
	await b.nav(`${origin}/kedi`); await b.waitFor('!!window.__kediUi && window.__kediUi().phase === "hide"', 90000); await sleep(800);
	await tap(b, '.ct input'); await tap(b, '.st button', 0); await sleep(1500);
	await b.ev('document.querySelector(".panel").scrollTop = 0'); await sleep(300);
	await b.shot(`${shots}-mobile.png`);
	out.errors.push(...b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning').map((l) => `mobile: ${l.text}`));
	b.close();
}
const spread = (p) => Math.max(...p) - Math.min(...p);
out.blankOk = out.honesty.filter((h) => h.feed === 'blank').every((h) => spread(h.probs) < 0.1);
out.mirrorOk = out.honesty.filter((h) => h.feed === 'mirror').every((h) => h.choice === 2 - h.slot);
out.cheatedFlagged = out.rounds.every((r) => r.cheated) && out.honesty.every((h) => !h.cheated);
out.catAcc = `${out.rounds.filter((r) => r.cat).length}/${out.rounds.length}`;
console.log(JSON.stringify(out, null, 1));
if (out.errors.length || !out.blankOk || !out.mirrorOk || !out.cheatedFlagged || !out.counter?.ok) process.exitCode = 1;
