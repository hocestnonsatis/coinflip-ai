import { json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';

const H = { 'cache-control': 'no-store' };
export const reply = (body: unknown, status = 200) => json(body, { status, headers: H });

/** The global counter object, or null when the binding/secret is missing (e.g. local dev without the stats Worker). */
export function stats(name: 'global' | 'okey' | 'kedi' = 'global') {
	let e: typeof env;
	try { e = env; if (!e.TAVLA_STATS || !e.TAVLA_SECRET) return null; } catch { return null; }
	return { stub: e.TAVLA_STATS.get(e.TAVLA_STATS.idFromName(name)), secret: e.TAVLA_SECRET, admin: e.TAVLA_ADMIN };
}
export const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? 'local';
