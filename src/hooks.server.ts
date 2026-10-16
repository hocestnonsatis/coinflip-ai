import type { Handle } from '@sveltejs/kit/hooks';
// Set <html lang> in SSR/prerendered HTML from the path (/tr, /de, /es, /fr; default en)
export const handle: Handle = ({ event, resolve }) => {
	const m = event.url.pathname.match(/^\/(tr|de|es|fr)(\/|$)/);
	return resolve(event, { transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${m ? m[1] : 'en'}">`) });
};
