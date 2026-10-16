<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { LANGS, type Lang } from '#lib/i18n';
	import { TAVLA } from '#lib/i18n-tavla';
	import { HUB } from '#lib/i18n-hub';
	import { SITE, REPO, HF_TAVLA, pathFor, urlFor, setLangPref } from '#lib/site';
	import { start, flip, legalSequences, applyStep, pips, resolveClick, type Board, type Step, type Seq } from '#lib/tavla-engine';
	import { STATS } from '#lib/tavla-stats';
	import { rollDie, rollPair, openingRoll } from '#lib/tavla-dice';
	import type { Backend } from '#lib/engine';
	import type { TavlaScene } from '#lib/tavla-scene';
	import Seo from './Seo.svelte';

	type Phase = 'opening' | 'roll' | 'move' | 'ai' | 'over';
	let { data }: { data: { lang: Lang | null } } = $props();
	const initialLang = (() => data.lang ?? 'en')();
	let lang = $state<Lang>(initialLang);
	const t = $derived(TAVLA[lang]);
	const pct = $derived(new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }));
	const nf = $derived(new Intl.NumberFormat(lang));

	let ai: typeof import('#lib/tavla-ai') | undefined;
	let engine = $state<Backend | 'loading'>('loading');
	let hb = $state<Board>(start()); // board from the human's view (human > 0, moves 24 → 1)
	let phase = $state<Phase>('opening');
	let dice = $state<number[]>([]);
	let rolling = $state(false);
	let seqs = $state<Seq[]>([]);
	let done = $state<Step[]>([]);
	let history: Board[] = [];
	let sel = $state<number | null>(null);
	let winP = $state(0.5); // human's win probability
	let status = $state('');
	let info = $state('');
	let lastAi = $state<Step[]>([]);
	let result = $state<{ human: boolean; gammon: boolean } | null>(null);
	let reduced = $state(false);
	let autoRoll = $state(false);
	let canvas3d = $state<HTMLCanvasElement>();
	let s3: TavlaScene | null = null;
	let mode3d = $state(false), webglFailed = $state(false), animating = $state(false);
	function setAuto(v: boolean) { autoRoll = v; try { localStorage.setItem('tavla-autoroll', v ? '1' : '0'); } catch { /* private mode */ } }
	$effect(() => {
		if (phase !== 'roll' || !autoRoll || rolling) return;
		const id = gameId, h = setTimeout(() => { if (id === gameId && phase === 'roll' && autoRoll) humanRoll(); }, reduced ? 150 : 650);
		return () => clearTimeout(h);
	});
	let comment = $state(''), shown = $state(''), streaming = $state(false);
	let streamId = 0, gameId = 0;
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 60) : ms));
	const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
	const engineName = (e: Backend | 'loading') => (e === 'webgpu' ? 'ONNX Runtime · WebGPU' : e === 'wasm' ? 'ONNX Runtime · WASM' : e === 'loading' ? '…' : t.engineTs);

	const tokenize = (s: string) => (s.match(/\S+\s*|\s+/g) ?? []);
	async function say(text: string) {
		const id = ++streamId; comment = text;
		if (reduced) { shown = text; streaming = false; return; }
		shown = ''; streaming = true; await sleep(200);
		for (const tok of tokenize(text)) { if (id !== streamId) return; shown += tok; await sleep(30 + Math.random() * 60 + (/[.,!?:…]\s*$/.test(tok) ? 110 : 0)); }
		if (id === streamId) streaming = false;
	}
	const fill = (s: string, v: { p: number; n?: number; ms?: number }) =>
		s.replace(/\{(p|h|n|ms)\}/g, (_, k) => (k === 'p' ? pct.format(v.p) : k === 'h' ? pct.format(1 - v.p) : k === 'n' ? nf.format(v.n ?? 0) : (v.ms ?? 0).toLocaleString(lang, { maximumFractionDigits: 1 })));

	// ---- move-input helpers
	const matching = $derived(seqs.filter((s) => done.every((d, i) => s.steps[i][0] === d[0] && s.steps[i][1] === d[1])));
	const nextSteps = $derived(phase === 'move' ? matching.map((s) => s.steps[done.length]).filter(Boolean) : []);
	const sources = $derived(new Set(nextSteps.map((s) => s[0])));
	const targets = $derived(new Set(nextSteps.filter((s) => sel === null || s[0] === sel).map((s) => s[1])));
	const usedDice = $derived.by(() => {
		if (phase !== 'move' || !matching.length) return [] as boolean[];
		const u = matching[0].used.slice(0, done.length);
		if (dice.length === 4 || dice[0] === dice[1]) return [0, 1, 2, 3].map((i) => i < u.length);
		return dice.map((d) => u.includes(d));
	});
	const shownDice = $derived(dice.length === 2 && dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice);
	const pc = $derived(pips(hb));

	async function rollAnim(n: number, final: number[], humanSide = true) {
		rolling = true;
		if (s3) { await s3.rollDice(final, humanSide); dice = final; rolling = false; return; }
		const end = performance.now() + (reduced ? 0 : 650);
		while (performance.now() < end) { dice = Array.from({ length: n }, rollDie); await sleep(70); }
		dice = final; rolling = false;
	}

	async function newGame() {
		const id = ++gameId;
		hb = start(); done = []; history = []; sel = null; seqs = []; lastAi = []; result = null; winP = 0.5; info = '';
		phase = 'opening'; status = '';
		say(pick(t.start));
		await sleep(700); if (id !== gameId) return;
		let a = 0, b = 0;
		for (const [x, y] of openingRoll()) { a = x; b = y; await rollAnim(2, [a, b]); if (id !== gameId) return; }
		const human = a > b;
		status = t.opening(a, b, human ? t.you : t.model);
		await sleep(900); if (id !== gameId) return;
		if (human) beginHuman([a, b]); else aiTurn([b, a], id);
	}
	function beginHuman(d: number[]) {
		dice = d; seqs = legalSequences(hb, d[0], d[1]); done = []; history = []; sel = null;
		if (!seqs.length || seqs[0].steps.length === 0) {
			phase = 'ai'; status = t.noMove; say(pick(t.humanNoMove));
			const id = gameId; setTimeout(() => { if (id === gameId) aiTurn(null, id); }, reduced ? 200 : 1600);
			return;
		}
		phase = 'move'; status = t.pickChecker;
		const only = [...new Set(seqs.map((s) => s.steps[0][0]))];
		if (only.length === 1) { sel = only[0]; status = t.pickTarget; }
	}
	async function humanRoll() {
		if (phase !== 'roll' || rolling) return;
		const d = rollPair();
		await rollAnim(2, d);
		beginHuman(d);
	}
	function clickPoint(i: number) {
		if (phase !== 'move' || animating) return;
		const r = resolveClick(nextSteps, sel, i);
		if ('step' in r) { step(r.step); return; }
		sel = r.sel; status = sel === null ? t.pickChecker : t.pickTarget;
	}
	async function step(s: Step) {
		const after = applyStep(hb, s);
		if (s3) { animating = true; try { await s3.move(hb, after, s[0], s[1] === -1 ? 26 : s[1], true); } finally { animating = false; } }
		history = [...history, hb]; hb = after; done = [...done, s];
		const rest = seqs.filter((q) => done.every((d, i) => q.steps[i][0] === d[0] && q.steps[i][1] === d[1]));
		if (done.length >= rest[0].steps.length) { sel = null; commitHuman(); return; }
		const nxt = rest.map((q) => q.steps[done.length]);
		sel = nxt.some((n) => n[0] === s[1]) && s[1] >= 0 ? s[1] : nxt.some((n) => n[0] === s[0]) ? s[0] : null;
		if (sel !== null && !nxt.some((n) => n[0] === sel)) sel = null;
		status = sel === null ? t.pickChecker : t.pickTarget;
	}
	function undo() {
		if (phase !== 'move' || !done.length) return;
		hb = history[history.length - 1]; history = history.slice(0, -1); done = done.slice(0, -1); sel = null; status = t.pickChecker;
	}
	async function commitHuman() {
		const id = gameId;
		phase = 'ai'; seqs = []; done = [];
		if (hb[26] === 15) { finish(true); return; }
		if (ai) { const v = await ai.evaluate([hb]); winP = v[0]; }
		await sleep(350); if (id !== gameId) return;
		aiTurn(null, id);
	}
	async function aiTurn(d: number[] | null, id: number) {
		phase = 'ai'; status = t.thinking; sel = null;
		if (!d) { d = rollPair(); await rollAnim(2, d, false); if (id !== gameId) return; } else dice = d;
		const mb = flip(hb);
		const mod = ai ?? (ai = await import('#lib/tavla-ai'));
		const c = await mod.choose(mb, d[0], d[1]);
		if (id !== gameId) return;
		info = t.candidates(c.n, c.ms.toLocaleString(lang, { maximumFractionDigits: 2 }));
		const barBefore = hb[24];
		let cur = mb; lastAi = [];
		if (!c.play.steps.length) { status = t.modelNoMove; say(pick(t.aiNoMove)); await sleep(1200); }
		for (const s of c.play.steps) {
			await sleep(s3 ? 120 : 420); if (id !== gameId) return;
			const next = applyStep(cur, s), after = flip(next);
			if (s3) { animating = true; try { await s3.move(hb, after, s[0] === 24 ? 25 : 23 - s[0], s[1] === -1 ? 27 : 23 - s[1], false); } finally { animating = false; } if (id !== gameId) return; }
			cur = next; hb = after; lastAi = [...lastAi, s];
		}
		winP = 1 - c.p;
		if (cur[26] === 15) { finish(false); return; }
		const hit = hb[24] > barBefore;
		if (c.play.steps.length) say(fill(pick(hit ? t.hit : c.p > 0.75 ? [...t.confident, ...t.move] : c.p < 0.3 ? [...t.worried, ...t.move] : t.move), { p: c.p, n: c.n, ms: c.ms }));
		await sleep(300); if (id !== gameId) return;
		phase = 'roll'; status = t.yourTurn; dice = [];
	}
	function finish(human: boolean) {
		const loserOff = human ? hb[27] : hb[26];
		result = { human, gammon: loserOff === 0 }; phase = 'over'; winP = human ? 1 : 0;
		status = human ? t.youWin : t.modelWin; say(pick(human ? t.humanWon : t.aiWon));
	}

	// ---- board geometry (viewBox 760×560). Human home = bottom right (points 1–6 = idx 0–5).
	const W = 50, FR = 20, BAR = 50, TOP = 20, BOT = 540, R = 22;
	const colX = (c: number) => FR + c * W + W / 2 + (c >= 6 ? BAR : 0);
	const ptX = (i: number) => (i < 12 ? colX(11 - i) : colX(i - 12));
	const isTop = (i: number) => i >= 12;
	const tri = (i: number) => { const x = ptX(i) - W / 2; return isTop(i) ? `${x + 2},${TOP} ${x + W - 2},${TOP} ${x + W / 2},${TOP + 215}` : `${x + 2},${BOT} ${x + W - 2},${BOT} ${x + W / 2},${BOT - 215}`; };
	const stackY = (i: number, k: number) => (isTop(i) ? TOP + R + k * 2 * R : BOT - R - k * 2 * R);
	const BARX = FR + 6 * W + BAR / 2;
	const lastFrom = $derived(new Set(lastAi.map((s) => (s[0] === 24 ? -2 : 23 - s[0]))));
	const lastTo = $derived(new Set(lastAi.map((s) => (s[1] === -1 ? -3 : 23 - s[1]))));
	const offTarget = $derived(targets.has(-1));

	const jsonLd = $derived({
		'@context': 'https://schema.org', '@type': ['WebApplication', 'VideoGame'], name: 'Tavla‑1.6K', alternateName: t.title, url: urlFor(lang, 'tavla'), description: t.desc,
		inLanguage: lang, applicationCategory: 'GameApplication', genre: 'Board game', gamePlatform: 'Web browser', operatingSystem: 'Any (web browser)', isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Anıl ÖZ' }, sameAs: [REPO, HF_TAVLA], image: `${SITE}/og-tavla.png`,
		isPartOf: { '@type': 'WebSite', name: 'Tiny Models', url: `${SITE}/` }
	});
	const fmtPct = (w: number, n: number) => (n ? `${pct.format(w / n)} (${nf.format(w)}/${nf.format(n)})` : '—');
	const card = $derived(t.card({
		params: nf.format(STATS.params), games: nf.format(STATS.games), hours: `${(STATS.minutes / 60).toLocaleString(lang, { maximumFractionDigits: 1 })} h`,
		vsRandom: fmtPct(STATS.vsRandom.w, STATS.vsRandom.n), vsHeur: fmtPct(STATS.vsHeur.w, STATS.vsHeur.n), size: `${(STATS.onnxBytes / 1024).toLocaleString(lang, { maximumFractionDigits: 1 })} KB ONNX`
	}));

	$effect(() => { const b = hb; if (mode3d && !animating) s3?.sync(b); });
	$effect(() => { const h = { sources: new Set(sources), targets: new Set(targets), sel, lastTo: new Set(lastTo) }; if (mode3d) s3?.setHighlights(h); });
	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = mq.matches;
		try { autoRoll = localStorage.getItem('tavla-autoroll') === '1'; } catch { /* ignore */ }
		const q = new URLSearchParams(location.search).get('lang') as Lang | null;
		if (data.lang) lang = data.lang;
		else if (q && LANGS.some((l) => l.code === q)) { lang = q; localStorage.setItem('lang', q); window.history.replaceState(window.history.state, '', pathFor(q, 'tavla')); }
		(async () => {
			try {
				if (!canvas3d) throw new Error('no canvas');
				const mod = await import('#lib/tavla-scene');
				s3 = mod.createTavlaScene(canvas3d, { onPick: (l) => clickPoint(l), reducedMotion: () => reduced });
				(window as unknown as { __tavla3d?: TavlaScene }).__tavla3d = s3; // used by the headless prod test
				(window as unknown as { __tavlaUi?: () => object }).__tavlaUi = () => ({ phase, animating, sources: [...sources], targets: [...targets], sel });
				mode3d = true; s3.sync(hb);
			} catch (e) { console.info('[tavla] WebGL unavailable, using the SVG board', e); s3 = null; webglFailed = true; }
			ai = await import('#lib/tavla-ai');
			// Scripted positions for testing: ?pos=<28 comma-separated ints, human view>&dice=a,b
			const sp = new URLSearchParams(location.search), pos = sp.get('pos')?.split(',').map(Number), dd = sp.get('dice')?.split(',').map(Number);
			if (pos?.length === 28 && pos.every(Number.isInteger) && dd?.length === 2 && dd.every((d) => d >= 1 && d <= 6)) { hb = pos; beginHuman(dd); }
			else newGame();
			try { engine = await ai.loadTavlaEngine(); } catch { engine = 'ts'; }
		})();
		return () => { gameId++; streamId++; s3?.destroy(); s3 = null; };
	});
	$effect(() => { document.documentElement.lang = lang; });
	function setLang(l: Lang) { lang = l; setLangPref(l); try { replaceState(pathFor(l, 'tavla'), {}); } catch { /* router not ready */ } }
