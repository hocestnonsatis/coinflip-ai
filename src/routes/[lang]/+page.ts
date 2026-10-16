import { error } from '@sveltejs/kit';
import type { Lang } from '#lib/i18n';
const PATH_LANGS = ['tr', 'de', 'es', 'fr'];
export const entries = () => [{ lang: 'tr' }, { lang: 'de' }, { lang: 'es' }, { lang: 'fr' }];
export const load = ({ params }: { params: { lang: string } }) => {
	if (!PATH_LANGS.includes(params.lang)) error(404, 'Not found');
	return { lang: params.lang as Lang };
};
