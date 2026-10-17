import type { RequestHandler } from './$types';
import { reply, stats, clientIp } from '#lib/server/tavla-stats';
import { checkResult, ipKey, LIMITS_OKEY, RULES_OKEY } from '#lib/server/tavla-stats-core';
export const prerender = false;

/** POST { winner: 'human' | 'model' | 'draw', moves, gameId } — once per signed okey ticket. */
export const POST: RequestHandler = async ({ request }) => {
	const s = stats('okey'); if (!s) return reply({ error: 'stats unavailable' }, 503);
	if (Number(request.headers.get('content-length') ?? 0) > 2048) return reply({ error: 'too large' }, 413);
	let body: unknown; try { body = await request.json(); } catch { return reply({ error: 'bad json' }, 400); }
	const c = await checkResult(s.secret, body, Date.now(), 'okey', RULES_OKEY);
	if (!c.ok) return reply({ error: c.error }, c.status);
	try {
		const r = await s.stub.record(c.id, c.winner, false, await ipKey(s.secret, clientIp(request)), LIMITS_OKEY.result, LIMITS_OKEY.windowMs);
		const out = r.stats && { games: r.stats.games, human: r.stats.human, bots: r.stats.model, draws: r.stats.draw ?? 0 };
		return r.ok ? reply(out) : reply({ error: r.error, stats: out }, r.status ?? 400);
	} catch { return reply({ error: 'stats unavailable' }, 503); }
};
