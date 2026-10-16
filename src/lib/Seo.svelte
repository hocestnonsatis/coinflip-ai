<script lang="ts">
	import { LANGS, type Lang } from './i18n';
	import { OG_LOCALE, SITE, urlFor, type Slug } from './site';
	let { lang, slug, title, desc, image, siteName = 'Tiny Models', jsonLd }: { lang: Lang; slug: Slug; title: string; desc: string; image: string; siteName?: string; jsonLd: object } = $props();
	const ld = $derived(JSON.stringify(jsonLd).replace(/</g, '\\u003c'));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={urlFor(lang, slug)} />
	{#each LANGS as l (l.code)}<link rel="alternate" hreflang={l.code} href={urlFor(l.code, slug)} />{/each}
	<link rel="alternate" hreflang="x-default" href={urlFor('en', slug)} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={siteName} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={urlFor(lang, slug)} />
	<meta property="og:image" content={`${SITE}${image}`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={title} />
	<meta property="og:locale" content={OG_LOCALE[lang]} />
	{#each LANGS.filter((l) => l.code !== lang) as l (l.code)}<meta property="og:locale:alternate" content={OG_LOCALE[l.code]} />{/each}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={desc} />
	<meta name="twitter:image" content={`${SITE}${image}`} />
	{@html `<script type="application/ld+json">${ld}</script>`}
</svelte:head>
