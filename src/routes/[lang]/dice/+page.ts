import { error } from '@sveltejs/kit';
import type { Lang } from '#lib/i18n';
import { PATH_LANGS } from '#lib/site';
export const entries = () => PATH_LANGS.map((lang) => ({ lang }));
export const load = ({ params }: { params: { lang: string } }) => {
	if (!(PATH_LANGS as readonly string[]).includes(params.lang)) error(404, 'Not found');
	return { lang: params.lang as Lang };
};
