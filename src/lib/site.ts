import type { Lang } from './i18n';
export const SITE = 'https://tiny-models.anil-oz.workers.dev';
export const REPO = 'https://github.com/hocestnonsatis/coinflip-ai';
export const HF_TAVLA = 'https://huggingface.co/hocestnonsatis/tavla-1.6k';
export const PATH_LANGS = ['tr', 'de', 'es', 'fr'] as const;
export const OG_LOCALE: Record<Lang, string> = { en: 'en_US', tr: 'tr_TR', de: 'de_DE', es: 'es_ES', fr: 'fr_FR' };
export type Slug = '' | 'coin' | 'dice' | 'tavla';
/** ('en','') → '/', ('tr','') → '/tr', ('en','coin') → '/coin', ('tr','coin') → '/tr/coin' */
export const pathFor = (l: Lang, slug: Slug) => (l === 'en' ? '' : `/${l}`) + (slug ? `/${slug}` : '') || '/';
export const urlFor = (l: Lang, slug: Slug) => SITE + pathFor(l, slug);
export function setLangPref(l: Lang) {
	localStorage.setItem('lang', l);
	document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
}
