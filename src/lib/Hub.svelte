<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { LANGS, type Lang } from '#lib/i18n';
	import { HUB, type HubCard } from '#lib/i18n-hub';
	import { SITE, REPO, pathFor, urlFor, setLangPref } from '#lib/site';
	import Seo from './Seo.svelte';
	import { STATS } from '#lib/tavla-stats';

	let { data }: { data: { lang: Lang | null } } = $props();
	const initialLang = (() => data.lang ?? 'en')();
	let lang = $state<Lang>(initialLang);
	const h = $derived(HUB[lang]);
	type Item = { key: 'coin' | 'dice' | 'tavla' | 'rps' | 'ball'; params: number; card: HubCard; href?: string };
	const pc = $derived(new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 }));
	const tavlaCard = $derived<HubCard>({ ...h.tavla, stats: h.tavla.stats.map(([k, v]) => [k, v.replace('{r}', pc.format(STATS.vsRandom.w / Math.max(STATS.vsRandom.n, 1))).replace('{h}', pc.format(STATS.vsHeur.w / Math.max(STATS.vsHeur.n, 1))).replace('{kb}', `${(STATS.onnxBytes / 1024).toLocaleString(lang, { maximumFractionDigits: 1 })} KB`)] as [string, string]) });
	const items = $derived<Item[]>([
		{ key: 'coin', params: 1, card: h.coin, href: pathFor(lang, 'coin') },
		{ key: 'dice', params: 6, card: h.dice, href: pathFor(lang, 'dice') },
		{ key: 'tavla', params: STATS.params, card: tavlaCard, href: pathFor(lang, 'tavla') },
		{ key: 'rps', params: 3, card: h.rps },
		{ key: 'ball', params: 20, card: h.ball }
	]);
	const jsonLd = $derived({
		'@context': 'https://schema.org', '@graph': [
			{ '@type': 'WebSite', name: 'Tiny Models', url: urlFor(lang, ''), description: h.desc, inLanguage: lang, author: { '@type': 'Person', name: 'Anıl ÖZ' }, sameAs: [REPO] },
			{ '@type': 'ItemList', itemListElement: items.filter((i) => i.href).map((i, n) => ({ '@type': 'ListItem', position: n + 1, url: SITE + i.href, name: i.card.name })) }
		]
	});
	onMount(() => {
		const q = new URLSearchParams(location.search).get('lang') as Lang | null;
		if (data.lang) lang = data.lang;
		else if (q && LANGS.some((l) => l.code === q)) { lang = q; localStorage.setItem('lang', q); window.history.replaceState(window.history.state, '', pathFor(q, '')); }
	});
	$effect(() => { document.documentElement.lang = lang; });
	function setLang(l: Lang) { lang = l; setLangPref(l); try { replaceState(pathFor(l, ''), {}); } catch { /* router not ready */ } }
</script>

<Seo {lang} slug="" title={h.title} desc={h.desc} image="/og.png" {jsonLd} />

