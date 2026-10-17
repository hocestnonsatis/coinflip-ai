import type { RequestHandler } from './$types';
import { reply, stats } from '#lib/server/tavla-stats';
import { safeEqual } from '#lib/server/tavla-stats-core';
export const prerender = false;

/** Admin only: `Authorization: Bearer <TAVLA_ADMIN secret>` zeroes the counter (used after the prod smoke test). */
export const POST: RequestHandler = async ({ request }) => {
	const s = stats();
	const tok = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
	if (!s || !s.admin || s.admin.length < 32 || !safeEqual(tok, s.admin)) return reply({ error: 'forbidden' }, 403);
	return reply(await s.stub.reset());
};
