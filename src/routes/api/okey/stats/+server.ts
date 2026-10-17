import type { RequestHandler } from './$types';
import { reply, stats } from '#lib/server/tavla-stats';
export const prerender = false;

/** → { games, human, bots, draws } for okey (same SQLite Durable Object class as tavla, instance "okey"). */
export const GET: RequestHandler = async () => {
	const s = stats('okey'); if (!s) return reply({ error: 'stats unavailable' }, 503);
	try { const c = await s.stub.stats(); return reply({ games: c.games, human: c.human, bots: c.model, draws: c.draw ?? 0 }); } catch (e) { console.error('[okey-stats]', e); return reply({ error: 'stats unavailable' }, 503); }
};