<div class="table" aria-hidden="true"></div>
<main>
	<header>
		<span class="brand"><span class="dot"></span> Tiny Models</span>
		<select class="lang" aria-label="Language" value={lang} onchange={(e) => setLang(e.currentTarget.value as Lang)}>
			{#each LANGS as l (l.code)}<option value={l.code}>{l.code.toUpperCase()} · {l.name}</option>{/each}
		</select>
	</header>
	<section class="hero">
		<h1>{h.h1}</h1>
		<p>{h.lead}</p>
	</section>
	<ul class="cards">
		{#each items as it (it.key)}
			<li class="card" class:soon={it.card.soon}>
				<div class="icon" aria-hidden="true">
					{#if it.key === 'coin'}<div class="coin"><span>1P</span></div>
					{:else if it.key === 'dice'}<div class="cube">{#each [1, 2, 3, 4, 5, 6] as f (f)}<div class="f f{f}">{#each Array(f) as _, i (i)}<i></i>{/each}</div>{/each}</div>
					{:else if it.key === 'tavla'}<div class="tavla"><i></i><i></i><i></i><i></i><b></b><b></b></div>
					{:else if it.key === 'rps'}<div class="hands"><span>✊</span><span>✋</span><span>✌️</span></div>
					{:else}<div class="ball"><span>8</span></div>{/if}
				</div>
				<div class="body">
					<h2>{it.card.name}</h2>
					<p class="params mono">{h.params(it.params)}</p>
					<p class="tag">{it.card.tagline}</p>
					<dl class="mono">{#each it.card.stats as [k, v] (k)}<div><dt>{k}</dt><dd>{v}</dd></div>{/each}</dl>
				</div>
				{#if it.href}<a class="run" href={it.href}>{h.run} ▸</a>{:else}<span class="badge-soon">{h.soon}</span>{/if}
			</li>
		{/each}
	</ul>
	<footer class="mono">{h.footer} · <a href={REPO} rel="noopener">GitHub</a></footer>
</main>

<style>
	:global(html) { background: #07070c; }
	:global(html, body) { margin: 0; min-height: 100%; overflow: auto; color: #eae6da; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
	:global(body) { background: transparent; }
	.mono { font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace; }
	.table { position: fixed; inset: 0; z-index: -1;
		background:
			radial-gradient(ellipse 55% 50% at 50% 18%, #ffb36b40, transparent 70%),
			radial-gradient(ellipse 130% 100% at 50% 25%, transparent 35%, #050403d0 90%),
			repeating-linear-gradient(90deg, #00000055 0 3px, transparent 3px 16.66vw),
			repeating-linear-gradient(91deg, #ffffff06 0 2px, transparent 2px 11px),
			repeating-linear-gradient(89deg, #0000001a 0 1px, transparent 1px 7px),
			linear-gradient(180deg, #5a321a, #3b200e 55%, #1c0f07); }
	main { max-width: 1060px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 18px 40px; }
	header { display: flex; justify-content: space-between; align-items: center; }
	.brand { font-weight: 800; letter-spacing: 0.02em; display: flex; align-items: center; gap: 8px; }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: #36e27e; box-shadow: 0 0 12px #36e27e; }
	.lang { font: inherit; font-size: 12px; color: #eae6da; background: #14141f; border: 1px solid #ffffff2a; border-radius: 99px; padding: 5px 8px; cursor: pointer; }
	.hero { text-align: center; margin: 7vh 0 5vh; }
	h1 { margin: 0; font-family: Georgia, serif; font-size: clamp(44px, 9vw, 92px); letter-spacing: 0.03em; background: linear-gradient(180deg, #fff3c4, #e0a33a 60%, #8a5a14); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 24px #ffb34055); }
	.hero p { max-width: 620px; margin: 10px auto 0; line-height: 1.55; opacity: 0.85; }
	.cards { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
	.card { position: relative; display: flex; flex-direction: column; background: #0c0c16b8; border: 1px solid #ffffff1a; border-radius: 18px; padding: 16px; backdrop-filter: blur(12px); box-shadow: 0 18px 50px #0009; transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; }
	.card:not(.soon):hover { transform: translateY(-4px); border-color: #ffc95a66; box-shadow: 0 24px 60px #000b, 0 0 40px #ffb34022; }
	.card.soon { opacity: 0.85; filter: saturate(0.5); } .card.soon h2 { color: #d8c7a0; }
	.icon { height: 110px; display: grid; place-items: center; perspective: 500px; }
	.body { flex: 1; }
	h2 { margin: 6px 0 0; font-family: Georgia, serif; font-size: 22px; color: #ffe08a; }
	.params { margin: 2px 0 8px; font-size: 12px; color: #8ff5b7; }
	.tag { margin: 0 0 10px; font-size: 14px; line-height: 1.4; opacity: 0.9; }
	dl { margin: 0 0 14px; font-size: 11px; display: grid; gap: 3px; }
	dl div { display: flex; justify-content: space-between; border-bottom: 1px dashed #ffffff14; padding-bottom: 2px; }
	dt { color: #b3ab9c; } dd { margin: 0; }
	.run { display: block; text-align: center; padding: 11px; font-weight: 800; text-decoration: none; color: #1a1205; border-radius: 12px; background: linear-gradient(180deg, #ffe08a, #e9a23b); box-shadow: 0 8px 24px #ffae3a44, inset 0 1px 0 #fff8; }
	.run:hover { filter: brightness(1.08); }
	.run::after { content: ''; position: absolute; inset: 0; border-radius: 18px; } /* whole card clickable */
	.badge-soon { display: block; text-align: center; padding: 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; border: 1px dashed #ffffff40; border-radius: 12px; opacity: 0.85; }
	footer { text-align: center; margin-top: 36px; font-size: 12px; opacity: 0.55; } footer a { color: inherit; }
	/* mini previews */
	.coin { width: 74px; height: 74px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 38% 32%, #ffe9a8, #e0ad4a 60%, #9a6a1c); box-shadow: inset 0 0 0 5px #b8862e, inset 0 0 0 8px #e9c46a, 0 10px 24px #000a; font: 900 24px Georgia, serif; color: #7a4f12; animation: flip 2.4s cubic-bezier(0.5, 0, 0.3, 1) infinite; }
	@keyframes flip { 0% { transform: translateY(0) rotateX(0); } 45% { transform: translateY(-18px) rotateX(540deg); } 60%, 100% { transform: translateY(0) rotateX(720deg); } }
	.cube { --s: 56px; width: var(--s); height: var(--s); position: relative; transform-style: preserve-3d; animation: tumble 5s linear infinite; }
	.f { position: absolute; inset: 0; background: radial-gradient(circle at 40% 35%, #fbf3df, #e4d3ac); border-radius: 10px; box-shadow: inset 0 0 8px #0003; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); padding: 7px; box-sizing: border-box; }
	.f i { width: 9px; height: 9px; border-radius: 50%; background: #1b130c; place-self: center; }
	.f1 i { background: #a3161a; grid-area: 2 / 2; width: 12px; height: 12px; }
	.f2 i:nth-child(1) { grid-area: 1 / 1; } .f2 i:nth-child(2) { grid-area: 3 / 3; }
	.f3 i:nth-child(1) { grid-area: 1 / 1; } .f3 i:nth-child(2) { grid-area: 2 / 2; } .f3 i:nth-child(3) { grid-area: 3 / 3; }
	.f4 i:nth-child(1) { grid-area: 1 / 1; } .f4 i:nth-child(2) { grid-area: 1 / 3; } .f4 i:nth-child(3) { grid-area: 3 / 1; } .f4 i:nth-child(4) { grid-area: 3 / 3; }
	.f5 i:nth-child(1) { grid-area: 1 / 1; } .f5 i:nth-child(2) { grid-area: 1 / 3; } .f5 i:nth-child(3) { grid-area: 2 / 2; } .f5 i:nth-child(4) { grid-area: 3 / 1; } .f5 i:nth-child(5) { grid-area: 3 / 3; }
	.f6 { grid-template-columns: repeat(2, 1fr); } .f6 i:nth-child(odd) { grid-column: 1; } .f6 i:nth-child(even) { grid-column: 2; }
	.f1 { transform: translateZ(28px); } .f6 { transform: rotateY(180deg) translateZ(28px); } .f2 { transform: rotateY(90deg) translateZ(28px); }
	.f5 { transform: rotateY(-90deg) translateZ(28px); } .f3 { transform: rotateX(90deg) translateZ(28px); } .f4 { transform: rotateX(-90deg) translateZ(28px); }
	@keyframes tumble { from { transform: rotateX(-20deg) rotateY(0) rotateZ(10deg); } to { transform: rotateX(340deg) rotateY(360deg) rotateZ(370deg); } }
	.tavla { width: 74px; height: 56px; border-radius: 6px; background: #5a321a; border: 3px solid #2a160a; position: relative; display: flex; justify-content: space-around; overflow: hidden; }
	.tavla i { width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 26px solid #e9d7ae; }
	.tavla i:nth-child(even) { border-top-color: #8f2d22; }
	.tavla b { position: absolute; width: 14px; height: 14px; border-radius: 50%; bottom: 4px; left: 12px; background: radial-gradient(circle at 40% 35%, #fffaf0, #d9c7a0); box-shadow: 0 2px 3px #0008; }
	.tavla b + b { left: 44px; background: radial-gradient(circle at 40% 35%, #6b2a22, #2a0d09); animation: hop 2.4s ease-in-out infinite; }
	@keyframes hop { 50% { transform: translate(-16px, -26px); } }
	.hands { position: relative; width: 70px; height: 70px; font-size: 52px; }
	.hands span { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; animation: rps 3s infinite; }
	.hands span:nth-child(2) { animation-delay: 1s; } .hands span:nth-child(3) { animation-delay: 2s; }
	@keyframes rps { 0%, 30% { opacity: 1; transform: scale(1); } 33%, 100% { opacity: 0; transform: scale(0.7); } }
	.ball { width: 74px; height: 74px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #555, #111 55%, #000); box-shadow: 0 10px 24px #000a; display: grid; place-items: center; animation: shake 2.8s ease-in-out infinite; }
	.ball span { width: 30px; height: 30px; border-radius: 50%; background: #f3efe6; color: #111; display: grid; place-items: center; font: 900 18px Georgia, serif; }
	@keyframes shake { 0%, 70%, 100% { transform: rotate(0); } 75% { transform: rotate(-12deg); } 85% { transform: rotate(10deg); } 92% { transform: rotate(-5deg); } }
	@media (prefers-reduced-motion: reduce) { .coin, .cube, .hands span, .ball { animation: none; } .hands span:first-child { opacity: 1; } }
</style>
