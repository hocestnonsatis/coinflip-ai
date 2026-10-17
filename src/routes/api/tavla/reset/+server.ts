import type { RequestHandler } from './$types';
import { reply, stats } from '#lib/server/tavla-stats';
import { safeEqual } from '#lib/server/tavla-stats-core';
export const prerender = false;

/** Admin only: `Authorization: Bearer <TAVLA_ADMIN secret>` zeroes the counter (?game=okey for the okey one). Used after prod smoke tests. */
export const POST: RequestHandler = async ({ request }) => {
	const s = stats();
	const tok = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
	if (!s || !s.admin || s.admin.length < 32 || !safeEqual(tok, s.admin)) return reply({ error: 'forbidden' }, 403);
	const which = new URL(request.url).searchParams.get('game') === 'okey' ? 'okey' : 'global';
	return reply(await (which === 'okey' ? stats('okey')! : s).stub.reset());
};
