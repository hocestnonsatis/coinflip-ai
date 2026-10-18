import type { RequestHandler } from './$types';
import { reply, stats } from '#lib/server/tavla-stats';
import { safeEqual } from '#lib/server/tavla-stats-core';
export const prerender = false;

/** Admin only: `Authorization: Bearer <TAVLA_ADMIN secret>` zeroes the counter (?game=okey / ?game=kedi for the other games). Used after prod smoke tests.
 *  `?dry=1` only checks the token (200 { dry: true }) without touching any counter. */
export const POST: RequestHandler = async ({ request }) => {
	const s = stats();
	const tok = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
	if (!s || !s.admin || s.admin.length < 32 || !safeEqual(tok, s.admin)) return reply({ error: 'forbidden' }, 403);
	const q = new URL(request.url).searchParams, g = q.get('game'), which = g === 'okey' || g === 'kedi' ? g : 'global';
	if (q.has('dry')) return reply({ ok: true, dry: true, game: which }); // auth check only, nothing is reset
	return reply(await (which === 'global' ? s : stats(which)!).stub.reset());
};
