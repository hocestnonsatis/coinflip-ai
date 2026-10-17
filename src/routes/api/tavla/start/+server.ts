import type { RequestHandler } from './$types';
import { reply, stats, clientIp } from '#lib/server/tavla-stats';
import { issueTicket, ipKey, LIMITS } from '#lib/server/tavla-stats-core';
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const s = stats(); if (!s) return reply({ error: 'stats unavailable' }, 503);
	try {
		const left = await s.stub.hit(`s:${await ipKey(s.secret, clientIp(request))}`, LIMITS.start, LIMITS.windowMs);
		const res = left < 0 ? reply({ error: 'rate limited' }, 429) : reply(await issueTicket(s.secret));
		res.headers.set('x-ratelimit-remaining', String(Math.max(0, left)));
		return res;
	} catch { return reply({ error: 'stats unavailable' }, 503); }
};
