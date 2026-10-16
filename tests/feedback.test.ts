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
