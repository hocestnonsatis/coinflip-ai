<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { LANGS, type Lang } from '#lib/i18n';
	import { OKEY } from '#lib/i18n-okey';
	import { OKEY_STATS, okeyLeader } from '#lib/i18n-okey-stats';
	import { HUB } from '#lib/i18n-hub';
	import { SITE, REPO, pathFor, urlFor, setLangPref } from '#lib/site';
	import { OkeyGame, type Finish } from '#lib/okey-game';
	import { ttype, tcol, tval, FJ, tilesAway } from '#lib/okey-engine';
	import { arrange, placeNew, remove, move, setMap, partition, SLOTS, ROW, type Rack } from '#lib/okey-rack';
	import { STATS } from '#lib/okey-stats';
	import type { Backend } from '#lib/engine';
	import type { OkeyScene, View, Zone } from '#lib/okey-scene';
	import Seo from './Seo.svelte';

	type Phase = 'deal' | 'draw' | 'discard' | 'bots' | 'over';
	let { data }: { data: { lang: Lang | null } } = $props();
	const initialLang = (() => data.lang ?? 'en')();
	let lang = $state<Lang>(initialLang);
	const t = $derived(OKEY[lang]);
	const ts = $derived(OKEY_STATS[lang]);
	const pct = $derived(new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }));
	const nf = $derived(new Intl.NumberFormat(lang));

	let ai: typeof import('#lib/okey-ai') | undefined;
	let engine = $state<Backend | 'loading'>('loading');
	let g: OkeyGame = new OkeyGame(0);
	let ver = $state(0); // bumped after every change to the (non-reactive) game object
	let rack = $state<Rack>(new Array(SLOTS).fill(null));
	let phase = $state<Phase>('deal');
	let sel = $state<number | null>(null);
	let hl = $state<Map<number, number>>(new Map());
	let status = $state(''), info = $state('');
	let result = $state<{ winner: number | null; finish: Finish | null } | null>(null);
	let bots = $state<{ p: number; away: number }[]>([{ p: NaN, away: 0 }, { p: NaN, away: 0 }, { p: NaN, away: 0 }, { p: NaN, away: 0 }]);
	let lastTake = $state<number | null>(null);
	let reduced = $state(false), testGame = false;
	let canvas3d = $state<HTMLCanvasElement>();
	let s3: OkeyScene | null = null;
	let mode3d = $state(false), webglFailed = $state(false);
	let headerEl = $state<HTMLElement>(), seatsEl = $state<HTMLElement>(), panelEl = $state<HTMLElement>();
	function updateInsets() {
		if (!s3 || !panelEl || !seatsEl) return;
		const W = window.innerWidth, H = window.innerHeight, pr = panelEl.getBoundingClientRect(), top = seatsEl.getBoundingClientRect().bottom + 6;
		const sheet = pr.width > W * 0.8;
		s3.setInsets(sheet ? { top, right: 0, bottom: H - pr.top + 4, left: 0 } : { top, right: W - pr.left + 8, bottom: 6, left: 6 });
	}

	// ---- global all-time counter (/api/okey/*), best-effort: hidden if the API is down
	type Counts = { games: number; human: number; bots: number; draws: number };
	let gstats = $state<Counts | null>(null), counted = $state(false);
	let ticket: { game: number; p: Promise<string | null> } | null = null;
	const isCounts = (v: unknown): v is Counts => !!v && typeof (v as Counts).games === 'number';
	async function api(path: string, body?: unknown): Promise<{ ok: boolean; v: unknown }> {
		try {
			const r = await fetch(`/api/okey/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
			return { ok: r.ok, v: await r.json() };
		} catch { return { ok: false, v: null }; }
	}
	const loadStats = async () => { const { v } = await api('stats'); if (isCounts(v)) gstats = v; };
	function openTicket(game: number) {
		counted = false;
		ticket = { game, p: api('start', {}).then(({ ok, v }) => (ok ? ((v as { gameId?: string }).gameId ?? null) : null)) };
		if (gstats) loadStats();
	}
	async function report(winner: 'human' | 'model' | 'draw') {
		const tk = ticket; ticket = null;
		if (!tk || tk.game !== gameId) return; // ?test= games never get a ticket
		const gid = await tk.p; if (!gid) return;
		const { ok, v } = await api('result', { winner, moves: g.turns, gameId: gid });
		if (ok && isCounts(v)) { gstats = v; counted = true; } else loadStats();
	}
	const lead = $derived(gstats ? okeyLeader(gstats) : 'empty');
	const leadLine = $derived(gstats && lead !== 'empty' ? ts[lead][gstats.games % ts[lead].length] : ts.empty);

	// ---- commentary
	let shown = $state(''), streaming = $state(false), who = $state('');
	let streamId = 0, gameId = 0;
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 40) : ms));
	const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
	const engineName = (e: Backend | 'loading') => (e === 'webgpu' ? 'ONNX Runtime · WebGPU' : e === 'wasm' ? 'ONNX Runtime · WASM' : e === 'loading' ? '…' : t.engineTs);
	const tokenize = (s: string) => (s.match(/\S+\s*|\s+/g) ?? []);
	async function say(text: string, by = 'Okey‑257') {
		const id = ++streamId; who = by;
		if (reduced) { shown = text; streaming = false; return; }
		shown = ''; streaming = true; await sleep(150);
		for (const tok of tokenize(text)) { if (id !== streamId) return; shown += tok; await sleep(25 + Math.random() * 50 + (/[.,!?:…]\s*$/.test(tok) ? 100 : 0)); }
		if (id === streamId) streaming = false;
	}
	const fmtMs = (ms: number) => ms.toLocaleString(lang, { maximumFractionDigits: ms < 10 ? 2 : 0 });
	const fill = (s: string, v: { b: string; p: number; a: number; n: number; ms: number }) =>
		s.replace(/\{(b|p|a|n|ms)\}/g, (_, k) => (k === 'b' ? v.b : k === 'p' ? pct.format(v.p) : k === 'a' ? nf.format(v.a) : k === 'n' ? nf.format(v.n) : fmtMs(v.ms)));
	const names = $derived([t.you, t.bot(1), t.bot(2), t.bot(3)]);

	// ---- derived view
	// snapshot of the (plain, non-reactive) game object, refreshed by refresh()
	type Snap = { pile: number; top: number | null; sizes: number[]; myTop: number | null; gosterge: number; okey: number; turn: number; away: number };
	const snapOf = (): Snap => ({ pile: g.pile.length, top: g.top(0), sizes: g.hands.map((h) => h.length), myTop: g.discards[0].at(-1) ?? null, gosterge: g.gosterge, okey: g.okey, turn: g.turn,
		away: g.hands[0].length === 14 ? tilesAway(g.hands[0], g.okey) : g.hands[0].length === 15 ? bestAway15(g.hands[0]) : 0 });
	let snap = $state<Snap>({ pile: 0, top: null, sizes: [0, 0, 0, 0], myTop: null, gosterge: 0, okey: 0, turn: 0, away: 0 });
	const top3 = $derived(snap.top), myAway = $derived(snap.away);
	function bestAway15(h: number[]) { let b = 14; for (const i of new Set(h)) { const r = h.slice(); r.splice(r.indexOf(i), 1); b = Math.min(b, tilesAway(r, g.okey)); if (!b) break; } return b; }
	const oppOrder = (s: number) => (phase === 'over' ? (() => { const p = partition(g.hands[s], g.okey); return [...p.sets.flat(), ...p.left]; })() : g.hands[s]);
	function view(): View {
		return {
			rack: rack.slice(), opp: [1, 2, 3].map(oppOrder), pile: g.pile.slice(), discards: g.discards.map((d) => d.slice()), gosterge: g.gosterge, okey: g.okey, turn: phase === 'over' ? -1 : g.turn,
			sel, sets: hl, zones: { pile: phase === 'draw' && g.pile.length > 0, take: phase === 'draw' && g.top(0) !== null, discard: phase === 'discard' && sel !== null }, reveal: phase === 'over', names
		};
	}
	$effect(() => { void ver; void rack; void sel; void hl; void phase; void names; if (mode3d) s3?.update(view(), true); });

	// ---- game flow
	function refresh() { snap = snapOf(); ver++; }
	async function newGame() {
		const id = ++gameId; testGame = false; openTicket(id);
		start(new OkeyGame(), id);
	}
	function start(game: OkeyGame, id: number) {
		g = game; rack = arrange(g.hands[0], g.okey); sel = null; hl = new Map(); result = null; info = ''; lastTake = null;
		bots = [0, 1, 2, 3].map(() => ({ p: NaN, away: 0 })); closeSaid = [9, 9, 9, 9];
		phase = 'deal'; refresh();
		say(pick(t.start));
		setTimeout(() => { if (id === gameId) nextTurn(id); }, reduced ? 50 : 700);
	}
	function nextTurn(id: number) {
		if (id !== gameId || g.winner !== null) return;
		if (g.exhausted) { over(null); return; }
		if (g.turn === 0) { phase = g.needsDraw(0) ? 'draw' : 'discard'; status = phase === 'draw' ? t.drawFirst : t.discardNow; refresh(); return; }
		phase = 'bots'; status = t.botTurn(names[g.turn]); refresh();
		botTurn(g.turn, id);
	}
	function humanDraw(take: boolean) {
		if (phase !== 'draw') return;
		if (take && g.top(0) === null) return;
		if (!take && !g.pile.length) return;
		const tile = take ? g.takeDiscard(0) : g.drawPile(0);
		rack = placeNew(rack, tile); sel = tile; hl = new Map(); phase = 'discard'; status = t.discardNow; refresh();
	}
	function humanDiscard(tile: number | null) {
		if (phase !== 'discard') return;
		if (tile === null) { status = t.selectFirst; return; }
		rack = remove(rack, tile); sel = null; hl = new Map();
		g.discard(0, tile); refresh();
		nextTurn(gameId);
	}
	function finishHuman() {
		if (phase !== 'discard') return;
		const h = g.hands[0];
		const cands = sel !== null && g.winWith(0, sel) ? [sel] : [...h].sort((a, b) => +(ttype(a) !== g.okey) - +(ttype(b) !== g.okey));
		const tile = cands.find((i) => g.winWith(0, i));
		if (tile === undefined) {
			hl = setMap(h, g.okey); status = t.notWin(myAway); say(pick(t.invalid)); return;
		}
		rack = remove(rack, tile); sel = null;
		g.discard(0, tile, true); refresh();
		over(0);
	}
	let closeSaid = [9, 9, 9, 9];
	async function botTurn(s: number, id: number) {
		const mod = ai ?? (ai = await import('#lib/okey-ai'));
		await sleep(420); if (id !== gameId) return;
		let took = false, d = { n: 0, ms: 0 };
		if (g.needsDraw(s)) {
			const r = await mod.chooseDraw(g, s); if (id !== gameId) return;
			took = r.take; d = r;
			if (took) { lastTake = g.top(s); g.takeDiscard(s); } else g.drawPile(s);
			refresh(); await sleep(520); if (id !== gameId) return;
		}
		const c = await mod.chooseDiscard(g, s); if (id !== gameId) return;
		g.discard(s, c.tile, c.finish);
		bots[s] = { p: c.p, away: c.away }; info = t.candidates(d.n + c.n, fmtMs(d.ms + c.ms));
		refresh();
		if (c.finish) { over(s); return; }
		const v = { b: names[s], p: c.p, a: c.away, n: d.n + c.n, ms: d.ms + c.ms };
		if (took) say(fill(pick(t.took), v), names[s]);
		else if (c.away <= 2 && c.away < closeSaid[s]) { closeSaid[s] = c.away; say(fill(pick(t.close), v), names[s]); }
		else if (Math.random() < 0.2) say(fill(pick(c.away >= 5 ? [...t.far, ...t.draw] : t.draw), v), names[s]);
		await sleep(380); if (id !== gameId) return;
		nextTurn(id);
	}
	function over(winner: number | null) {
		phase = 'over'; result = { winner, finish: g.finish }; sel = null;
		if (winner !== null) {
			// highlight the sets (or pairs) of the human's winning rack; bot hands are revealed face-up, arranged by the solver
			hl = winner !== 0 ? new Map() : g.finish?.kind === 'cift' ? pairMap(g.hands[0]) : setMap(g.hands[0], g.okey);
		}
		status = winner === null ? t.pileOut : winner === 0 ? t.youWin : t.botWin(names[winner]);
		say(pick(winner === null ? t.pileOutC : winner === 0 ? t.humanWon : t.botWon), winner && winner > 0 ? names[winner] : 'Okey‑257');
		refresh();
		if (!testGame) report(winner === null ? 'draw' : winner === 0 ? 'human' : 'model');
	}
	function pairMap(h: number[]) {
		const m = new Map<number, number>(), by = new Map<number, number[]>(); let k = 0;
		for (const id of h) { const ty = ttype(id) === g.okey ? -1 : ttype(id) === FJ ? g.okey : ttype(id); (by.get(ty) ?? by.set(ty, []).get(ty)!).push(id); }
		const wild = by.get(-1) ?? []; const singles: number[] = [];
		for (const [ty, ids] of by) { if (ty < 0) continue; for (let i = 0; i + 1 < ids.length; i += 2) { m.set(ids[i], k); m.set(ids[i + 1], k++); } if (ids.length % 2) singles.push(ids[ids.length - 1]); }
		for (const s of singles) { const wv = wild.pop(); if (wv === undefined) break; m.set(s, k); m.set(wv, k++); }
		while (wild.length >= 2) { m.set(wild.pop()!, k); m.set(wild.pop()!, k++); }
		return m;
	}
	function doArrange() { if (phase === 'deal' || phase === 'over') return; rack = arrange(g.hands[0], g.okey); hl = setMap(g.hands[0], g.okey); }

	// ---- input (shared by the 3D scene and the 2D fallback)
	function clickTile(id: number) {
		if (!rack.includes(id)) return;
		sel = sel === id ? null : id;
	}
	function clickSlot(slot: number) {
		if (sel === null) return;
		rack = move(rack, sel, slot); sel = null; hl = new Map();
	}
	function clickZone(z: Zone) {
		if (z === 'pile') humanDraw(false); else if (z === 'take') humanDraw(true); else humanDiscard(sel);
	}
	function drop(id: number, to: { slot: number } | { zone: Zone }) {
		if ('zone' in to) { if (to.zone === 'discard' && phase === 'discard') humanDiscard(id); return; }
		rack = move(rack, id, to.slot); if (sel === id) sel = null; hl = new Map();
	}
	// 2D drag (HTML5) for the fallback rack
	let dragId: number | null = null;

	// ---- test hook: ?test=win deals the human (dealer) a finished hand; such games are never counted
	function rigged(): OkeyGame {
		for (;;) {
			const game = new OkeyGame(0);
			const want = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [1, 6], [1, 7], [2, 9], [2, 10], [2, 11], [2, 12], [0, 8], [1, 8], [2, 8]].map(([c, v]) => (c * 13 + v - 1) * 2);
			const ids = want.map((i) => (i === game.gosterge ? i + 1 : i));
			if (ids.some((i) => ttype(i) === game.okey || ttype(game.gosterge) === ttype(i))) continue;
			const where = (i: number): [number[], number] => { for (const a of [game.pile, ...game.hands]) { const k = a.indexOf(i); if (k >= 0) return [a, k]; } throw new Error('tile?'); };
			const h = game.hands[0];
			ids.forEach((i, k) => { const [a, j] = where(i); [a[j], h[k]] = [h[k], a[j]]; });
			return game;
		}
	}

	const jsonLd = $derived({
		'@context': 'https://schema.org', '@type': ['WebApplication', 'VideoGame'], name: 'Okey‑257', alternateName: t.title, url: urlFor(lang, 'okey'), description: t.desc,
		inLanguage: lang, applicationCategory: 'GameApplication', genre: 'Tile game', gamePlatform: 'Web browser', operatingSystem: 'Any (web browser)', isAccessibleForFree: true, numberOfPlayers: 4,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Anıl ÖZ' }, sameAs: [REPO], image: `${SITE}/og-okey.png`,
		isPartOf: { '@type': 'WebSite', name: 'Tiny Models', url: `${SITE}/` }
	});
	const fmtPct = (r: { w: number; n: number }) => (r.n ? `${pct.format(r.w / r.n)} (${nf.format(r.w)}/${nf.format(r.n)})` : '—');
	const card = $derived(t.card({
		params: nf.format(STATS.params), games: `≈${nf.format(STATS.games)}`, samples: nf.format(STATS.samples), iterations: `≈${nf.format(STATS.iterations)}`, hours: `≈${STATS.minutes} min × ${STATS.procs} CPU`,
		vsRandom: fmtPct(STATS.vsRandom), vsGreedy: fmtPct(STATS.vsGreedy), greedyRef: fmtPct(STATS.greedyRef), size: `${(STATS.onnxBytes / 1024).toLocaleString(lang, { maximumFractionDigits: 1 })} KB ONNX`
	}));
	const SQ = ['🟥', '🟨', '🟦', '⬛'];
	const colorName = (ty: number) => t.colors[tcol(ty)];
	const tileLabel = (id: number) => (ttype(id) === FJ ? '★' : String(tval(ttype(id))));
	const tileCls = (id: number) => (ttype(id) === FJ ? 'fj' : `c${tcol(ttype(id))}`);
	const gt = $derived(snap.gosterge), gtT = $derived(ttype(snap.gosterge)), ok = $derived(snap.okey); // gt = tile id, gtT / ok = tile types

	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = mq.matches;
		const sp = new URLSearchParams(location.search), q = sp.get('lang') as Lang | null;
		if (data.lang) lang = data.lang;
		else if (q && LANGS.some((l) => l.code === q)) { lang = q; localStorage.setItem('lang', q); window.history.replaceState(window.history.state, '', pathFor(q, 'okey')); }
		(async () => {
			try {
				if (!canvas3d || sp.has('2d')) throw new Error('no canvas');
				const mod = await import('#lib/okey-scene');
				s3 = mod.createOkeyScene(canvas3d, { onTile: clickTile, onSlot: clickSlot, onZone: clickZone, onDrop: drop, reducedMotion: () => reduced });
				(window as unknown as { __okey3d?: OkeyScene }).__okey3d = s3; // used by the headless prod test
				mode3d = true; s3.update(view(), false);
				const ro = new ResizeObserver(updateInsets); for (const el of [panelEl, seatsEl, headerEl]) if (el) ro.observe(el);
				window.addEventListener('resize', updateInsets); updateInsets();
			} catch (e) { console.info('[okey] WebGL unavailable, using the 2D table', e); s3 = null; webglFailed = true; }
			(window as unknown as { __okeyUi?: () => object }).__okeyUi = () => ({ phase, turn: g.turn, rack: [...rack], sel, hand: g.hands[0].length, winner: g.winner, pile: g.pile.length, away: myAway, mode3d, engine });
			loadStats();
			ai = await import('#lib/okey-ai');
			if (sp.get('test') === 'win') { const id = ++gameId; testGame = true; ticket = null; start(rigged(), id); }
			else newGame();
			try { engine = await ai.loadOkeyEngine(); } catch { engine = 'ts'; }
		})();
		return () => { gameId++; streamId++; s3?.destroy(); s3 = null; };
	});
	$effect(() => { document.documentElement.lang = lang; });
	function setLang(l: Lang) { lang = l; setLangPref(l); try { replaceState(pathFor(l, 'okey'), {}); } catch { /* router not ready */ } }
</script>

<Seo {lang} slug="okey" title={t.title} desc={t.desc} image="/og-okey.png" {jsonLd} />
<svelte:window onkeydown={(e) => { const tag = (e.target as HTMLElement).tagName; if (tag === 'SELECT' || tag === 'BUTTON') return; if (e.key === 'a' || e.key === 'A') doArrange(); if (phase === 'draw' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); humanDraw(false); } }} />

<div class="ok" class:full={!webglFailed}>
	<div class="table" aria-hidden="true"></div>
	{#if !webglFailed}<canvas bind:this={canvas3d} class="stage3d" aria-label="Okey table (3D)"></canvas>{/if}
	<main>
		<header bind:this={headerEl}>
			<a class="back" href={pathFor(lang, '')} aria-label={HUB[lang].back}>←</a>
			<h1 class="brand"><span class="dot" class:live={engine !== 'loading'}></span> Okey‑257 <small>14‑16‑1 · 1‑ply</small><span class="sr-only"> · {t.title.split('·').slice(1).join('·').trim()}</span></h1>
			<select class="lang" aria-label="Language" value={lang} onchange={(e) => setLang(e.currentTarget.value as Lang)}>
				{#each LANGS as l (l.code)}<option value={l.code}>{l.code.toUpperCase()} · {l.name}</option>{/each}
			</select>
		</header>
		<p class="pitch">{t.pitch}</p>
		<noscript><p>{t.desc}</p></noscript>

		<div class="seats" bind:this={seatsEl} aria-live="polite">
			{#each [0, 1, 2, 3] as s (s)}
				{@const v = s === 0 ? null : bots[s]}
				<div class="seat" class:on={phase !== 'over' && phase !== 'deal' && snap.turn === s} class:won={result?.winner === s}>
					<b>{names[s]}</b>
					{#if s === 0}<small>{t.away(myAway)}</small>{:else}<small>{v && Number.isFinite(v.p) ? `${pct.format(v.p)} · ${t.away(v.away)}` : '—'}</small>{/if}
				</div>
			{/each}
			<span class="br" aria-hidden="true"></span>
			<div class="hud" role="note" aria-label={`${t.gosterge} ${colorName(gtT)} ${tval(gtT)}, ${t.okey} ${colorName(ok)} ${tval(ok)}`}>
				<span>{t.gosterge}: <b class="c{tcol(gtT)}"><i aria-hidden="true">{SQ[tcol(gtT)]}</i>{tval(gtT)}</b></span><span class="sep">·</span><span>{t.okey}: <b class="c{tcol(ok)} okb"><i aria-hidden="true">{SQ[tcol(ok)]}</i>{tval(ok)}</b></span>
			</div>
		</div>

		{#if webglFailed}
			<div class="flat" role="group" aria-label="Okey table">
				<div class="opps">{#each [1, 2, 3] as s (s)}<div class="opp" class:on={snap.turn === s && phase === 'bots'}>{names[s]} · {snap.sizes[s]}
					{#if phase === 'over'}<div class="mini">{#each oppOrder(s) as id (id)}<span class="tl sm {tileCls(id)}" class:okey={ttype(id) === ok}>{tileLabel(id)}</span>{/each}</div>{/if}</div>{/each}</div>
				<div class="mid">
					<button class="zone" class:hot={phase === 'draw'} onclick={() => clickZone('pile')} disabled={phase !== 'draw'}>{t.pile}<br /><b>{snap.pile}</b></button>
					<button class="zone" class:hot={phase === 'draw' && top3 !== null} onclick={() => clickZone('take')} disabled={phase !== 'draw' || top3 === null}>{t.take}<br />{#if top3 !== null}<span class="tl {tileCls(top3)}">{tileLabel(top3)}</span>{/if}</button>
					<div class="zone ind">{t.gosterge}<br /><span class="tl {tileCls(gt)}">{tileLabel(gt)}</span></div>
					<div class="zone ind">{t.okey}<br /><span class="tl c{tcol(ok)} okey">{tval(ok)}</span></div>
					<button class="zone" class:hot={phase === 'discard' && sel !== null} onclick={() => clickZone('discard')} disabled={phase !== 'discard'}>{t.discard}<br />{#if snap.myTop !== null}<span class="tl {tileCls(snap.myTop)}">{tileLabel(snap.myTop)}</span>{/if}</button>
				</div>
				<div class="rack2d">
					{#each rack as id, k (k)}
						<div class="slot" role="button" tabindex="-1" onclick={() => (id === null ? clickSlot(k) : clickTile(id))} onkeydown={() => {}}
							ondragover={(e) => e.preventDefault()} ondrop={() => { if (dragId !== null) drop(dragId, { slot: k }); dragId = null; }} style:grid-row={Math.floor(k / ROW) + 1} style:grid-column={(k % ROW) + 1}>
							{#if id !== null}<span class="tl {tileCls(id)}" class:sel={sel === id} class:okey={ttype(id) === ok} class:set={hl.has(id)} style:--set={hl.get(id) ?? 0} draggable="true" ondragstart={() => (dragId = id)} role="img" aria-label={tileLabel(id)}>{tileLabel(id)}</span>{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<aside class="panel" bind:this={panelEl}>
			<div class="turn"><b>{status || '…'}</b></div>
			<div class="ind3"><span>{t.gosterge} <span class="tl sm {tileCls(gt)}">{tileLabel(gt)}</span></span><span>{t.okey} <span class="tl sm c{tcol(ok)} okey">{tval(ok)}</span></span><span>{t.pile} <b>{snap.pile}</b></span></div>
			<div class="btns">
				{#if phase === 'draw'}<button class="primary" onclick={() => humanDraw(false)} disabled={!snap.pile}>{t.drawPile}</button><button onclick={() => humanDraw(true)} disabled={top3 === null}>{t.take}{#if top3 !== null} <span class="tl sm {tileCls(top3)}">{tileLabel(top3)}</span>{/if}</button>
				{:else if phase === 'discard'}<button class="primary" onclick={() => humanDiscard(sel)} disabled={sel === null}>{t.discard}</button><button class="fin" onclick={finishHuman}>{t.finish}</button>
				{:else if phase === 'over'}<button class="primary" onclick={newGame}>{t.newGame}</button>{/if}
				{#if phase === 'draw' || phase === 'discard' || phase === 'bots'}<button onclick={doArrange} title="A">{t.arrange}</button>{/if}
			</div>
			{#if result?.finish && (result.finish.kind === 'cift' || result.finish.okeyDiscard)}<p class="res">{result.finish.kind === 'cift' ? t.cift : t.okeyFinish} {t.double}{#if result.finish.kind === 'cift' && result.finish.okeyDiscard} · {t.okeyFinish} {t.double}{/if}</p>{/if}
			<div class="comment" aria-live="polite"><span class="who">{who || 'Okey‑257'}:</span> {shown}{#if streaming}<span class="cursor" aria-hidden="true">▍</span>{/if}</div>
			{#if gstats}<div class="gstats" aria-live="polite">
				<small>{ts.title}</small>
				<p>{ts.line(nf.format(gstats.games), gstats.games, nf.format(gstats.human), nf.format(gstats.bots))}</p>
				{#if gstats.draws}<p class="gm">{ts.draws(nf.format(gstats.draws))}</p>{/if}
				<p class="lead">{leadLine}{#if counted} <span class="okc">✓ {ts.counted}</span>{/if}</p>
			</div>{/if}
			{#if info}<p class="info mono">{info}</p>{/if}
			<p class="engine mono">{t.engineLabel}: {engineName(engine)}</p>
			<p class="hint">{t.hint}</p>
			{#if phase !== 'over' && phase !== 'deal'}<button class="ghost" onclick={newGame}>{t.newGame}</button>{/if}
			<details>
				<summary>{t.cardTitle}</summary>
				<ul>{#each card as [k, v] (k)}<li><b>{k}:</b> {v}</li>{/each}<li><b>GitHub:</b> <a href={REPO} target="_blank" rel="noopener">hocestnonsatis/coinflip-ai</a></li></ul>
			</details>
		</aside>
	</main>
</div>

<style>
	:global(html) { background: #07070c; }
	.ok { position: fixed; inset: 0; overflow-y: auto; color: #eae6da; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-overflow-scrolling: touch; }
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
	.stage3d { position: fixed; inset: 0; width: 100vw; height: 100dvh; display: block; touch-action: none; cursor: pointer; background: #050403; }
	.seats { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 0 0 10px; }
	.br { flex-basis: 100%; height: 0; }
	.hud { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 99px; background: #0c0c16c8; border: 1px solid #ffd36b40; font-size: 13px; }
	.hud b { font: 900 15px Georgia, serif; background: linear-gradient(180deg, #fbf6e6, #e2d6b6); border-radius: 4px; padding: 0 5px 0 3px; display: inline-flex; align-items: center; gap: 3px; }
	.hud b i { font-style: normal; font-size: 10px; } .hud .okb { box-shadow: 0 0 0 2px #ffb000; } .hud .sep { opacity: 0.5; }
	.seat { flex: 1; max-width: 170px; text-align: center; padding: 5px 8px; border-radius: 12px; background: #0c0c16a0; border: 1px solid #ffffff14; font-size: 12px; line-height: 1.25; transition: background 0.3s, box-shadow 0.3s; }
	.seat small { display: block; opacity: 0.7; font-size: 11px; font-family: ui-monospace, monospace; }
	.seat.on { background: #ffcf5a; color: #1a1205; box-shadow: 0 0 18px #ffcf5a88; } .seat.on small { opacity: 0.85; }
	.seat.won { outline: 2px solid #36e27e; }
	.ok.full { overflow: hidden; }
	.ok.full main { position: fixed; inset: 0; max-width: none; pointer-events: none; padding: max(10px, env(safe-area-inset-top)) 14px 0; }
	.ok.full header, .ok.full .seats, .ok.full .panel { pointer-events: auto; }
	.ok.full header { background: #0c0c16a0; backdrop-filter: blur(10px); border: 1px solid #ffffff14; border-radius: 99px; padding: 4px 6px; }
	.ok.full .pitch { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
	.ok.full .seats { position: fixed; top: calc(max(10px, env(safe-area-inset-top)) + 50px); left: 14px; right: 310px; margin: 0; }
	.ok.full .panel { position: fixed; right: 14px; top: calc(max(10px, env(safe-area-inset-top)) + 50px); width: 280px; max-height: calc(100dvh - 76px); overflow-y: auto; padding: 12px; box-sizing: border-box; }
	@media (max-aspect-ratio: 1/1), (max-width: 760px) {
		.ok.full .seats { top: calc(max(10px, env(safe-area-inset-top)) + 46px); left: 8px; right: 8px; gap: 4px; }
		.seat { padding: 4px 4px; font-size: 11px; } .seat small { font-size: 10px; }
		.ok.full .panel { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 30dvh; max-height: none; border-radius: 18px 18px 0 0; padding: 8px 12px max(8px, env(safe-area-inset-bottom)); }
		.ok.full .panel .hint, .ok.full .panel .engine { display: none; }
		.ok.full .comment { margin: 6px 0; min-height: 2.6em; font-size: 13px; }
	}
	.panel { background: #0c0c16c0; border: 1px solid #ffffff1a; border-radius: 18px; padding: 14px; backdrop-filter: blur(14px); box-shadow: 0 20px 60px #0008; }
	.turn { text-align: center; min-height: 1.4em; font-size: 15px; }
	.ind3 { display: flex; justify-content: center; gap: 12px; margin: 6px 0 8px; font-size: 12px; align-items: center; flex-wrap: wrap; }
	.btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; min-height: 48px; }
	button { font: inherit; font-weight: 700; color: #eae6da; background: #ffffff12; border: 1px solid #ffffff2a; border-radius: 12px; padding: 10px 14px; cursor: pointer; }
	button:disabled { opacity: 0.4; cursor: default; }
	button.primary { flex: 1 1 100%; padding: 12px; font-size: 16px; font-weight: 800; border: 0; color: #1a1205; background: linear-gradient(180deg, #ffe08a, #e9a23b); box-shadow: 0 8px 30px #ffae3a55, inset 0 1px 0 #fff8; }
	.btns button:not(.primary) { flex: 1 1 0; font-size: 13px; padding: 9px 8px; }
	button.fin { background: #1d6b3a; border-color: #36e27e88; }
	button.ghost { width: 100%; margin-top: 8px; font-size: 13px; padding: 8px; }
	.res { text-align: center; font-family: Georgia, serif; font-size: 20px; margin: 8px 0 0; color: #ffd36b; }
	.comment { margin: 12px 0; min-height: 3.2em; font-size: 14px; font-style: italic; line-height: 1.4; }
	.who { font-style: normal; font-weight: 700; color: #ffd36b; }
	.cursor { animation: blink 0.8s steps(1) infinite; font-style: normal; }
	.info, .engine { margin: 8px 0 0; text-align: center; font-size: 10px; opacity: 0.6; }
	.hint { margin: 8px 0 0; font-size: 11px; opacity: 0.55; text-align: center; }
	.gstats { margin: 10px 0 0; padding: 8px 10px; border-radius: 12px; background: #ffffff08; border: 1px solid #ffd36b26; text-align: center; font-size: 12px; line-height: 1.35; }
	.gstats small { display: block; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #ffd36b; opacity: 0.85; }
	.gstats p { margin: 3px 0 0; } .gstats .gm { opacity: 0.7; font-size: 11px; } .gstats .lead { font-style: italic; opacity: 0.8; } .gstats .okc { font-style: normal; color: #36e27e; }
	details { margin-top: 10px; font-size: 13px; } summary { cursor: pointer; opacity: 0.85; }
	details a { color: #ffd36b; }
	details ul { padding-left: 18px; margin: 8px 0 0; line-height: 1.5; opacity: 0.85; }
	/* tiles (2D fallback + chips) */
	.tl { display: inline-grid; place-items: center; width: 30px; height: 42px; border-radius: 5px; background: linear-gradient(180deg, #f6f0de, #e9e0c8); font: 900 19px Georgia, serif; -webkit-text-stroke: 0.6px currentColor; box-shadow: 0 2px 4px #0008, inset 0 -2px 0 #0002; user-select: none; vertical-align: middle; }
	.tl.sm { width: 22px; height: 30px; font-size: 15px; border-radius: 4px; }
	/* ink palette = okey-ink.ts INK (tests check they match) */
	.c0 { color: #c8102e; } .c1 { color: #b87a00; } .c2 { color: #0047d6; } .c3 { color: #121212; } .fj { color: #1d6b3a; }
	/* highlights are borders only (outside the face): never tint the background or ink */
	.tl.set { box-shadow: 0 0 0 2px #4ab8ff, 0 2px 4px #0008; }
	.tl.okey { box-shadow: 0 0 0 2px #ffb000, 0 2px 4px #0008; }
	.tl.sel { transform: translateY(-6px); box-shadow: 0 0 0 3px #36e27e, 0 6px 10px #000a; }
	/* rack tiles carry the ink dot under the number like real tiles, so an upside-down okey 6 / 9 stays unambiguous */
	.rack2d .tl { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
	.rack2d .tl:not(.fj)::after { content: ''; width: 6px; height: 6px; background: currentColor; margin-top: 3px; } /* colour-blind hint: red ◆, yellow ▲, blue ■, black ● */
	.rack2d .tl.c0::after { transform: rotate(45deg) scale(0.85); } .rack2d .tl.c1::after { clip-path: polygon(50% 0, 100% 100%, 0 100%); width: 7px; } .rack2d .tl.c3::after { border-radius: 50%; }
	/* real okeys in the rack are turned upside down (as at a real table) with a gold rim; false jokers stay upright */
	.rack2d .tl.okey { transform: rotate(180deg); box-shadow: 0 0 0 2px #ffb000, 0 0 10px #ffb00088, 0 -2px 4px #0008; }
	.rack2d .tl.okey.sel { transform: rotate(180deg) translateY(6px); box-shadow: 0 0 0 3px #36e27e, 0 0 10px #ffb00088; }
	.flat { max-width: 760px; margin: 0 auto 12px; padding: 12px; border-radius: 16px; background: #1f3f2acc; box-shadow: 0 20px 60px #000a; }
	.opps { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; }
	.opp { flex: 1; padding: 6px; border-radius: 10px; background: #00000040; text-align: center; } .opp.on { background: #ffcf5a; color: #1a1205; }
	.mini { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; margin-top: 4px; }
	.mid { display: flex; justify-content: center; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
	.zone { min-width: 76px; padding: 8px; border-radius: 12px; background: #00000040; border: 1px dashed #ffffff40; font-size: 12px; text-align: center; line-height: 1.6; }
	.zone.hot { border: 2px solid #ffcf5a; box-shadow: 0 0 14px #ffcf5a66; }
	.zone.ind { border-style: solid; }
	.rack2d { display: grid; grid-template-columns: repeat(13, 1fr); gap: 3px; padding: 8px 6px; border-radius: 10px; background: linear-gradient(180deg, #7a4a26, #4a2a12); box-shadow: inset 0 2px 6px #0008; }
	.slot { min-height: 46px; display: grid; place-items: center; border-radius: 4px; background: #00000022; cursor: pointer; }
	@media (max-width: 560px) { .tl { width: 22px; height: 32px; font-size: 14px; } .slot { min-height: 36px; } .rack2d { gap: 2px; padding: 6px 3px; } main { padding-left: 8px; padding-right: 8px; } .brand small { display: none; } }
	@keyframes blink { 50% { opacity: 0.1; } }
	@media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
</style>
