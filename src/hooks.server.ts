import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

const PATH_LANGS = ['tr', 'de', 'es', 'fr'];

/** Explicit cookie choice wins; otherwise the highest-q Accept-Language we support. English / none → null. */
function preferred(cookie: string | null, acceptLanguage: string | null): string | null {
	const c = /(?:^|;\s*)lang=([a-z]{2})/.exec(cookie ?? '')?.[1];
	if (c) return PATH_LANGS.includes(c) ? c : null;
	const prefs = (acceptLanguage ?? '').split(',').map((p) => {
		const [tag, ...ps] = p.trim().split(';');
		const q = ps.map((x) => x.trim()).find((x) => x.startsWith('q='));
		return { l: tag.slice(0, 2).toLowerCase(), q: q ? parseFloat(q.slice(2)) : 1 };
	}).filter((p) => /^[a-z]{2}$/.test(p.l) && p.q > 0).sort((a, b) => b.q - a.q);
	for (const { l } of prefs) { if (l === 'en') return null; if (PATH_LANGS.includes(l)) return l; }
	return null;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	// English URLs ("/", "/coin", "/dice", "/tavla", "/okey", "/kedi") for non-English visitors → their language URL, so URL, canonical, hreflang and <html lang> always agree.
	// Crawlers (no Accept-Language) and English visitors get the English page.
	if ((pathname === '/' || pathname === '/coin' || pathname === '/dice' || pathname === '/tavla' || pathname === '/okey' || pathname === '/kedi') && !event.isDataRequest && !event.url.searchParams.has('lang')) {
		const l = preferred(event.request.headers.get('cookie'), event.request.headers.get('accept-language'));
		if (l) { event.setHeaders({ vary: 'Accept-Language, Cookie', 'cache-control': 'private, no-store' }); redirect(302, `/${l}${pathname === '/' ? '' : pathname}`); }
		event.setHeaders({ vary: 'Accept-Language, Cookie' });
	}
	const m = pathname.match(/^\/(tr|de|es|fr)(\/|$)/);
	return resolve(event, { transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${m ? m[1] : 'en'}">`) });
};
