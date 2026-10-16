<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { inferDice, finish, gumbels, softmax, logitsOf } from '#lib/dice-model';
	import { LANGS, type Lang } from '#lib/i18n';
	import { DICE } from '#lib/i18n-dice';
	import { HUB } from '#lib/i18n-hub';
	import { SITE, REPO, pathFor, urlFor, setLangPref } from '#lib/site';
	import type { DiceScene } from '#lib/dice-scene';
	import type { Backend } from '#lib/engine';
	import Seo from './Seo.svelte';

	type Phase = 'loading' | 'ready' | 'thinking' | 'rolling' | 'done';
	type Result = { face: number; rare: boolean; confidence: number; tps: number; ms: number };
	let { data }: { data: { lang: Lang | null } } = $props();
	let canvas: HTMLCanvasElement;
	let scene: DiceScene | undefined;
	let phase = $state<Phase>('loading');
	let loadPct = $state(0);
	let log = $state<string[]>([]);
	const initialLang = (() => data.lang ?? 'en')();
	let lang = $state<Lang>(initialLang);
	const t = $derived(DICE[lang]);
	const pct = $derived(new Intl.NumberFormat(lang, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	const num = (n: number, d = 3) => n.toLocaleString(lang, { minimumFractionDigits: d, maximumFractionDigits: d });
	let last = $state<Result | null>(null);
	let history = $state<number[]>([]);
	let legendary = $state(false);
	let reduced = $state(false);
	let webglError = $state(false);
	let question = $state('');
	let asked = $state('');
	let oracle = $state('');
	let oracleShown = $state('');
	let streaming = $state(false);
	let streamId = 0;
	let engine = $state<Backend | 'loading'>('loading');
	let engineMod: typeof import('#lib/dice-engine') | undefined;
	let copyFeedback = $state<'idle' | 'ok' | 'fail'>('idle');
	let copyTimer = 0;
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const push = (l: string) => (log = [...log.slice(-4), l]);
	const busy = $derived(phase === 'thinking' || phase === 'rolling' || phase === 'loading');
	const engineName = (e: Backend | 'loading') => (e === 'webgpu' ? 'ONNX Runtime · WebGPU' : e === 'wasm' ? 'ONNX Runtime · WASM' : e === 'loading' ? '…' : t.engineTs);
	const label = (r: Result) => (r.rare ? t.rareLabel : String(r.face));
	

	const tokenize = (text: string) => (text.match(/\S+\s*|\s+/g) ?? []).flatMap((w) => (w.length > 6 ? w.match(/.{1,4}/gsu) ?? [w] : [w]));
	async function streamOracle(text: string) {
		const id = ++streamId;
		oracle = text;
		if (!text || reduced) { oracleShown = text; streaming = false; return; }
		oracleShown = ''; streaming = true;
		await sleep(250 + Math.random() * 350);
		for (const tok of tokenize(text)) {
			if (id !== streamId) return;
			oracleShown += tok;
			await sleep(25 + Math.random() * 65 + (/[.,!?;:…]\s*$/.test(tok) ? 120 : 0));
		}
		if (id === streamId) streaming = false;
	}
	function fill(line: string, v: { face: number; conf: number; tps: number; ms: number }) {
		const map: Record<string, string> = { face: String(v.face), conf: pct.format(v.conf), tps: v.tps.toLocaleString(lang), ms: num(v.ms, 0) };
		return line.replace(/\{(face|conf|tps|ms)\}/g, (_, k) => map[k]);
	}
	function formatTps(n: number) {
		if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
		if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
		return n.toLocaleString(lang);
	}
	function verdictText() {
		if (!last) return '';
		const conf = pct.format(last.confidence), tps = formatTps(last.tps);
		const q = asked.replace(/[?？]+$/, '');
		return `DiceRoll-6P · ${q ? `“${q}?” → ` : ''}${label(last)} · conf ${conf} · ${tps} tok/s`;
	}
	async function copyVerdict() {
		if (!last) return;
		clearTimeout(copyTimer);
		try { await navigator.clipboard.writeText(verdictText()); copyFeedback = 'ok'; } catch { copyFeedback = 'fail'; }
		copyTimer = window.setTimeout(() => (copyFeedback = 'idle'), 1500);
	}
	const count = (f: number) => history.filter((h) => h === f).length;

	const jsonLd = $derived({
		'@context': 'https://schema.org', '@type': 'WebApplication', name: 'DiceRoll‑6P', alternateName: t.title,
		url: urlFor(lang, 'dice'), description: t.desc, inLanguage: lang, applicationCategory: 'EntertainmentApplication',
		operatingSystem: 'Any (web browser)', browserRequirements: 'Requires JavaScript and WebGL', isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Anıl ÖZ' }, sameAs: [REPO],
		image: `${SITE}/og-dice.png`, isPartOf: { '@type': 'WebSite', name: 'Tiny Models', url: `${SITE}/` }
	});

	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = mq.matches;
		const q = new URLSearchParams(location.search).get('lang') as Lang | null;
		if (data.lang) lang = data.lang;
		else if (q && LANGS.some((l) => l.code === q)) { lang = q; localStorage.setItem('lang', q); window.history.replaceState(window.history.state, '', pathFor(q, 'dice')); }
		const onMq = () => (reduced = mq.matches);
		mq.addEventListener('change', onMq);
		let cancelled = false;
		(async () => {
			try {
				const mod = await import('#lib/dice-scene');
				if (cancelled) return;
				scene = mod.createDiceScene(canvas);
			} catch (e) { console.error(e); webglError = true; }
			push(`▸ ${t.loading}…`);
			for (let i = 0; i <= 4; i++) { loadPct = i * 25; await sleep(reduced ? 30 : 220); }
			push(`▸ ${t.weightsPlain}`);
			phase = 'ready';
			await new Promise((r) => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 2000 }) : setTimeout(r, 300)));
			try { engineMod = await import('#lib/dice-engine'); engine = await engineMod.loadDiceEngine(); } catch { engine = 'ts'; }
			if (!cancelled && engine !== 'ts') push(`▸ ${t.engineLabel}: ${engineName(engine)}`);
		})();
		return () => { cancelled = true; mq.removeEventListener('change', onMq); scene?.destroy(); };
	});
	$effect(() => { document.documentElement.lang = lang; });
	function setLang(l: Lang) { lang = l; setLangPref(l); try { replaceState(pathFor(l, 'dice'), {}); } catch { /* router not ready */ } }

	const HOLD_CAP = 3000;
	let holding = $state(false);
	let charge = $state(0);
	let holdStart = 0, holdRaf = 0;
	function startHold() {
		if (busy || holding) return;
		holding = true; holdStart = performance.now();
		const tick = () => {
			const ms = performance.now() - holdStart;
			charge = Math.min(ms / HOLD_CAP, 1) + (ms > HOLD_CAP ? 0.2 : 0);
			scene?.setCharge(charge);
			holdRaf = requestAnimationFrame(tick);
		};
		tick();
	}
	function release() {
		if (!holding) return;
		holding = false; cancelAnimationFrame(holdRaf);
		const holdMs = performance.now() - holdStart;
		charge = 0; scene?.setCharge(0);
		roll(holdMs);
	}
	function cancelHold() { if (holding) release(); }
	const isTrigger = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';

	async function roll(holdMs: number) {
		if (busy) return;
		asked = question.trim();
		streamId++; oracle = ''; oracleShown = ''; streaming = false;
		clearTimeout(copyTimer); copyFeedback = 'idle';
		legendary = false;
		const power = Math.min(holdMs, HOLD_CAP) / HOLD_CAP;
		phase = 'thinking'; scene?.setThinking(1);
		let ms = engineMod ? await engineMod.benchDice() : null; // real ORT session.run timing
		if (ms === null) {
			const t0 = performance.now(); let i = 0, el = 0;
			do { for (let k = 0; k < 200; k++) inferDice(holdMs + (i * 200 + k) * 1e-3); i++; el = performance.now() - t0; } while (el < 50 && i < 200);
			ms = Math.max(el / (i * 200), 1e-6);
		}
		const { g, rare } = gumbels(holdMs);
		const p = engineMod && engine !== 'ts' && engine !== 'loading' ? await engineMod.runDice(g) : softmax(logitsOf(g)); // p from ONNX Runtime (or TS)
		const out = finish(g, p, rare);
		scene?.setThinking(0);
		push(t.quips[Math.floor(Math.random() * t.quips.length)]);
		if (holdMs > HOLD_CAP) push(`⚡ ${t.overcharge}`);
		push(`▸ ${t.holdLog(num(holdMs))} → softmax(g+b) = [${p.map((v) => num(v, 2)).join(' ')}]`);
		phase = 'rolling';
		const done = () => {
			last = { face: out.face, rare: out.rare, confidence: out.confidence, ms, tps: Math.round(1000 / ms) };
			history = [out.face, ...history].slice(0, 60);
			phase = 'done';
			const pool = out.rare ? t.rareLines : [...t.lines, ...(out.face <= 2 ? t.lowLines : out.face >= 5 ? t.highLines : [])];
			const q = asked.replace(/[?？]+$/, '');
			streamOracle(q ? `“${q}?” — ${fill(pool[Math.floor(Math.random() * pool.length)], { face: out.face, conf: out.confidence, tps: last.tps, ms: holdMs })}` : '');
			push(t.output(label(last), pct.format(out.confidence)));
		};
		if (scene) scene.rollDie({ face: out.face, rare: out.rare, reducedMotion: reduced, power, onLegendary: () => (legendary = true), onDone: done });
		else { if (out.rare) legendary = true; done(); }
	}
