import type { Lang } from './i18n';

// "↻ Regenerate" button next to a streamed oracle comment (coin & dice): same result, freshly sampled commentary.
export type RegenDict = { regen: string; log: (n: number) => string };
export const REGEN: Record<Lang, RegenDict> = {
	tr: { regen: '↻ Yeniden üret', log: (n) => `↻ Yanıt #${n} yeniden üretiliyor… aynı ağırlıklar, aynı sonuç, yeni bahane.` },
	en: { regen: '↻ Regenerate', log: (n) => `↻ Regenerating response #${n}… same weights, same result, fresh excuse.` },
	de: { regen: '↻ Neu generieren', log: (n) => `↻ Antwort #${n} wird neu generiert… gleiche Gewichte, gleiches Ergebnis, neue Ausrede.` },
	es: { regen: '↻ Regenerar', log: (n) => `↻ Regenerando la respuesta n.º ${n}… mismos pesos, mismo resultado, excusa nueva.` },
	fr: { regen: '↻ Régénérer', log: (n) => `↻ Régénération de la réponse n° ${n}… mêmes poids, même résultat, nouvelle excuse.` }
};
/** Random index in [0, len) that differs from `prev` when possible. */
export function pickOther(len: number, prev: number, rnd = Math.random) {
	if (len <= 1) return 0;
	if (prev < 0 || prev >= len) return Math.floor(rnd() * len);
	return (prev + 1 + Math.floor(rnd() * (len - 1))) % len;
}
