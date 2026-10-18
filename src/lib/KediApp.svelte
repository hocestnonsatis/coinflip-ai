<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { LANGS, type Lang } from '#lib/i18n';
	import { KEDI } from '#lib/i18n-kedi';
	import { HUB } from '#lib/i18n-hub';
	import { SITE, REPO, pathFor, urlFor, setLangPref } from '#lib/site';
	import { HIDE_D, MANUAL_D, SLOT_X, endOf, rng, shuffleEvents, swapDur, type Ev } from '#lib/kedi-anim';
	import { KEDI_STATS as KS } from '#lib/kedi-stats';
	import { NAME, PARAMS } from '#lib/kedi-weights';
	import type { Backend } from '#lib/engine';
	import type { KediScene } from '#lib/kedi-scene';
	import type { Brain } from '#lib/kedi-ai';
	import Seo from './Seo.svelte';
	import SoundToggle from './SoundToggle.svelte';
	import { sfx } from '#lib/sound';
	import { why } from '#lib/why';

	type Phase = 'loading' | 'hide' | 'hiding' | 'shuffle' | 'asking' | 'reveal' | 'over';
	let { data }: { data: { lang: Lang | null } } = $props();
	const initialLang = (() => data.lang ?? 'en')();
	let lang = $state<Lang>(initialLang);
	const t = $derived(KEDI[lang]);
	const pct = $derived(new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }));
	const pct1 = $derived(new Intl.NumberFormat(lang, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	const nf = $derived(new Intl.NumberFormat(lang));

	let canvas3d = $state<HTMLCanvasElement>(), camEl = $state<HTMLCanvasElement>();
	let s3: KediScene | null = null, brain: Brain | null = null;
	let webglFailed = $state(false), engine = $state<Backend | 'loading'>('loading');
	let phase = $state<Phase>('loading');
	let probs = $state<number[]>([1 / 3, 1 / 3, 1 / 3]), nFrames = $state(0), msPer = $state(0);
	let swaps = $state(0), queued = $state(0), sel = $state<number | null>(null);
	let speed = $state(0.35), times = $state(5);
	let result = $state<{ cat: boolean; choice: number; real: number; p: number } | null>(null);
	let reduced = $state(false);
	let chips = $state<{ x: number; y: number }[]>([]);
	let headerEl = $state<HTMLElement>(), panelEl = $state<HTMLElement>();
	let feedMode: 'normal' | 'blank' | 'mirror' = 'normal'; // test hook only (honesty checks on prod)
	let round = 0;

	// ---- global all-time counter (/api/kedi/*), best-effort: hidden if the API is down
	type Counts = { games: number; human: number; cat: number };
	let gstats = $state<Counts | null>(null), counted = $state(false);
	let ticket: { round: number; p: Promise<string | null> } | null = null;
	const isCounts = (v: unknown): v is Counts => !!v && typeof (v as Counts).games === 'number';
	async function api(path: string, body?: unknown): Promise<{ ok: boolean; v: unknown }> {
		try { const r = await fetch(`/api/kedi/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { ok: r.ok, v: await r.json() }; }
		catch { return { ok: false, v: null }; }
	}
	const loadStats = async () => { const { v } = await api('stats'); if (isCounts(v)) gstats = v; };
	function openTicket(r: number) { counted = false; ticket = { round: r, p: api('start', {}).then(({ ok, v }) => (ok ? ((v as { gameId?: string }).gameId ?? null) : null)) }; }
	async function report(cat: boolean) {
		const tk = ticket; ticket = null; if (!tk || tk.round !== round) return;
		const gid = await tk.p; if (!gid) return;
		const { ok, v } = await api('result', { winner: cat ? 'model' : 'human', moves: swaps, gameId: gid });
		if (ok && isCounts(v)) { gstats = v; counted = true; } else loadStats();
	}
	const leadLine = $derived(!gstats || !gstats.games ? t.statsEmpty : gstats.cat > gstats.human ? t.statsCat : gstats.human > gstats.cat ? t.statsHuman : t.statsTie);

	// ---- commentary (streamed like an LLM, numbers are the model's real outputs)
	let shown = $state(''), streaming = $state(false), streamId = 0;
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 40) : ms));
	const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
	async function say(text: string) {
		const id = ++streamId;
		if (reduced) { shown = text; streaming = false; return; }
		shown = ''; streaming = true; await sleep(120);
		for (const tok of text.match(/\S+\s*|\s+/g) ?? []) { if (id !== streamId) return; shown += tok; await sleep(22 + Math.random() * 45 + (/[.,!?:…]\s*$/.test(tok) ? 90 : 0)); }
		if (id === streamId) streaming = false;
	}
	const posName = (s: number) => t.cupOf(t.pos[s]);
	const ranked = () => [0, 1, 2].sort((a, b) => probs[b] - probs[a]);
	function fill(s: string, extra: Record<string, string> = {}) {
		const [a, b] = ranked();
		const v: Record<string, string> = { pos: posName(a), p: pct.format(probs[a]), q: posName(b), pq: pct.format(probs[b]), n: nf.format(nFrames), s: nf.format(swaps), ms: msPer.toLocaleString(lang, { maximumFractionDigits: 2 }), ...extra };
		return s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
	}
	function track() { const top = Math.max(...probs); say(fill(pick(top >= 0.8 ? t.sure : top >= 0.5 ? t.unsure : t.lost))); }

	// ---- camera frames → the model (the only thing it ever gets)
	function feed(f: Uint8Array): Uint8Array {
		let x = f;
		if (feedMode === 'blank') x = new Uint8Array(f.length).fill(90);
		else if (feedMode === 'mirror') { x = new Uint8Array(f.length); for (let y = 0; y < 32; y++) for (let k = 0; k < 64; k++) x[y * 64 + k] = f[y * 64 + 63 - k]; }
		drawCam(x); // the little "cat camera" preview shows exactly what the model gets
		return x;
	}
	let camCtx: CanvasRenderingContext2D | null = null, camImg: ImageData | null = null;
	function onFrame(f: Uint8Array) {
		if (!brain) return;
		brain.push(feed(f), (p) => {
			probs = Array.from(p); nFrames = brain!.n; msPer = brain!.ms / Math.max(1, brain!.n);
			const top = ranked()[0]; s3?.lookAt(SLOT_X[top], probs[top]);
		});
	}
	function drawCam(f: Uint8Array) {
		if (!camEl) return;
		camCtx ??= camEl.getContext('2d'); if (!camCtx) return;
		camImg ??= camCtx.createImageData(64, 32);
		for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) { const v = f[(31 - y) * 64 + x], i = (y * 64 + x) * 4; camImg.data[i] = camImg.data[i + 1] = camImg.data[i + 2] = v; camImg.data[i + 3] = 255; }
		camCtx.putImageData(camImg, 0, 0);
	}

	// ---- round flow
	const busyUntil = () => (s3 ? endOf(s3.events()) : 0);
	const waitGame = (dt: number) => new Promise<void>((res) => (s3 ? s3.at(s3.time() + dt, res) : res()));
	function newRound() {
		round++; streamId++; result = null; swaps = 0; queued = 0; sel = null;
		probs = [1 / 3, 1 / 3, 1 / 3]; nFrames = 0; msPer = 0;
		s3?.reset(); s3?.setMood('idle'); s3?.lookAt(null, 0.3); brain?.reset();
		camCtx?.clearRect(0, 0, 64, 32);
		phase = 'hide'; say(pick([t.hide]));
	}
	function hideAt(slot: number) {
		if (!s3 || !brain || phase !== 'hide') return;
		const r = round, t0 = s3.time();
		brain.reset(); s3.push({ k: 'hide', t: t0, d: HIDE_D, slot }); s3.startCapture(t0);
		phase = 'hiding'; sfx.tilePick(); openTicket(r);
		s3.at(t0 + HIDE_D - 0.12, () => sfx.cup(0.45));
		s3.at(t0 + HIDE_D + 0.05, async () => { await brain?.idle(); if (r !== round) return; phase = 'shuffle'; say(fill(pick(t.seen))); });
	}
	function queueSwap(a: number, b: number, d: number) {
		if (!s3) return;
		const t0 = Math.max(s3.time(), busyUntil()) + 0.02, e: Ev = { k: 'swap', t: t0, d, a: Math.min(a, b), b: Math.max(a, b), s: Math.random() < 0.5 ? 1 : -1 };
		s3.push(e); afterSwap(e);
	}
	let lastSlide = 0, trackTimer: ReturnType<typeof setTimeout> | null = null;
	function afterSwap(e: Ev) {
		const r = round; queued++;
		s3!.at(e.t, () => { const now = performance.now(); if (now - lastSlide > 110) { lastSlide = now; sfx.slide(); } });
		s3!.at(e.t + e.d, () => { if (r !== round) return; queued--; swaps++; if (!queued) { if (trackTimer) clearTimeout(trackTimer); trackTimer = setTimeout(() => { if (r === round && phase === 'shuffle' && !queued) track(); }, 450); } });
	}
	/** Cup clicked (cup id → its current slot). Hide phase: hide there. Shuffle phase: select / swap with the selected one. */
	function clickCup(cup: number) {
		if (!s3) return;
		const slot = s3.pose().at.indexOf(cup);
		if (phase === 'hide') { hideAt(slot); return; }
		if (phase !== 'shuffle') return;
		if (sel === null) { sel = cup; sfx.tick(); s3.select(cup); return; }
		if (sel === cup) { sel = null; s3.select(null); return; }
		const a = s3.pose().at.indexOf(sel); sel = null; s3.select(null);
		if (a >= 0 && slot >= 0) queueSwap(a, slot, MANUAL_D);
	}
	function dragCup(from: number, to: number) {
		if (!s3 || phase !== 'shuffle') return;
		const p = s3.pose(), a = p.at.indexOf(from), b = p.at.indexOf(to); sel = null; s3.select(null);
		if (a >= 0 && b >= 0 && a !== b) queueSwap(a, b, MANUAL_D);
	}
	const shuffleRng = rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
	function shuffleN() {
		if (!s3 || phase !== 'shuffle' || queued > 400) return;
		sel = null; s3.select(null);
		const t0 = Math.max(s3.time(), busyUntil()) + 0.02;
		const evs = shuffleEvents(shuffleRng, times, speed, t0);
		sfx.shuffle(Math.min(900, times * swapDur(speed) * 1000));
		for (const e of evs) { s3.push(e); afterSwap(e); }
	}
	async function ask() {
		if (!s3 || !brain || phase !== 'shuffle') return;
		const r = round; phase = 'asking'; sel = null; s3.select(null);
		// let queued swaps finish, then stop the camera (the last frames are captured at fixed game times like all the others)
		await waitGame(Math.max(0, busyUntil() + 0.15 - s3.time())); if (r !== round || !s3) return;
		s3.stopCapture(); await brain.idle(); if (r !== round) return;
		s3.setMood('think');
		const choice = ranked()[0], p = probs[choice];
		await say(fill(pick(t.decide)));
		if (r !== round) return;
		await s3.pawAt(choice); if (r !== round) return;
		sfx.cup(0.3);
		// reveal: lift the chosen cup; if the toy is elsewhere, lift that one too
		const pz = s3.pose(), real = pz.at.indexOf(pz.toyCup), now = s3.time();
		s3.push({ k: 'lift', t: now, d: 0.7, slot: choice, hold: true }); phase = 'reveal'; sfx.tilePick();
		await waitGame(0.65); if (r !== round) return;
		const cat = real === choice;
		if (!cat) { s3.push({ k: 'lift', t: s3.time(), d: 0.7, slot: real, hold: true }); await waitGame(0.5); if (r !== round) return; }
		result = { cat, choice, real, p }; phase = 'over';
		s3.setMood(cat ? 'happy' : 'sad'); sfx.meow(cat); if (!cat) setTimeout(() => sfx.win(), 380);
		const lucky = p < 0.6, fast = swaps >= 6 && speed > 0.6;
		say(fill(pick(cat ? (lucky ? t.wonLucky : t.won) : fast ? t.lostFast : t.lostR), { real: posName(real), p: pct.format(p) }));
		if (cat && Math.random() < 1 / 40) setTimeout(() => { if (r === round) { s3?.knock(pz.toyCup); setTimeout(() => sfx.hit(), 900); } }, 1400);
		report(cat);
	}

	const speedName = $derived(t.speeds[Math.min(4, Math.floor(speed * 5))]);
	const jsonLd = $derived({
		'@context': 'https://schema.org', '@type': ['WebApplication', 'VideoGame'], name: NAME, alternateName: t.title, url: urlFor(lang, 'kedi'), description: t.desc,
		inLanguage: lang, applicationCategory: 'GameApplication', genre: 'Shell game', gamePlatform: 'Web browser', operatingSystem: 'Any (web browser)', isAccessibleForFree: true, numberOfPlayers: 1,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Anıl ÖZ' }, sameAs: [REPO], image: `${SITE}/og-kedi.png`,
		isPartOf: { '@type': 'WebSite', name: 'Tiny Models', url: `${SITE}/` }
	});
	const cell = (c: [number, number]) => (c[1] ? pct.format(c[0] / c[1]) : '—');
	const card = $derived(t.card({
		params: nf.format(PARAMS), episodes: nf.format(KS.episodes), frames: nf.format(KS.frames),
		train: `PyTorch (CPU), ${KS.epochs} epochs ≈ ${KS.minutes} min × ${KS.procs} CPU; dense per‑frame cross‑entropy`,
		overall: KS.overall.n ? `${pct1.format(KS.overall.w / KS.overall.n)} (${nf.format(KS.overall.w)}/${nf.format(KS.overall.n)})` : '—', random: pct1.format(1 / 3),
		size: `${(KS.onnxBytes / 1024).toLocaleString(lang, { maximumFractionDigits: 0 })} KB ONNX`,
		blank: KS.blank.n ? `blank feed → P ∈ [${pct1.format(KS.blank.minP)}, ${pct1.format(KS.blank.maxP)}] · mirrored feed → mirrored answer in ${nf.format(KS.mirror.agree)}/${nf.format(KS.mirror.n)} rounds` : '—'
	}));

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const sp = new URLSearchParams(location.search), q = sp.get('lang') as Lang | null;
		if (data.lang) lang = data.lang;
		else if (q && LANGS.some((l) => l.code === q)) { lang = q; localStorage.setItem('lang', q); window.history.replaceState(window.history.state, '', pathFor(q, 'kedi')); }
		let raf = 0, alive = true;
		(async () => {
			try {
				if (!canvas3d) throw new Error('no canvas');
				const [mod, anim, ai] = await Promise.all([import('#lib/kedi-scene'), import('#lib/kedi-anim'), import('#lib/kedi-ai')]);
				if (!alive) return;
				s3 = mod.createKediScene(canvas3d, { onCup: clickCup, onDrag: dragCup, reducedMotion: () => reduced, onFrame });
				brain = new ai.Brain();
				const w = window as unknown as Record<string, unknown>;
				w.__kedi = { s: s3, anim, m: mod }; // headless tests + data generator
				w.__kediUi = () => ({ phase, probs: [...probs], nFrames, swaps, queued, result, engine, sel, msPer });
				w.__kediFeed = (m: typeof feedMode) => { feedMode = m; };
				const ro = new ResizeObserver(updateInsets); for (const el of [panelEl, headerEl]) if (el) ro.observe(el);
				window.addEventListener('resize', updateInsets); updateInsets();
				const loop = () => { raf = requestAnimationFrame(loop); if (s3) chips = [0, 1, 2].map((k) => s3!.screenOfSlot(k, 0, 1.05)); };
				loop();
				if (sp.has('datagen')) return;
				newRound(); loadStats();
				try { engine = await ai.loadKediEngine(); } catch { engine = 'ts'; }
			} catch (e) { console.info(`[kedi] WebGL unavailable (${why(e)})`); webglFailed = true; phase = 'loading'; }
		})();
		return () => { alive = false; cancelAnimationFrame(raf); round++; streamId++; s3?.destroy(); s3 = null; };
	});
	function updateInsets() {
		if (!s3 || !panelEl || !headerEl) return;
		const W = window.innerWidth, H = window.innerHeight, pr = panelEl.getBoundingClientRect(), top = headerEl.getBoundingClientRect().bottom + 8;
		const sheet = pr.width > W * 0.8;
		s3.setInsets(sheet ? { top, right: 0, bottom: H - pr.top + 4, left: 0 } : { top, right: W - pr.left + 8, bottom: 6, left: 6 });
	}
	$effect(() => { document.documentElement.lang = lang; });
	function setLang(l: Lang) { lang = l; setLangPref(l); try { replaceState(pathFor(l, 'kedi'), {}); } catch { /* router not ready */ } }
	function onKey(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement).tagName; if (tag === 'SELECT' || tag === 'INPUT' || tag === 'BUTTON' || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (phase === 'shuffle') ask(); else if (phase === 'over') newRound(); }
		else if ((e.key === 's' || e.key === 'S') && phase === 'shuffle') shuffleN();
		else if (phase === 'hide' && ['1', '2', '3'].includes(e.key)) hideAt(+e.key - 1);
	}
</script>

<Seo {lang} slug="kedi" title={t.title} desc={t.desc} image="/og-kedi.png" {jsonLd} />
<svelte:window onkeydown={onKey} />

<div class="kd">
	{#if !webglFailed}<canvas bind:this={canvas3d} class="stage3d" aria-label="Cups and cat (3D)"></canvas>{/if}
	<div class="chips" aria-hidden="true">
		{#if phase !== 'hide' && phase !== 'loading' && chips.length}
			{#each chips as c, k (k)}<span class="chip" class:top={ranked()[0] === k && nFrames > 0} style:left="{c.x}px" style:top="{c.y}px" style:--p={probs[k]}>{pct.format(probs[k])}</span>{/each}
		{/if}
	</div>
	<main>
		<header bind:this={headerEl}>
			<a class="back" href={pathFor(lang, '')} aria-label={HUB[lang].back}>←</a>
			<h1 class="brand"><span class="dot" class:live={engine !== 'loading'}></span> {NAME} <small>CNN+GRU · pixels</small><span class="sr-only"> · {t.title.split('·').slice(1).join('·').trim()}</span></h1>
			<SoundToggle {lang} />
			<select class="lang" aria-label="Language" value={lang} onchange={(e) => setLang(e.currentTarget.value as Lang)}>
				{#each LANGS as l (l.code)}<option value={l.code}>{l.code.toUpperCase()} · {l.name}</option>{/each}
			</select>
		</header>
		<p class="pitch">{t.pitch}</p>
		<noscript><p>{t.desc}</p></noscript>
		{#if webglFailed}<p class="nowebgl">{t.noWebgl}</p>{/if}

		<aside class="panel" bind:this={panelEl}>
			<div class="turn" aria-live="polite"><b>{phase === 'hide' ? t.hide : phase === 'hiding' ? t.hiding : phase === 'shuffle' ? (queued ? t.queued(queued) : t.shuffle(swaps)) : phase === 'asking' || phase === 'reveal' ? t.asking : phase === 'over' && result ? (result.cat ? t.catWin : t.humanWin) : '…'}</b></div>
			<div class="btns">
				{#if phase === 'over'}<button class="primary" onclick={newRound}>{t.newRound}</button>
				{:else}<button class="primary" onclick={ask} disabled={phase !== 'shuffle'}>🐾 {t.ask}</button>{/if}
			</div>
			<div class="shuf" class:off={phase !== 'shuffle'}>
				<div class="row">
					<button class="sh" onclick={shuffleN} disabled={phase !== 'shuffle'} title="S">🔀 {t.shuffleN(times)}</button>
					<span class="stepper"><button onclick={() => (times = Math.max(1, times - (times > 10 ? 5 : 1)))} aria-label="−" disabled={times <= 1}>−</button><b>{times}</b><button onclick={() => (times = Math.min(50, times + (times >= 10 ? 5 : 1)))} aria-label="+" disabled={times >= 50}>+</button></span>
				</div>
				<label class="speed">{t.speed}: <b>{speedName}</b> <small class="mono">{Math.round(swapDur(speed) * 1000)} ms</small>
					<input type="range" min="0" max="1" step="0.05" bind:value={speed} aria-label={t.speed} />
				</label>
			</div>
			<div class="belief">
				<small>{t.belief}</small>
				{#each [0, 1, 2] as k (k)}
					<div class="bar"><span class="lbl">{t.pos[k]}</span><span class="track"><i style:width="{probs[k] * 100}%" class:top={ranked()[0] === k && nFrames > 0}></i></span><b class="mono">{pct.format(probs[k])}</b></div>
				{/each}
				<div class="cam">
					<canvas bind:this={camEl} width="64" height="32" aria-label="cat camera"></canvas>
					<span class="mono">{t.frames(nFrames)}<br />{t.perFrame(msPer.toLocaleString(lang, { maximumFractionDigits: 2 }))}<br />{t.swapsDone(swaps)}</span>
				</div>
			</div>
			<div class="comment" aria-live="polite"><span class="who">{NAME}:</span> {shown}{#if streaming}<span class="cursor" aria-hidden="true">▍</span>{/if}</div>
			{#if gstats}<div class="gstats" aria-live="polite">
				<small>{t.statsTitle}</small>
				<p>{t.statsLine(nf.format(gstats.games), gstats.games, nf.format(gstats.human), nf.format(gstats.cat))}</p>
				<p class="lead">{leadLine}{#if counted} <span class="okc">✓ {t.counted}</span>{/if}</p>
			</div>{/if}
			<p class="engine mono">{t.engineLabel}: {engine === 'webgpu' ? 'ONNX Runtime · WebGPU' : engine === 'wasm' ? 'ONNX Runtime · WASM' : engine === 'loading' ? '…' : t.engineTs}</p>
			<p class="hint">{t.hint}</p>
			<details>
				<summary>{t.cardTitle}</summary>
				<ul>{#each card as [k, v] (k)}<li><b>{k}:</b> {v}</li>{/each}<li><b>GitHub:</b> <a href={REPO} target="_blank" rel="noopener">hocestnonsatis/coinflip-ai</a></li></ul>
				{#if KS.cells.length}
					<p class="acc-t">{t.accTitle}</p>
					<table class="acc mono">
						<thead><tr><th>{t.accSwaps}</th>{#each KS.speeds as s (s.s)}<th>{t.speeds[Math.min(4, Math.floor(s.s * 5))]}<br /><small>{s.ms} ms</small></th>{/each}</tr></thead>
						<tbody>{#each KS.swaps as n, i (n)}<tr><th>{n}</th>{#each KS.cells[i] as c, j (j)}<td style:--a={c[1] ? c[0] / c[1] : 0}>{cell(c)}<small> ({c[1]})</small></td>{/each}</tr>{/each}</tbody>
					</table>
					<p class="acc-n">{t.accNote}</p>
				{/if}
			</details>
		</aside>
	</main>
</div>

<style>
	:global(html) { background: #050403; }
	.kd { position: fixed; inset: 0; overflow: hidden; color: #eae6da; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
	main { position: fixed; inset: 0; pointer-events: none; padding: max(10px, env(safe-area-inset-top)) 14px 0; }
	header, .panel { pointer-events: auto; }
	header { display: flex; align-items: center; gap: 10px; background: #0c0c16a0; backdrop-filter: blur(10px); border: 1px solid #ffffff14; border-radius: 99px; padding: 4px 6px; max-width: 1180px; margin: 0 auto; }
	.back { color: #eae6da; text-decoration: none; font-size: 20px; padding: 2px 8px; border-radius: 99px; background: #ffffff10; border: 1px solid #ffffff22; }
	.brand { flex: 1; margin: 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
	.brand small { font-size: 11px; font-weight: 500; opacity: 0.55; font-family: ui-monospace, monospace; }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: #888; } .dot.live { background: #36e27e; box-shadow: 0 0 12px #36e27e; }
	.lang { font: inherit; font-size: 12px; color: #eae6da; background: #14141f; border: 1px solid #ffffff2a; border-radius: 99px; padding: 5px 8px; }
	.pitch, .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
	.mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
	.stage3d { position: fixed; inset: 0; width: 100vw; height: 100dvh; display: block; touch-action: none; cursor: pointer; background: #050403; }
	.nowebgl { pointer-events: auto; max-width: 520px; margin: 80px auto; padding: 16px; border-radius: 14px; background: #0c0c16d0; text-align: center; }
	.chips { position: fixed; inset: 0; pointer-events: none; }
	.chip { position: absolute; transform: translate(-50%, -50%); font: 700 13px ui-monospace, monospace; padding: 2px 8px; border-radius: 99px; background: #0c0c16b0; border: 1px solid #ffffff22; opacity: calc(0.45 + var(--p) * 0.55); transition: opacity 0.2s; }
	.chip.top { background: #ffcf5a; color: #1a1205; border-color: #ffcf5a; box-shadow: 0 0 14px #ffcf5a88; }
	.panel { position: fixed; right: 14px; top: calc(max(10px, env(safe-area-inset-top)) + 54px); width: 290px; max-height: calc(100dvh - 76px); overflow-y: auto; box-sizing: border-box; background: #0c0c16c0; border: 1px solid #ffffff1a; border-radius: 18px; padding: 12px; backdrop-filter: blur(14px); box-shadow: 0 20px 60px #0008; }
	.turn { text-align: center; min-height: 1.4em; font-size: 15px; margin-bottom: 8px; }
	.btns { display: flex; gap: 6px; }
	button { font: inherit; font-weight: 700; color: #eae6da; background: #ffffff12; border: 1px solid #ffffff2a; border-radius: 12px; padding: 9px 12px; cursor: pointer; }
	button:disabled { opacity: 0.4; cursor: default; }
	button.primary { flex: 1; padding: 12px; font-size: 16px; font-weight: 800; border: 0; color: #1a1205; background: linear-gradient(180deg, #ffe08a, #e9a23b); box-shadow: 0 8px 30px #ffae3a55, inset 0 1px 0 #fff8; }
	.shuf { margin-top: 8px; padding: 8px; border-radius: 12px; background: #ffffff08; border: 1px solid #ffffff12; transition: opacity 0.2s; }
	.shuf.off { opacity: 0.55; }
	.row { display: flex; gap: 6px; align-items: center; }
	.sh { flex: 1; font-size: 13px; }
	.stepper { display: inline-flex; align-items: center; gap: 4px; } .stepper button { padding: 6px 9px; } .stepper b { min-width: 22px; text-align: center; }
	.speed { display: block; margin-top: 8px; font-size: 12px; } .speed small { opacity: 0.6; }
	.speed input { width: 100%; accent-color: #ffcf5a; }
	.belief { margin-top: 10px; font-size: 12px; }
	.belief > small { display: block; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #ffd36b; opacity: 0.85; margin-bottom: 4px; }
	.bar { display: grid; grid-template-columns: 64px 1fr 40px; align-items: center; gap: 6px; margin: 3px 0; }
	.lbl { opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.track { height: 8px; border-radius: 99px; background: #ffffff14; overflow: hidden; }
	.track i { display: block; height: 100%; background: #8a8aa8; border-radius: 99px; transition: width 0.12s linear; } .track i.top { background: linear-gradient(90deg, #ffe08a, #e9a23b); }
	.bar b { text-align: right; }
	.cam { display: flex; gap: 8px; align-items: center; margin-top: 6px; font-size: 10px; opacity: 0.85; line-height: 1.35; }
	.cam canvas { width: 128px; height: 64px; image-rendering: pixelated; border-radius: 6px; border: 1px solid #ffffff22; background: #000; }
	.comment { margin: 10px 0; min-height: 3.2em; font-size: 14px; font-style: italic; line-height: 1.4; }
	.who { font-style: normal; font-weight: 700; color: #ffd36b; }
	.cursor { animation: blink 0.8s steps(1) infinite; font-style: normal; }
	.engine { margin: 8px 0 0; text-align: center; font-size: 10px; opacity: 0.6; }
	.hint { margin: 6px 0 0; font-size: 11px; opacity: 0.55; text-align: center; }
	.gstats { margin: 8px 0 0; padding: 8px 10px; border-radius: 12px; background: #ffffff08; border: 1px solid #ffd36b26; text-align: center; font-size: 12px; line-height: 1.35; }
	.gstats small { display: block; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #ffd36b; opacity: 0.85; }
	.gstats p { margin: 3px 0 0; } .gstats .lead { font-style: italic; opacity: 0.8; } .gstats .okc { font-style: normal; color: #36e27e; }
	details { margin-top: 10px; font-size: 13px; } summary { cursor: pointer; opacity: 0.85; }
	details a { color: #ffd36b; }
	details ul { padding-left: 18px; margin: 8px 0 0; line-height: 1.5; opacity: 0.85; }
	.acc-t { margin: 10px 0 4px; font-weight: 700; font-size: 12px; }
	.acc { width: 100%; border-collapse: collapse; font-size: 10px; }
	.acc th, .acc td { padding: 2px 3px; text-align: center; border: 1px solid #ffffff14; }
	.acc td { background: color-mix(in srgb, #36e27e calc(var(--a) * 55%), transparent); } .acc td small { opacity: 0.55; }
	.acc-n { font-size: 10px; opacity: 0.6; margin: 4px 0 0; }
	@media (max-aspect-ratio: 1/1), (max-width: 760px) {
		.panel { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 40dvh; max-height: none; border-radius: 18px 18px 0 0; padding: 8px 12px max(8px, env(safe-area-inset-bottom)); }
		.hint, .engine { display: none; }
		.comment { margin: 6px 0; min-height: 2.6em; font-size: 13px; }
		.brand small { display: none; }
	}
	@keyframes blink { 50% { opacity: 0.1; } }
	@media (prefers-reduced-motion: reduce) { .cursor { animation: none; } .track i { transition: none; } }
</style>
