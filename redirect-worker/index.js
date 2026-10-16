// Old address coinflip-ai.anil-oz.workers.dev → permanent redirect to the Tiny Models hub.
// /, /tr, /de, /es, /fr (± trailing slash) → /coin, /tr/coin, …; anything else keeps its path.
const TARGET = 'https://tiny-models.anil-oz.workers.dev';
export default {
	fetch(req) {
		const url = new URL(req.url);
		const m = url.pathname.match(/^\/(?:(tr|de|es|fr)\/?)?$/);
		const path = m ? (m[1] ? `/${m[1]}/coin` : '/coin') : url.pathname;
		return new Response(null, { status: 301, headers: { location: TARGET + path + url.search, 'cache-control': 'public, max-age=86400' } });
	}
};
