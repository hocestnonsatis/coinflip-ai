// Global tavla counter: ticket signing and result plausibility (src/lib/server/tavla-stats-core.ts).
import assert from 'node:assert/strict';
import { issueTicket, verifyTicket, checkResult, ipKey, safeEqual, RULES } from '../src/lib/server/tavla-stats-core.ts';
import { leader, TAVLA_STATS } from '../src/lib/i18n-tavla-stats.ts';

const S = 'test-secret-0123456789abcdef', now = 1_800_000_000_000;
const { gameId, start } = await issueTicket(S, now);
assert.equal(start, now);
assert.match(gameId, /^t1\.[0-9a-f]{32}\.\d{13}\.[0-9a-f]{64}$/);
assert.deepEqual(await verifyTicket(S, gameId), { id: gameId.split('.')[1], start: now });
assert.equal(await verifyTicket('other-secret', gameId), null, 'wrong secret');
const parts = gameId.split('.');
assert.equal(await verifyTicket(S, [parts[0], parts[1], String(now - 3600_000), parts[3]].join('.')), null, 'forged start time');
assert.equal(await verifyTicket(S, [parts[0], 'f'.repeat(32), parts[2], parts[3]].join('.')), null, 'forged id');
for (const bad of [null, 42, '', 'x'.repeat(500), gameId + 'a', gameId.toUpperCase()]) assert.equal(await verifyTicket(S, bad), null);
const a = await issueTicket(S, now), b = await issueTicket(S, now);
assert.notEqual(a.gameId, b.gameId, 'random ids');

const ok = { winner: 'human', gammon: false, moves: 40, gameId };
const later = now + 5 * 60_000;
const r = await checkResult(S, ok, later);
assert.ok(r.ok && r.id === parts[1] && r.winner === 'human' && r.gammon === false);
assert.ok((await checkResult(S, { ...ok, winner: 'model', gammon: true }, later)).ok);
const err = async (body: unknown, t: number, status: number) => { const c = await checkResult(S, body, t); assert.ok(!c.ok, JSON.stringify(body)); assert.equal((c as { status: number }).status, status, JSON.stringify(c)); };
await err(null, later, 400);
await err('nope', later, 400);
await err({ ...ok, winner: 'draw' }, later, 400);
await err({ ...ok, gammon: 'yes' }, later, 400);
await err({ ...ok, moves: 40.5 }, later, 400);
await err({ ...ok, moves: '40' }, later, 400);
await err({ ...ok, gameId: 'abc' }, later, 403);
await err({ ...ok }, now + RULES.minMs - 1, 422); // too fast
assert.ok((await checkResult(S, ok, now + RULES.minMs)).ok);
await err({ ...ok }, now + RULES.maxMs + 1, 410); // expired
await err({ ...ok, moves: RULES.minMoves - 1 }, later, 422);
await err({ ...ok, moves: RULES.maxMoves + 1 }, later, 422);
assert.ok((await checkResult(S, { ...ok, moves: RULES.minMoves }, later)).ok);
// minimum turns: 167 pips with all 6-6 (24 pips/turn) needs 7 turns for the winner + 6 for the loser
assert.equal(RULES.minMoves, Math.ceil(167 / 24) * 2 - 1);

assert.ok(safeEqual('abc', 'abc') && !safeEqual('abc', 'abd') && !safeEqual('abc', 'ab'));
const k1 = await ipKey(S, '1.2.3.4');
assert.equal(k1.length, 24); assert.equal(k1, await ipKey(S, '1.2.3.4')); assert.notEqual(k1, await ipKey(S, '1.2.3.5'));
assert.ok(!k1.includes('1.2.3.4'));

assert.equal(leader({ games: 0, human: 0, model: 0 }), 'empty');
assert.equal(leader({ games: 3, human: 2, model: 1 }), 'humans');
assert.equal(leader({ games: 3, human: 1, model: 2 }), 'model');
assert.equal(leader({ games: 2, human: 1, model: 1 }), 'tie');
for (const [l, d] of Object.entries(TAVLA_STATS)) {
	const nf = new Intl.NumberFormat(l);
	const line = d.line(nf.format(12345), 12345, nf.format(6000), nf.format(6345));
	assert.ok(line.includes(nf.format(12345)) && line.includes(nf.format(6345)), l);
	assert.ok(d.humans.length && d.model.length && d.tie.length && d.empty && d.counted && d.title, l);
}
assert.equal(TAVLA_STATS.tr.line('12.345', 12345, '6.000', '6.345'), 'Bugüne kadar 12.345 oyun oynandı · İnsanlar 6.000 · Model 6.345');
console.log('tavla stats ok');

// okey tickets: separate HMAC domain, draw allowed, own plausibility rules
import { RULES_OKEY } from '../src/lib/server/tavla-stats-core.ts';
{
	const ok = await issueTicket(S, now, 'okey');
	assert.equal(await verifyTicket(S, ok.gameId, 'tavla'), null, 'okey ticket is not a tavla ticket');
	assert.equal(await verifyTicket(S, gameId, 'okey'), null, 'tavla ticket is not an okey ticket');
	const later2 = now + 60_000, body = { winner: 'draw', moves: 60, gameId: ok.gameId };
	assert.ok((await checkResult(S, body, later2, 'okey', RULES_OKEY)).ok, 'okey draw');
	assert.ok((await checkResult(S, { ...body, winner: 'model' }, later2, 'okey', RULES_OKEY)).ok);
	assert.ok(!(await checkResult(S, { ...body, winner: 'draw', gameId }, later2, 'tavla')).ok, 'no draws in tavla');
	const c = await checkResult(S, body, now + RULES_OKEY.minMs - 1, 'okey', RULES_OKEY); assert.ok(!c.ok && c.status === 422);
	const c2 = await checkResult(S, { ...body, moves: 3 }, later2, 'okey', RULES_OKEY); assert.ok(!c2.ok && c2.status === 422);
	console.log('okey stats tickets ok');
}
