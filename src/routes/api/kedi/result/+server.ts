import type { RequestHandler } from './$types';
import { reply, stats, clientIp } from '#lib/server/tavla-stats';
import { checkResult, ipKey, LIMITS_KEDI, RULES_KEDI } from '#lib/server/tavla-stats-core';
export const prerender = false;

/** POST { winner: 'human' | 'model', moves (= swaps), gameId, special? } — once per signed ticket ('model' = the cat found the toy).
 *  special: true = a cheat / sleepy round: needs a 'kedix' ticket and goes to the separate "kedi-x" counter, never the honest one. */
export const POST: RequestHandler = async ({ request }) => {
	if (Number(request.headers.get('content-length') ?? 0) > 2048) return reply({ error: 'too large' }, 413);
	let body: unknown; try { body = await request.json(); } catch { return reply({ error: 'bad json' }, 400); }
	const special = (body as { special?: unknown })?.special === true;
	const s = stats(special ? 'kedi-x' : 'kedi'); if (!s) return reply({ error: 'stats unavailable' }, 503);
	const c = await checkResult(s.secret, body, Date.now(), special ? 'kedix' : 'kedi', RULES_KEDI);
	if (!c.ok) return reply({ error: c.error }, c.status);
	try {
		const r = await s.stub.record(c.id, c.winner, false, await ipKey(s.secret, clientIp(request)), LIMITS_KEDI.result, LIMITS_KEDI.windowMs);
		const out = r.stats && { games: r.stats.games, human: r.stats.human, cat: r.stats.model, special };
		return r.ok ? reply(out) : reply({ error: r.error, stats: out }, r.status ?? 400);
	} catch { return reply({ error: 'stats unavailable' }, 503); }
};
