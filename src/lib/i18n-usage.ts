import type { Lang } from './i18n';

// 🧾 API-bill parody under the coin panel: counts this session's requests and tokens (question + result + streamed comment,
// regenerations included) and bills them at an absurdly low price. Nothing is stored or sent anywhere.
export const PRICE_PER_MTOK = 0.0000001; // USD per 1M tokens
export const costOf = (tokens: number) => (tokens * PRICE_PER_MTOK) / 1e6;
/** Format a (tiny) USD amount with every one of its glorious zeros. */
export const formatCost = (usd: number, lang: Lang) =>
	new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD', maximumSignificantDigits: 2 }).format(usd);

export type UsageDict = { label: string; req: (n: number) => string; tok: (n: number) => string; note: string };
export const USAGE: Record<Lang, UsageDict> = {
	tr: { label: 'Kullanım', req: (n) => `${n} istek`, tok: (n) => `${n} token`, note: 'Fatura e-postayla gönderilecek. E-postanı bilmiyoruz. Yeniden üretmeler de faturalanır.' },
	en: { label: 'Usage', req: (n) => `${n} request${n === 1 ? '' : 's'}`, tok: (n) => `${n} token${n === 1 ? '' : 's'}`, note: 'Invoice will be emailed. We don’t have your email. Regenerations are billed too.' },
	de: { label: 'Nutzung', req: (n) => `${n} Anfrage${n === 1 ? '' : 'n'}`, tok: (n) => `${n} Token`, note: 'Die Rechnung kommt per E‑Mail. Wir haben deine E‑Mail nicht. Neugenerierungen werden mitberechnet.' },
	es: { label: 'Uso', req: (n) => `${n} solicitud${n === 1 ? '' : 'es'}`, tok: (n) => `${n} token${n === 1 ? '' : 's'}`, note: 'La factura llegará por correo. No tenemos tu correo. Las regeneraciones también se cobran.' },
	fr: { label: 'Utilisation', req: (n) => `${n} requête${n > 1 ? 's' : ''}`, tok: (n) => `${n} jeton${n > 1 ? 's' : ''}`, note: 'La facture sera envoyée par e‑mail. Nous n’avons pas votre e‑mail. Les régénérations sont facturées aussi.' }
};