</script>

<Seo {lang} slug="tavla" title={t.title} desc={t.desc} image="/og-tavla.png" {jsonLd} />
<svelte:window onkeydown={(e) => { if ((e.code === 'Space' || e.code === 'Enter') && phase === 'roll' && (e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); humanRoll(); } if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo(); if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).tagName !== 'SELECT' && phase === 'roll') humanRoll(); }} />

<div class="tv">
	<div class="table" aria-hidden="true"></div>
	<main>
		<header>
			<a class="back" href={pathFor(lang, '')} aria-label={HUB[lang].back}>←</a>
			<h1 class="brand"><span class="dot" class:live={engine !== 'loading'}></span> Tavla‑1.6K <small>TD(λ) · 198‑8‑1</small><span class="sr-only"> · {t.title.split('·').slice(1).join('·').trim()}</span></h1>
			<select class="lang" aria-label="Language" value={lang} onchange={(e) => setLang(e.currentTarget.value as Lang)}>
				{#each LANGS as l (l.code)}<option value={l.code}>{l.code.toUpperCase()} · {l.name}</option>{/each}
			</select>
		</header>
		<p class="pitch">{t.pitch}</p>
		<noscript><p>{t.desc}</p></noscript>

		<div class="layout">
			<div class="boardwrap">
				<div class="prob" role="meter" aria-label={t.winProb} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(winP * 100)}>
					<span class="pl">{t.you} {pct.format(winP)}</span>
					<div class="pbar"><div class="pyou" style:width="{winP * 100}%"></div></div>
					<span class="pr">{pct.format(1 - winP)} {t.model}</span>
				</div>
				{#if !webglFailed}<canvas bind:this={canvas3d} class="board3d" aria-label="Backgammon board (3D)"></canvas>{/if}
				{#if webglFailed}<svg viewBox="0 0 760 560" class="board" role="img" aria-label="Backgammon board">
					<defs>
						<linearGradient id="felt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f5a3c" /><stop offset="1" stop-color="#1f3f2a" /></linearGradient>
						<radialGradient id="cw" cx="0.4" cy="0.35"><stop offset="0" stop-color="#fffaf0" /><stop offset="1" stop-color="#d9c7a0" /></radialGradient>
						<radialGradient id="cb" cx="0.4" cy="0.35"><stop offset="0" stop-color="#6b2a22" /><stop offset="1" stop-color="#2a0d09" /></radialGradient>
						<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.5" /></filter>
					</defs>
					<rect x="0" y="0" width="760" height="560" rx="14" fill="#5a321a" />
					<rect x="0" y="0" width="760" height="560" rx="14" fill="none" stroke="#2a160a" stroke-width="4" />
					<rect x={FR} y={TOP} width={6 * W} height={BOT - TOP} fill="url(#felt)" />
					<rect x={FR + 6 * W + BAR} y={TOP} width={6 * W} height={BOT - TOP} fill="url(#felt)" />
					<rect x={FR + 6 * W} y={TOP} width={BAR} height={BOT - TOP} fill="#3f2312" />
					<rect x="680" y={TOP} width="60" height={BOT - TOP} rx="6" fill="#2a160a" class:target={offTarget} />
					{#each Array(24) as _, i (i)}
						<polygon points={tri(i)} fill={i % 2 ? '#e9d7ae' : '#8f2d22'} opacity={targets.has(i) ? 1 : 0.92} class:hl={targets.has(i)} class:last={lastTo.has(i)} />
						<text x={ptX(i)} y={isTop(i) ? 14 : 554} class="num">{i + 1}</text>
					{/each}
					<!-- checkers -->
					{#each Array(24) as _, i (i)}
						{@const c = hb[i]}
						{#if c !== 0}
							{#each Array(Math.min(Math.abs(c), 5)) as _, k (k)}
								<circle cx={ptX(i)} cy={stackY(i, k)} r={R - 1} fill={c > 0 ? 'url(#cw)' : 'url(#cb)'} stroke={c > 0 ? '#9b8559' : '#120504'} stroke-width="1.5" filter="url(#sh)"
									class:src={c > 0 && sources.has(i) && k === Math.min(c, 5) - 1} class:selc={sel === i && k === Math.min(c, 5) - 1} />
							{/each}
							{#if Math.abs(c) > 5}<text x={ptX(i)} y={stackY(i, 4) + 5} class="cnt" fill={c > 0 ? '#3a2a10' : '#f3e6c4'}>{Math.abs(c)}</text>{/if}
						{/if}
					{/each}
					{#each Array(Math.min(hb[25], 4)) as _, k (k)}<circle cx={BARX} cy={200 - k * 44} r={R - 1} fill="url(#cb)" stroke="#120504" stroke-width="1.5" filter="url(#sh)" />{/each}
					{#if hb[25] > 4}<text x={BARX} y={205 - 3 * 44} class="cnt" fill="#f3e6c4">{hb[25]}</text>{/if}
					{#each Array(Math.min(hb[24], 4)) as _, k (k)}<circle cx={BARX} cy={360 + k * 44} r={R - 1} fill="url(#cw)" stroke="#9b8559" stroke-width="1.5" filter="url(#sh)" class:src={sources.has(24) && k === Math.min(hb[24], 4) - 1} class:selc={sel === 24 && k === Math.min(hb[24], 4) - 1} />{/each}
					{#if hb[24] > 4}<text x={BARX} y={365 + 3 * 44} class="cnt" fill="#3a2a10">{hb[24]}</text>{/if}
					{#each Array(hb[27]) as _, k (k)}<rect x="688" y={TOP + 6 + k * 11} width="44" height="9" rx="2" fill="#4a1a14" stroke="#120504" />{/each}
					{#each Array(hb[26]) as _, k (k)}<rect x="688" y={BOT - 15 - k * 11} width="44" height="9" rx="2" fill="#efe2c2" stroke="#9b8559" />{/each}
					<!-- hit areas -->
					{#each Array(24) as _, i (i)}
						<rect x={ptX(i) - W / 2} y={isTop(i) ? TOP : 280} width={W} height="260" fill="transparent" role="button" tabindex="-1" aria-label={`${i + 1}`} onclick={() => clickPoint(i)} onkeydown={() => {}} class="hit" class:clickable={sources.has(i) || targets.has(i)} />
						{#if targets.has(i)}<circle cx={ptX(i)} cy={stackY(i, Math.min(Math.max(hb[i], 0), 5))} r="7" class="dotT" pointer-events="none" />{/if}
					{/each}
					<rect x={FR + 6 * W} y="280" width={BAR} height="260" fill="transparent" role="button" tabindex="-1" aria-label="bar" onclick={() => clickPoint(24)} onkeydown={() => {}} class="hit" class:clickable={sources.has(24)} />
					<rect x="680" y={TOP} width="60" height={BOT - TOP} fill="transparent" role="button" tabindex="-1" aria-label="off" onclick={() => clickPoint(-1)} onkeydown={() => {}} class="hit" class:clickable={offTarget} />
					{#if offTarget}<text x="710" y="290" class="offlbl">⇥</text>{/if}
				</svg>{/if}
			</div>

			<aside class="panel">
				<div class="turn"><b>{status || '…'}</b></div>
				<div class="dicebox" aria-live="polite">
					{#each shownDice as d, i (i)}
						<div class="die f{d}" class:roll={rolling} class:used={usedDice[i]}>{#each Array(d) as _, j (j)}<i></i>{/each}</div>
					{/each}
				</div>
				<div class="btns">
					{#if phase === 'roll'}<button class="primary" onclick={humanRoll} disabled={rolling}>{t.roll}</button>
					{:else if phase === 'over'}<button class="primary" onclick={newGame}>{t.newGame}</button>
					{:else if phase === 'move'}<button onclick={undo} disabled={!done.length}>{t.undo}</button>{/if}
				</div>
				<label class="auto"><input type="checkbox" checked={autoRoll} onchange={(e) => setAuto(e.currentTarget.checked)} /> {t.autoRoll} <kbd>R</kbd></label>
				{#if result}<p class="res">{result.human ? t.youWin : t.modelWin}{#if result.gammon} · {t.gammon}{/if}</p>{/if}
				<div class="comment" aria-live="polite"><span class="who">Tavla‑1.6K:</span> {shown}{#if streaming}<span class="cursor" aria-hidden="true">▍</span>{/if}</div>
				<div class="stats mono">
					<div><small>{t.pips} · {t.you}</small><b>{pc.me}</b></div>
					<div><small>{t.pips} · {t.model}</small><b>{pc.op}</b></div>
				</div>
				{#if info}<p class="info mono">{info}</p>{/if}
				<p class="engine mono">{t.engineLabel}: {engineName(engine)}</p>
				<p class="hint">{t.hint}</p>
				{#if phase !== 'over' && phase !== 'opening'}<button class="ghost" onclick={newGame}>{t.newGame}</button>{/if}
				<details>
					<summary>{t.cardTitle}</summary>
					<ul>{#each card as [k, v] (k)}<li><b>{k}:</b> {v}</li>{/each}<li><b>Hugging Face:</b> <a href={HF_TAVLA} target="_blank" rel="noopener">hocestnonsatis/tavla-1.6k</a> · <a href={REPO} target="_blank" rel="noopener">GitHub</a></li></ul>
				</details>
			</aside>
		</div>
	</main>
</div>

<style>
	:global(html) { background: #07070c; }
	.tv { position: fixed; inset: 0; overflow-y: auto; color: #eae6da; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-overflow-scrolling: touch; }
	.table { position: fixed; inset: 0; z-index: -1; background:
		radial-gradient(ellipse 55% 50% at 50% 18%, #ffb36b40, transparent 70%), radial-gradient(ellipse 130% 100% at 50% 25%, transparent 35%, #050403d0 90%),
		repeating-linear-gradient(90deg, #00000055 0 3px, transparent 3px 16.66vw), repeating-linear-gradient(91deg, #ffffff06 0 2px, transparent 2px 11px),
		repeating-linear-gradient(89deg, #0000001a 0 1px, transparent 1px 7px), linear-gradient(180deg, #5a321a, #3b200e 55%, #1c0f07); }
	main { position: relative; max-width: 1180px; margin: 0 auto; padding: max(12px, env(safe-area-inset-top)) 14px 30px; }
	header { display: flex; align-items: center; gap: 10px; }
	.back { color: #eae6da; text-decoration: none; font-size: 20px; padding: 2px 8px; border-radius: 99px; background: #ffffff10; border: 1px solid #ffffff22; }
	.brand { flex: 1; margin: 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
	.brand small { font-size: 11px; font-weight: 500; opacity: 0.55; font-family: ui-monospace, monospace; }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: #888; } .dot.live { background: #36e27e; box-shadow: 0 0 12px #36e27e; }
	.lang { font: inherit; font-size: 12px; color: #eae6da; background: #14141f; border: 1px solid #ffffff2a; border-radius: 99px; padding: 5px 8px; }
	.pitch { margin: 6px 0 10px; font-size: 12px; opacity: 0.7; text-align: center; }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
	.mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
	.layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
	.board { width: 100%; height: auto; display: block; border-radius: 14px; box-shadow: 0 30px 80px #000a, 0 0 0 1px #ffffff10; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
	.board3d { width: 100%; aspect-ratio: 16 / 12; display: block; border-radius: 14px; box-shadow: 0 30px 80px #000a, 0 0 0 1px #ffffff10; touch-action: manipulation; cursor: pointer; background: #050403; }
	@media (max-aspect-ratio: 1/1) { .board3d { aspect-ratio: 1 / 1.28; } }
	.prob { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px; font-weight: 700; }
	.pbar { flex: 1; height: 10px; border-radius: 99px; background: #3a120d; overflow: hidden; box-shadow: inset 0 0 0 1px #ffffff22; }
	.pyou { height: 100%; background: linear-gradient(90deg, #fff3c4, #e0b46a); transition: width 0.6s; }
	.num { font-size: 10px; fill: #e9d7ae; opacity: 0.6; text-anchor: middle; font-family: ui-monospace, monospace; }
	.cnt { font-size: 16px; font-weight: 800; text-anchor: middle; pointer-events: none; }
	.offlbl { font-size: 26px; fill: #ffd36b; text-anchor: middle; pointer-events: none; }
	polygon.hl { fill: #ffcf5a; filter: drop-shadow(0 0 6px #ffcf5a); }
	polygon.last { stroke: #ff9a3a; stroke-width: 2; }
	rect.target { fill: #6a4a12; stroke: #ffcf5a; stroke-width: 2; }
	circle.src { stroke: #ffcf5a; stroke-width: 3; }
	circle.selc { stroke: #36e27e; stroke-width: 4; }
	.dotT { fill: #36e27e; opacity: 0.9; animation: pulse 1s infinite; }
	.hit.clickable { cursor: pointer; }
	.panel { background: #0c0c16c0; border: 1px solid #ffffff1a; border-radius: 18px; padding: 14px; backdrop-filter: blur(14px); box-shadow: 0 20px 60px #0008; }
	.turn { text-align: center; min-height: 1.4em; font-size: 15px; }
	.dicebox { display: flex; justify-content: center; gap: 10px; min-height: 58px; margin: 10px 0; }
	.die { width: 50px; height: 50px; box-sizing: border-box; padding: 7px; border-radius: 10px; background: radial-gradient(circle at 40% 35%, #fbf3df, #e4d3ac); box-shadow: 0 6px 14px #0008, inset 0 0 8px #0003; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); transition: opacity 0.3s, transform 0.3s; }
	.die i { width: 9px; height: 9px; border-radius: 50%; background: #1b130c; place-self: center; }
	.die.used { opacity: 0.3; transform: scale(0.85); }
	.die.roll { animation: shake 0.14s infinite; }
	.f1 i { background: #a3161a; grid-area: 2 / 2; width: 12px; height: 12px; }
	.f2 i:nth-child(1) { grid-area: 1 / 1; } .f2 i:nth-child(2) { grid-area: 3 / 3; }
	.f3 i:nth-child(1) { grid-area: 1 / 1; } .f3 i:nth-child(2) { grid-area: 2 / 2; } .f3 i:nth-child(3) { grid-area: 3 / 3; }
	.f4 i:nth-child(1) { grid-area: 1 / 1; } .f4 i:nth-child(2) { grid-area: 1 / 3; } .f4 i:nth-child(3) { grid-area: 3 / 1; } .f4 i:nth-child(4) { grid-area: 3 / 3; }
	.f5 i:nth-child(1) { grid-area: 1 / 1; } .f5 i:nth-child(2) { grid-area: 1 / 3; } .f5 i:nth-child(3) { grid-area: 2 / 2; } .f5 i:nth-child(4) { grid-area: 3 / 1; } .f5 i:nth-child(5) { grid-area: 3 / 3; }
	.f6 { grid-template-columns: repeat(2, 1fr); } .f6 i:nth-child(odd) { grid-column: 1; } .f6 i:nth-child(even) { grid-column: 2; }
	.btns { display: flex; justify-content: center; gap: 8px; min-height: 52px; }
	button { font: inherit; font-weight: 700; color: #eae6da; background: #ffffff12; border: 1px solid #ffffff2a; border-radius: 12px; padding: 10px 16px; cursor: pointer; }
	button:disabled { opacity: 0.4; cursor: default; }
	button.primary { width: 100%; padding: 14px; font-size: 17px; font-weight: 800; border: 0; color: #1a1205; background: linear-gradient(180deg, #ffe08a, #e9a23b); box-shadow: 0 8px 30px #ffae3a55, inset 0 1px 0 #fff8; }
	button.ghost { width: 100%; margin-top: 8px; font-size: 13px; padding: 8px; }
	.auto { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; font-size: 13px; cursor: pointer; user-select: none; }
	.auto input { width: 16px; height: 16px; accent-color: #e9a23b; }
	kbd { font-size: 10px; padding: 1px 5px; border: 1px solid #ffffff33; border-radius: 4px; opacity: 0.6; }
	.res { text-align: center; font-family: Georgia, serif; font-size: 24px; margin: 8px 0 0; color: #ffd36b; }
	.comment { margin: 12px 0; min-height: 3.2em; font-size: 14px; font-style: italic; line-height: 1.4; }
	.who { font-style: normal; font-weight: 700; color: #ffd36b; }
	.cursor { animation: blink 0.8s steps(1) infinite; font-style: normal; }
	.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center; }
	.stats small { display: block; font-size: 10px; opacity: 0.55; text-transform: uppercase; } .stats b { font-size: 15px; }
	.info, .engine { margin: 8px 0 0; text-align: center; font-size: 10px; opacity: 0.6; }
	.hint { margin: 8px 0 0; font-size: 11px; opacity: 0.55; text-align: center; }
	details { margin-top: 10px; font-size: 13px; } summary { cursor: pointer; opacity: 0.85; }
	details a { color: #ffd36b; }
	details ul { padding-left: 18px; margin: 8px 0 0; line-height: 1.5; opacity: 0.85; }
	@keyframes shake { 25% { transform: rotate(12deg) translate(2px, -2px); } 75% { transform: rotate(-12deg) translate(-2px, 2px); } }
	@keyframes pulse { 50% { opacity: 0.35; } }
	@keyframes blink { 50% { opacity: 0.1; } }
	@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .panel { order: 2; } }
	@media (max-width: 480px) { main { padding-left: 8px; padding-right: 8px; } .brand small { display: none; } .die { width: 42px; height: 42px; padding: 6px; } .die i { width: 7px; height: 7px; } }
	@media (prefers-reduced-motion: reduce) { .die.roll, .dotT, .cursor { animation: none; } }
</style>
