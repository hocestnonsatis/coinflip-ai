// 👍/👎 feedback lines: every language has the same pools, no leftover placeholders, index wraps safely.
import assert from 'node:assert/strict';
import { FEEDBACK, feedbackLine } from '../src/lib/i18n-feedback.ts';
const langs = ['en', 'tr', 'de', 'es', 'fr'] as const;
assert.deepEqual(Object.keys(FEEDBACK).sort(), [...langs].sort());
for (const l of langs) {
	const d = FEEDBACK[l];
	for (const k of ['label', 'good', 'bad'] as const) assert.ok(d[k].trim(), `${l}.${k} empty`);
	for (const v of ['up', 'down'] as const) {
		assert.equal(d[v].length, FEEDBACK.en[v].length, `${l}.${v} length differs from en`);
		for (const line of d[v]) { assert.ok(line.trim(), `${l}.${v} has empty line`); assert.ok(!/[{}]/.test(line), `${l}.${v} placeholder: ${line}`); }
		assert.equal(new Set(d[v]).size, d[v].length, `${l}.${v} duplicates`);
		for (const i of [-1, 0, 1, 2, 3, 99]) assert.ok(d[v].includes(feedbackLine(l, v, i)));
	}
}
console.log(`feedback: ${langs.length} languages × ${FEEDBACK.en.up.length}+${FEEDBACK.en.down.length} lines OK`);

// ↻ Regenerate: all languages present, log mentions the response number, pickOther never repeats.
import { REGEN, pickOther } from '../src/lib/i18n-regen.ts';
assert.deepEqual(Object.keys(REGEN).sort(), [...langs].sort());
for (const l of langs) { assert.ok(REGEN[l].regen.trim()); assert.ok(REGEN[l].log(7).includes('7'), `${l} regen log`); }
for (const len of [1, 2, 3, 10]) for (let prev = -1; prev < len; prev++) for (let k = 0; k < 50; k++) {
	const i = pickOther(len, prev);
	assert.ok(Number.isInteger(i) && i >= 0 && i < len, `pickOther range ${len}/${prev}/${i}`);
	if (len > 1 && prev >= 0) assert.notEqual(i, prev);
}
assert.equal(pickOther(5, 4, () => 0.999999), 3);
console.log('regen: 5 languages, pickOther OK');
