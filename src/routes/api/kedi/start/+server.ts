import type { RequestHandler } from './$types';
import { reply, stats, clientIp } from '#lib/server/tavla-stats';
import { issueTicket, ipKey, LIMITS_KEDI } from '#lib/server/tavla-stats-core';
export const prerender = false;

/** POST {} → ticket for a normal round; POST { special: true } → ticket for a cheat / sleepy round (kind 'kedix', its own counter). */
export const POST: RequestHandler = async ({ request }) => {
	const s = stats('kedi'); if (!s) return reply({ error: 'stats unavailable' }, 503);
	let special = false;
	try { if (Number(request.headers.get('content-length') ?? 0) <= 256) special = ((await request.json()) as { special?: unknown })?.special === true; } catch { /* empty body = normal */ }
	try {
		const left = await s.stub.hit(`s:${await ipKey(s.secret, clientIp(request))}`, LIMITS_KEDI.start, LIMITS_KEDI.windowMs);
		const res = left < 0 ? reply({ error: 'rate limited' }, 429) : reply(await issueTicket(s.secret, Date.now(), special ? 'kedix' : 'kedi'));
		res.headers.set('x-ratelimit-remaining', String(Math.max(0, left)));
		return res;
	} catch { return reply({ error: 'stats unavailable' }, 503); }
};
