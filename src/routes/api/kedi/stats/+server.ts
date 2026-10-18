import type { RequestHandler } from './$types';
import { reply, stats } from '#lib/server/tavla-stats';
export const prerender = false;

/** → { games, human, cat, special: { games, human, cat } } — honest rounds (instance "kedi") and cheat / sleepy rounds ("kedi-x"),
 *  same SQLite Durable Object class as tavla; 'model' = the cat. */
export const GET: RequestHandler = async () => {
	const s = stats('kedi'), x = stats('kedi-x'); if (!s || !x) return reply({ error: 'stats unavailable' }, 503);
	try {
		const [c, d] = await Promise.all([s.stub.stats(), x.stub.stats()]);
		return reply({ games: c.games, human: c.human, cat: c.model, special: { games: d.games, human: d.human, cat: d.model } });
	} catch (e) { console.error('[kedi-stats]', e); return reply({ error: 'stats unavailable' }, 503); }
};
