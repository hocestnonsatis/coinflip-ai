import type { RequestHandler } from './$types';
import { reply, stats, clientIp } from '#lib/server/tavla-stats';
import { checkResult, ipKey, LIMITS } from '#lib/server/tavla-stats-core';
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const s = stats(); if (!s) return reply({ error: 'stats unavailable' }, 503);
	if (Number(request.headers.get('content-length') ?? 0) > 2048) return reply({ error: 'too large' }, 413);
	let body: unknown; try { body = await request.json(); } catch { return reply({ error: 'bad json' }, 400); }
	const c = await checkResult(s.secret, body);
	if (!c.ok) return reply({ error: c.error }, c.status);
	try {
		const r = await s.stub.record(c.id, c.winner, c.gammon, await ipKey(s.secret, clientIp(request)), LIMITS.result, LIMITS.windowMs);
		return r.ok ? reply(r.stats) : reply({ error: r.error, stats: r.stats }, r.status ?? 400);
	} catch { return reply({ error: 'stats unavailable' }, 503); }
};