</script>

<Seo {lang} slug="dice" title={t.title} desc={t.desc} image="/og-dice.png" {jsonLd} />
<svelte:window onkeydown={(e) => { const tag = (e.target as HTMLElement).tagName; if (tag === 'SELECT' || tag === 'SUMMARY' || tag === 'A' || !isTrigger(e)) return; if (tag === 'INPUT' && e.code === 'Space') return; e.preventDefault(); if (!e.repeat) startHold(); }}
	onkeyup={(e) => { if (isTrigger(e) && holding) { e.preventDefault(); release(); } }}
	onblur={cancelHold} />

<canvas bind:this={canvas} class="stage" aria-hidden="true"></canvas>

<main class:reduced>
	<header>
		<a class="back" href={pathFor(lang, '')} aria-label={HUB[lang].back}>←</a>
		<h1 class="brand"><span class="dot" class:live={phase !== 'loading'}></span> DiceRoll‑6P <small>v0.0.6‑cubic</small><span class="sr-only"> · {t.title.split('·').slice(1).join('·').trim()}</span></h1>
		<div class="right">
			<div class="badges"><span class="sota">{t.badges[0]}</span><span>{t.badges[1]}</span><span>{t.badges[2]}</span></div>
			<select class="lang" aria-label="Language" value={lang} onchange={(e) => setLang(e.currentTarget.value as Lang)}>
				{#each LANGS as l (l.code)}<option value={l.code}>{l.code.toUpperCase()} · {l.name}</option>{/each}
			</select>
		</div>
	</header>
	<noscript><p class="noscript">{t.desc} {t.pitch}</p></noscript>

	{#if phase === 'loading'}
		<div class="loader" role="status">
			<p>{t.loading} <b>(24 B)</b>…</p>
			<div class="bar"><div style:width="{loadPct}%"></div></div>
			<p class="mono">{t.loadSub(loadPct / 25)}</p>
		</div>
	{/if}

	<section class="result" aria-live="polite">
		{#if legendary}<div class="legendary" role="status"><b>★ {t.legendary} ★</b><span>{t.legendarySub}</span></div>{/if}
		{#if holding}
			<h2 class="think">{charge > 1 ? '⚡' : t.charging}</h2>
		{:else if phase === 'done' && last}
			<h2 class="pop" class:edge={last.rare}>{label(last)}</h2>
			{#if oracle}<p class="oracle" aria-busy={streaming}>{oracleShown}{#if streaming}<span class="cursor" aria-hidden="true">▍</span>{/if}</p>{/if}
			<p>{t.confidence}: <b>{pct.format(last.confidence)}</b> <span class="conf"><span style:width="{last.confidence * 100}%"></span></span></p>
			<button type="button" class="copy" onclick={copyVerdict}>{#if copyFeedback === 'ok'}{t.copied}{:else if copyFeedback === 'fail'}{t.copyFail}{:else}{t.copy}{/if}</button>
		{:else if phase === 'thinking'}
			<h2 class="think">{t.thinking}<span>.</span><span>.</span><span>.</span></h2>
		{:else if phase === 'rolling'}
			<h2 class="think">{t.inferring}</h2>
		{/if}
	</section>

	<div class="panel">
		<div class="stats mono">
			<div><small>{t.stats[0]}</small><b>{last ? last.tps.toLocaleString(lang) : '—'}</b></div>
			<div><small>{t.stats[1]}</small><b>{last ? num(last.ms) + ' ms' : '—'}</b></div>
			<div><small>{t.stats[2]}</small><b>{history.length}</b></div>
			<div><small>{t.stats[3]}</small><b>{last ? pct.format(last.confidence) : '—'}</b></div>
		</div>
		<div class="tally mono" aria-label={t.stats[2]}>{#each [1, 2, 3, 4, 5, 6] as f (f)}<span><i>{f}</i>{count(f)}</span>{/each}</div>
		<p class="engine mono">{t.engineLabel}: {engineName(engine)}</p>
		<div class="log mono">{#each log as l, i (i + l)}<div>{l}</div>{/each}</div>
		<form class="ask" onsubmit={(e) => e.preventDefault()}>
			<p class="pitch">{t.pitch}</p>
			<input bind:value={question} maxlength="120" placeholder={t.placeholder} aria-label={t.placeholder} enterkeyhint="send" disabled={busy} />
		</form>
		<button class="hold" class:holding class:over={charge > 1} disabled={busy} style:--charge={Math.min(charge, 1)}
			onpointerdown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); startHold(); }}
			onpointerup={release} onpointercancel={release} oncontextmenu={(e) => e.preventDefault()}
			onkeydown={(e) => { if (isTrigger(e)) e.preventDefault(); }}>
			<span class="meter" aria-hidden="true"></span>
			<span class="lbl">{#if phase === 'loading'}{t.loadingBtn}{:else if busy}{t.busyBtn}{:else if holding}{charge > 1 ? '⚡ ' + t.overcharge.split('!')[0] + '!' : t.charging + ' ' + Math.round(Math.min(charge, 1) * 100) + '%'}{:else if question.trim()}{t.ask}{:else}{t.roll}{/if}</span>
		</button>
		<p class="hint">{t.hint}</p>
		<details>
			<summary>{t.cardTitle}</summary>
			<ul>{#each t.card as [k, v] (k)}<li><b>{k}:</b> {v}</li>{/each}</ul>
		</details>
		{#if webglError}<p class="warn">{t.noWebgl}</p>{/if}
	</div>
</main>

<style>
	:global(html, body) { margin: 0; height: 100%; background: #07070c; color: #eae6da; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
	.stage { position: fixed; inset: 0; width: 100vw; height: 100dvh; display: block; }
	main { position: fixed; inset: 0; display: grid; grid-template-rows: auto 1fr auto; pointer-events: none; padding: max(14px, env(safe-area-inset-top)) 16px max(14px, env(safe-area-inset-bottom)); }
	main > * { pointer-events: auto; }
	.mono { font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace; }
	header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
	header > a + h1 { margin-right: auto; }
	.back { color: #eae6da; text-decoration: none; font-size: 18px; opacity: 0.6; padding: 2px 8px 2px 0; } .back:hover { opacity: 1; color: #ffe08a; }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
	.noscript { max-width: 560px; margin: 24px auto; text-align: center; line-height: 1.5; }
	.brand { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 0.02em; display: flex; align-items: center; gap: 8px; }
	.brand small { opacity: 0.5; font-weight: 500; }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: #f5a524; box-shadow: 0 0 10px #f5a524; }
	.dot.live { background: #36e27e; box-shadow: 0 0 12px #36e27e; animation: pulse 2s infinite; }
	.right { display: flex; gap: 8px; align-items: center; }
	.badges { display: flex; gap: 6px; }
	.badges span { font-size: 11px; padding: 4px 8px; border-radius: 99px; background: #ffffff10; border: 1px solid #ffffff22; backdrop-filter: blur(8px); }
	.sota { background: #36e27e22 !important; border-color: #36e27e66 !important; color: #8ff5b7; }
	.lang { font: inherit; font-size: 12px; color: #eae6da; background: #14141f; border: 1px solid #ffffff2a; border-radius: 99px; padding: 5px 8px; cursor: pointer; }
	.loader { position: fixed; inset: 0; display: grid; place-content: center; text-align: center; background: radial-gradient(#0d0d18, #07070c); z-index: 3; }
	.bar { width: min(320px, 80vw); height: 6px; background: #ffffff15; border-radius: 9px; overflow: hidden; margin: 6px auto; }
	.bar div { height: 100%; background: linear-gradient(90deg, #ffcf5a, #ff8a3d); transition: width 0.25s; box-shadow: 0 0 12px #ffb340; }
	.loader .mono { font-size: 12px; opacity: 0.6; }
	.result { align-self: start; text-align: center; margin-top: 4vh; min-height: 120px; }
	h2 { margin: 0; font-size: clamp(48px, 12vw, 108px); font-family: Georgia, serif; letter-spacing: 0.04em; background: linear-gradient(180deg, #fff3c4, #e0a33a 60%, #8a5a14); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 24px #ffb34055); }
	h2.think { font-size: clamp(26px, 6vw, 44px); }
	h2.edge { background: linear-gradient(180deg, #fff6d8, #ffb347 55%, #b0561c); -webkit-background-clip: text; background-clip: text; }
	.think span { animation: blink 1s infinite; } .think span:nth-child(2) { animation-delay: 0.2s; } .think span:nth-child(3) { animation-delay: 0.4s; }
	.pop { animation: pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1); }
	.conf { display: inline-block; width: 120px; height: 6px; background: #ffffff18; border-radius: 9px; vertical-align: middle; overflow: hidden; }
	.conf span { display: block; height: 100%; background: #36e27e; transition: width 0.6s; }
	.oracle { max-width: 640px; margin: 4px auto 8px; padding: 0 12px; font-style: italic; font-size: clamp(14px, 3.6vw, 18px); opacity: 0.9; animation: fadeup 0.7s 0.2s both; }
	.cursor { display: inline-block; margin-left: 1px; font-style: normal; animation: blink 0.8s steps(1) infinite; }
	.copy { margin-top: 10px; padding: 6px 14px; font: inherit; font-size: 12px; font-weight: 600; color: #eae6da; background: #ffffff12; border: 1px solid #ffffff2a; border-radius: 99px; cursor: pointer; backdrop-filter: blur(8px); }
	.copy:hover { background: #ffffff1e; border-color: #ffc95a66; color: #ffe08a; }
	.panel { justify-self: center; width: min(560px, 100%); box-sizing: border-box; background: #0c0c16b3; border: 1px solid #ffffff1a; border-radius: 18px; padding: 14px; backdrop-filter: blur(14px); box-shadow: 0 20px 60px #0008; }
	.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
	.stats small { display: block; font-size: 10px; opacity: 0.55; text-transform: uppercase; }
	.stats b { font-size: 14px; }
	.tally { display: flex; justify-content: center; gap: 12px; margin-top: 6px; font-size: 12px; opacity: 0.8; }
	.tally i { font-style: normal; margin-right: 4px; padding: 0 5px; border-radius: 4px; background: #f3e6c4; color: #1b130c; font-weight: 800; }
	.engine { margin: 6px 0 0; text-align: center; font-size: 10px; letter-spacing: 0.04em; opacity: 0.5; }
	.log { font-size: 11px; opacity: 0.7; margin: 10px 0; min-height: 3.6em; line-height: 1.2em; }
	.log div:last-child { color: #ffd36b; }
	.ask { margin-bottom: 10px; }
	.pitch { font-size: 11px; opacity: 0.65; margin: 0 0 6px; text-align: center; }
	.ask input { width: 100%; box-sizing: border-box; padding: 13px 14px; font-size: 16px; color: #fff; background: #ffffff0d; border: 1px solid #ffffff26; border-radius: 12px; outline: none; }
	.ask input:focus { border-color: #ffc95a; box-shadow: 0 0 0 3px #ffc95a33; }
	button.hold { width: 100%; padding: 16px; font-size: 18px; font-weight: 800; border: 0; border-radius: 14px; cursor: pointer; color: #1a1205; background: linear-gradient(180deg, #ffe08a, #e9a23b); box-shadow: 0 8px 30px #ffae3a55, inset 0 1px 0 #fff8; transition: transform 0.15s, filter 0.2s; }
	button.hold:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
	button.hold:disabled { filter: grayscale(0.6) brightness(0.7); cursor: progress; }
	.hold { position: relative; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
	.hold .lbl { position: relative; z-index: 1; }
	.hold .meter { position: absolute; inset: 0; transform-origin: left; transform: scaleX(var(--charge, 0)); background: linear-gradient(90deg, #ffb347, #ff6a1a 70%, #ff3d00); opacity: 0.85; }
	.hold.holding { animation: tremble 0.08s infinite; box-shadow: 0 0 calc(20px + var(--charge) * 50px) #ff8a2a99, inset 0 1px 0 #fff8; }
	.hold.over { animation: tremble 0.04s infinite; filter: saturate(1.4); }
	.hint { margin: 6px 0 0; text-align: center; font-size: 11px; opacity: 0.55; }
	details { margin-top: 10px; font-size: 13px; } summary { cursor: pointer; opacity: 0.8; }
	details ul { padding-left: 18px; margin: 8px 0 0; line-height: 1.5; opacity: 0.85; }
	.warn { color: #ff8a8a; font-size: 12px; }
	.legendary { display: inline-block; margin: 0 auto 10px; text-align: center; padding: 8px 18px; border-radius: 99px; background: linear-gradient(90deg, #3a1d05ee, #6b3a0cee, #3a1d05ee); border: 1px solid #ffc36b; box-shadow: 0 0 40px #ff9a3a66; animation: legend 0.9s cubic-bezier(0.2, 1.6, 0.4, 1); white-space: nowrap; }
	.legendary b { display: block; letter-spacing: 0.3em; color: #ffd27a; font-size: 18px; }
	.legendary span { font-size: 12px; opacity: 0.85; }
	@keyframes legend { from { transform: scale(0.2) rotate(-8deg); opacity: 0; } }
	@keyframes tremble { 25% { transform: translate(1px, -1px); } 75% { transform: translate(-1px, 1px); } }
	@keyframes fadeup { from { opacity: 0; transform: translateY(8px); } }
	@keyframes pulse { 50% { opacity: 0.5; } }
	@keyframes blink { 50% { opacity: 0.1; } }
	@keyframes pop { from { transform: scale(0.4); opacity: 0; } }
	@media (max-width: 480px) { .stats { grid-template-columns: repeat(2, 1fr); } .badges { display: none; } }
	@media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
	.reduced *, .reduced { animation: none !important; transition: none !important; }
</style>
