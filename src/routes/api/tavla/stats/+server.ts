import type { RequestHandler } from './$types';
import { reply, stats } from '#lib/server/tavla-stats';
export const prerender = false;

export const GET: RequestHandler = async () => {
	const s = stats(); if (!s) return reply({ error: 'stats unavailable' }, 503);
	try { return reply(await s.stub.stats()); } catch (e) { console.error('[tavla-stats]', e); return reply({ error: 'stats unavailable' }, 503); }
};
