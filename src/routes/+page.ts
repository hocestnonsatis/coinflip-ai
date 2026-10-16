// English URL: rendered per request (not prerendered) so hooks.server.ts can redirect by cookie / Accept-Language.
export const prerender = false;
export const load = () => ({ lang: null });
