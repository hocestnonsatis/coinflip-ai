import type { RequestHandler } from './$types';
import { reply, stats } from '#lib/server/tavla-stats';
export const prerender = false;

/** → { games, human, cat } for the cups game (same SQLite Durable Object class as tavla, instance "kedi"; 'model' = the cat). */
export const GET: RequestHandler = async () => {
	const s = stats('kedi'); if (!s) return reply({ error: 'stats unavailable' }, 503);
	try { const c = await s.stub.stats(); return reply({ games: c.games, human: c.human, cat: c.model }); } catch (e) { console.error('[kedi-stats]', e); return reply({ error: 'stats unavailable' }, 503); }
};
