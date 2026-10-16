<script lang="ts">
	import { onMount } from 'svelte';
	import { infer, WEIGHT, BITS, SCALE, type Side } from '#lib/model';
	import { DICTS, LANGS, detectLang, type Lang } from '#lib/i18n';
	import type { CoinScene } from '#lib/scene';
	import type { Backend } from '#lib/engine';

	type Phase = 'loading' | 'ready' | 'thinking' | 'flipping' | 'done';
	let canvas: HTMLCanvasElement;
	let scene: CoinScene | undefined;
	let phase = $state<Phase>('loading');
	let loadPct = $state(0);
	let log = $state<string[]>([]);
	let lang = $state<Lang>('en');
	let last = $state<{ result: Side; confidence: number; z: number; trit: number; tps: number; ms: number } | null>(null);
	let legendary = $state(false);
	const pct = $derived(new Intl.NumberFormat(lang, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	const num = (n: number, d = 3) => n.toLocaleString(lang, { minimumFractionDigits: d, maximumFractionDigits: d });
	let history = $state<Side[]>([]);
	const revealed = $derived(history.includes('dik'));
	let reduced = $state(false);
	let webglError = $state(false);
	const t = $derived(DICTS[lang]);
	let question = $state('');
	let asked = $state('');
	let oracle = $state('');
	let oracleShown = $state('');
	let streaming = $state(false);
	let streamId = 0;
	let engine = $state<Backend | 'loading'>('loading');
	let engineMod: typeof import('#lib/engine') | undefined;
	let copyFeedback = $state<'idle' | 'ok' | 'fail'>('idle');
	let copyTimer = 0;
	const tokenize = (text: string) => (text.match(/\S+\s*|\s+/g) ?? []).flatMap((w) => (w.length > 6 ? w.match(/.{1,4}/gsu) ?? [w] : [w]));
	async function streamOracle(text: string) {
		const id = ++streamId;
		oracle = text;
		if (!text || reduced) { oracleShown = text; streaming = false; return; }
		oracleShown = ''; streaming = true;
		await sleep(250 + Math.random() * 350); // "thinking"
		for (const tok of tokenize(text)) {
			if (id !== streamId) return;
			oracleShown += tok;
			await sleep(25 + Math.random() * 65 + (/[.,!?;:…]\s*$/.test(tok) ? 120 : 0));
		}
		if (id === streamId) streaming = false;
	}
	function fill(line: string, v: { conf: number; tps: number; ms: number; z: number }) {
		const map: Record<string, string> = { conf: pct.format(v.conf), tps: v.tps.toLocaleString(lang), ms: num(v.ms, 0), w: num(0.4271, 4), z: num(v.z) };
		return line.replace(/\{(conf|tps|ms|w|z)\}/g, (_, k) => map[k]);
	}
	const answer = (s: Side) => (s === 'yazi' ? t.yes : s === 'tura' ? t.no : t.maybe);
	function formatTps(n: number) {
		if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
		if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
		return n.toLocaleString(lang);
	}
	function verdictText() {
		if (!last) return '';
		const conf = pct.format(last.confidence);
		const tps = formatTps(last.tps);
		const side = label(last.result);
		if (asked) {
			const q = asked.replace(/[?？]+$/, '');
			return `CoinFlip-1P · “${q}?” → ${answer(last.result).toLocaleUpperCase(lang)} (${side}) · conf ${conf} · ${tps} tok/s`;
		}
		return `CoinFlip-1P · ${side.toLocaleUpperCase(lang)} · conf ${conf} · ${tps} tok/s`;
	}
	async function copyVerdict() {
		if (!last) return;
		clearTimeout(copyTimer);
		try {
			await navigator.clipboard.writeText(verdictText());
			copyFeedback = 'ok';
		} catch {
			copyFeedback = 'fail';
		}
		copyTimer = window.setTimeout(() => (copyFeedback = 'idle'), 1500);
	}

	const count = (k: Side) => history.filter((h) => h === k).length;
	const busy = $derived(phase === 'thinking' || phase === 'flipping' || phase === 'loading');
	const engineName = (e: Backend | 'loading') => e === 'webgpu' ? 'ONNX Runtime · WebGPU' : e === 'wasm' ? 'ONNX Runtime · WASM' : e === 'loading' ? '…' : t.engineTs;
	const label = (s: Side) => (s === 'yazi' ? t.heads : s === 'tura' ? t.tails : t.edge);
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const push = (l: string) => (log = [...log.slice(-4), l]);

	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = mq.matches;
		lang = detectLang();
		const onMq = () => (reduced = mq.matches);
		mq.addEventListener('change', onMq);
		let cancelled = false;
		(async () => {
			try {
				const mod = await import('#lib/scene'); // three.js only on client
				if (cancelled) return;
				scene = mod.createScene(canvas);
				scene.setFaces(t.heads, t.tails, t.coinLegend, t.edgeLegend);
			} catch (e) { console.error(e); webglError = true; }
			push(`▸ ${t.loading}…`);
			for (let i = 0; i <= 4; i++) { loadPct = i * 25; await sleep(reduced ? 30 : 260); }
			push(`▸ w = 0.4271 · ${t.weightsPlain}`);
			phase = 'ready';
			// lazy: ORT loads after first paint/ready, never blocks the UI
			await new Promise((r) => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 2000 }) : setTimeout(r, 300)));
			try { engineMod = await import('#lib/engine'); engine = await engineMod.loadEngine(); } catch { engine = 'ts'; }
			if (!cancelled && engine !== 'ts') push(`▸ ${t.engineLabel}: ${engineName(engine)}`);
		})();
		return () => { cancelled = true; mq.removeEventListener('change', onMq); scene?.destroy(); };
	});

	$effect(() => {
		document.documentElement.lang = lang;
		document.title = t.title;
		scene?.setFaces(t.heads, t.tails, t.coinLegend, t.edgeLegend);
	});
	function setLang(l: Lang) { lang = l; localStorage.setItem('lang', l); }

	const HOLD_CAP = 3000;
	let holding = $state(false);
	let charge = $state(0); // 0..1 (+ overcharge)
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
		flip(holdMs);
	}
	function cancelHold() { if (holding) release(); }
	const isTrigger = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';

	async function flip(holdMs: number) {
		if (busy) return;
		asked = question.trim();
		streamId++; oracle = ''; oracleShown = ''; streaming = false;
		clearTimeout(copyTimer); copyFeedback = 'idle';
		legendary = false;
		const power = Math.min(holdMs, HOLD_CAP) / HOLD_CAP;
		phase = 'thinking';
		let ms = engineMod ? await engineMod.bench() : null; // real ORT session.run timing
		if (ms === null) { // TS fallback: batch so values aren't quantized by coarse timers
			const t0 = performance.now(); let i = 0, el = 0;
			do { for (let k = 0; k < 500; k++) infer(holdMs + (i * 500 + k) * 1e-3); i++; el = performance.now() - t0; } while (el < 50 && i < 200);
			ms = Math.max(el / (i * 500), 1e-6);
		}
		const out = infer(holdMs);
		if (engineMod && engine !== 'ts' && engine !== 'loading' && out.trit !== 0) {
			out.p = await engineMod.runP(out.z); // p from ONNX Runtime; edge band stays in TS
			out.confidence = Math.max(out.p, 1 - out.p);
		}
		push(t.quips[Math.floor(Math.random() * t.quips.length)]);
		if (holdMs > HOLD_CAP) push(`⚡ ${t.overcharge}`);
		push(`▸ ${t.holdLog(num(holdMs))} → z=${num(out.z)}` + (out.result === 'dik' || revealed ? ` · τ=${num(out.tau, 5)} → trit=${out.trit > 0 ? '+1' : out.trit}` : ` → σ(w·z·1.5)=${num(out.p, 4)}`));
		phase = 'flipping';
		const finish = () => {
			last = { result: out.result, confidence: out.confidence, z: out.z, trit: out.trit, ms, tps: Math.round(1000 / ms) };
			history = [out.result, ...history].slice(0, 40);
			phase = 'done';
			const pool = out.result === 'yazi' ? [...t.yesLines, ...t.bothLines] : out.result === 'tura' ? [...t.noLines, ...t.bothLines] : t.maybeLines;
			const q = asked.replace(/[?？]+$/, '');
			streamOracle(q ? `“${q}?” — ${fill(pool[Math.floor(Math.random() * pool.length)], { conf: out.confidence, tps: last.tps, ms: holdMs, z: out.z })}` : '');
			if (out.result === 'dik') push(`★ ${t.reveal} (w = ${WEIGHT > 0 ? '+1' : WEIGHT}, log₂3 = ${num(BITS, 2)})`);
			push(t.output(label(out.result).toLocaleUpperCase(lang), pct.format(out.confidence)));
		};
		if (scene) scene.flipCoin({ result: out.result, reducedMotion: reduced, power, onLegendary: () => (legendary = true), onDone: finish });
		else { if (out.result === 'dik') legendary = true; finish(); }
	}
</script>

<svelte:head><meta name="description" content={t.desc} /></svelte:head>
<svelte:window onkeydown={(e) => { const tag = (e.target as HTMLElement).tagName; if (tag === 'SELECT' || tag === 'SUMMARY' || !isTrigger(e)) return; if (tag === 'INPUT' && e.code === 'Space') return; e.preventDefault(); if (!e.repeat) startHold(); }}
	onkeyup={(e) => { if (isTrigger(e) && holding) { e.preventDefault(); release(); } }}
	onblur={cancelHold} />

<canvas bind:this={canvas} class="stage" aria-hidden="true"></canvas>

<main class:reduced>
	<header>
		<div class="brand"><span class="dot" class:live={phase !== 'loading'}></span> CoinFlip‑1P <small>v0.0.1‑ultra‑quant</small></div>
		<div class="right">
			<div class="badges"><span class="sota">{t.badges[0]}</span><span>{t.badges[1]}</span><span>{t.badges[2]}</span><span>{t.badges[3]}</span></div>
			<select class="lang" aria-label={t.langLabel} value={lang} onchange={(e) => setLang(e.currentTarget.value as Lang)}>
				{#each LANGS as l (l.code)}<option value={l.code}>{l.code.toUpperCase()} · {l.name}</option>{/each}
			</select>
		</div>
	</header>

	{#if phase === 'loading'}
		<div class="loader" role="status">
			<p>{t.loading} <b>(4 B)</b>…</p>
			<div class="bar"><div style:width="{loadPct}%"></div></div>
			<p class="mono">{t.loadSub(loadPct / 25)}</p>
		</div>
	{/if}

	<section class="result" aria-live="polite">
		{#if legendary}
		<div class="legendary" role="status"><b>★ {t.legendary} ★</b><span>{t.legendarySub}</span></div>
	{/if}
		{#if holding}
			<h1 class="think charge" class:over={charge > 1}>{charge > 1 ? '⚡' : t.charging}</h1>
		{:else if phase === 'done' && last}
			<h1 class="pop" class:edge={last.result === 'dik'}>{label(last.result)}{#if asked}<span class="arrow">→ {answer(last.result)}</span>{/if}</h1>
			{#if oracle}<p class="oracle" aria-live="polite" aria-busy={streaming}>{oracleShown}{#if streaming}<span class="cursor" aria-hidden="true">▍</span>{/if}</p>{/if}
			<p>{t.confidence}: <b>{pct.format(last.confidence)}</b> <span class="conf"><span style:width="{last.confidence * 100}%"></span></span></p>
			<button type="button" class="copy" onclick={copyVerdict} aria-live="polite">
				{#if copyFeedback === 'ok'}{t.copied}{:else if copyFeedback === 'fail'}{t.copyFail}{:else}{t.copy}{/if}
			</button>
		{:else if phase === 'thinking'}
			<h1 class="think">{t.thinking}<span>.</span><span>.</span><span>.</span></h1>
		{:else if phase === 'flipping'}
			<h1 class="think">{t.inferring}</h1>
		{/if}
	</section>

	<div class="panel">
		<div class="stats mono">
			<div><small>{t.stats[0]}</small><b>{last ? last.tps.toLocaleString(lang) : '—'}</b></div>
			<div><small>{t.stats[1]}</small><b>{last ? num(last.ms) + ' ms' : '—'}</b></div>
			{#if revealed}
				<div><small>{t.tally}</small><b>{count('yazi')} / {count('tura')} / {count('dik')}</b></div>
				<div><small>trit</small><b>{last ? (last.trit > 0 ? '+1' : last.trit) : '—'}</b></div>
			{:else}
				<div><small>{t.stats[2]}</small><b>{count('yazi')} / {count('tura')}</b></div>
				<div><small>{t.stats[3]}</small><b>{last ? num(last.z * SCALE, 2) : '—'}</b></div>
			{/if}
		</div>
		<p class="engine mono" title="onnxruntime-web">{t.engineLabel}: {engineName(engine)}</p>
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
			<span class="lbl">
			{#if phase === 'loading'}{t.loadingBtn}{:else if busy}{t.busyBtn}{:else if holding}{charge > 1 ? '⚡ ' + t.overcharge.split('!')[0] + '!' : t.charging + ' ' + Math.round(Math.min(charge, 1) * 100) + '%'}{:else if question.trim()}{t.ask}{:else}{t.flip}{/if}</span>
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
	.brand { font-weight: 800; letter-spacing: 0.02em; display: flex; align-items: center; gap: 8px; }
	.brand small { opacity: 0.5; font-weight: 500; }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: #f5a524; box-shadow: 0 0 10px #f5a524; }
	.dot.live { background: #36e27e; box-shadow: 0 0 12px #36e27e; animation: pulse 2s infinite; }
	.right { display: flex; gap: 8px; align-items: center; }
	.badges { display: flex; gap: 6px; }
	.lang { font: inherit; font-size: 12px; color: #eae6da; background: #14141f; border: 1px solid #ffffff2a; border-radius: 99px; padding: 5px 8px; cursor: pointer; }
	.badges span { font-size: 11px; padding: 4px 8px; border-radius: 99px; background: #ffffff10; border: 1px solid #ffffff22; backdrop-filter: blur(8px); }
	.loader { position: fixed; inset: 0; display: grid; place-content: center; text-align: center; background: radial-gradient(#0d0d18, #07070c); z-index: 3; }
	.bar { width: min(320px, 80vw); height: 6px; background: #ffffff15; border-radius: 9px; overflow: hidden; margin: 6px auto; }
	.bar div { height: 100%; background: linear-gradient(90deg, #ffcf5a, #ff8a3d); transition: width 0.25s; box-shadow: 0 0 12px #ffb340; }
	.loader .mono { font-size: 12px; opacity: 0.6; }
	.result { align-self: start; text-align: center; margin-top: 4vh; min-height: 120px; }
	h1 { margin: 0; font-size: clamp(48px, 12vw, 108px); font-family: Georgia, serif; letter-spacing: 0.04em; background: linear-gradient(180deg, #fff3c4, #e0a33a 60%, #8a5a14); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 24px #ffb34055); }
	h1.think { font-size: clamp(26px, 6vw, 44px); }
	.think span { animation: blink 1s infinite; } .think span:nth-child(2) { animation-delay: 0.2s; } .think span:nth-child(3) { animation-delay: 0.4s; }
	.pop { animation: pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1); }
	.conf { display: inline-block; width: 120px; height: 6px; background: #ffffff18; border-radius: 9px; vertical-align: middle; overflow: hidden; }
	.conf span { display: block; height: 100%; background: #36e27e; transition: width 0.6s; }
	.panel { justify-self: center; width: min(560px, 100%); box-sizing: border-box; background: #0c0c16b3; border: 1px solid #ffffff1a; border-radius: 18px; padding: 14px; backdrop-filter: blur(14px); box-shadow: 0 20px 60px #0008; }
	.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
	.stats small { display: block; font-size: 10px; opacity: 0.55; text-transform: uppercase; }
	.engine { margin: 6px 0 0; text-align: center; font-size: 10px; letter-spacing: 0.04em; opacity: 0.5; }
	.stats b { font-size: 14px; }
	.log { font-size: 11px; opacity: 0.7; margin: 10px 0; min-height: 3.6em; line-height: 1.2em; }
	.log div:last-child { color: #ffd36b; }
	button.hold { width: 100%; padding: 16px; font-size: 18px; font-weight: 800; border: 0; border-radius: 14px; cursor: pointer; color: #1a1205; background: linear-gradient(180deg, #ffe08a, #e9a23b); box-shadow: 0 8px 30px #ffae3a55, inset 0 1px 0 #fff8; transition: transform 0.15s, filter 0.2s; }
	button.hold:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
	button.hold:active:not(:disabled) { transform: translateY(1px) scale(0.99); }
	button.hold:disabled { filter: grayscale(0.6) brightness(0.7); cursor: progress; }
	.copy { margin-top: 10px; padding: 6px 14px; font: inherit; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: #eae6da; background: #ffffff12; border: 1px solid #ffffff2a; border-radius: 99px; cursor: pointer; backdrop-filter: blur(8px); transition: background 0.2s, border-color 0.2s, color 0.2s; }
	.copy:hover { background: #ffffff1e; border-color: #ffc95a66; color: #ffe08a; }
	.copy:active { transform: scale(0.97); }
	.arrow { margin-left: 0.35em; font-size: 0.55em; -webkit-text-fill-color: #36e27e; color: #36e27e; filter: drop-shadow(0 0 14px #36e27e66); }
	.cursor { display: inline-block; margin-left: 1px; font-style: normal; animation: blink 0.8s steps(1) infinite; }
	@keyframes blink { 50% { opacity: 0; } }
	@media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
	.oracle { max-width: 640px; margin: 4px auto 8px; padding: 0 12px; font-style: italic; font-size: clamp(14px, 3.6vw, 18px); opacity: 0.9; animation: fadeup 0.7s 0.2s both; }
	.sota { background: #36e27e22 !important; border-color: #36e27e66 !important; color: #8ff5b7; }
	.ask { margin-bottom: 10px; }
	.pitch { font-size: 11px; opacity: 0.65; margin: 0 0 6px; text-align: center; }
	.ask input { width: 100%; box-sizing: border-box; padding: 13px 14px; font-size: 16px; color: #fff; background: #ffffff0d; border: 1px solid #ffffff26; border-radius: 12px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
	.ask input:focus { border-color: #ffc95a; box-shadow: 0 0 0 3px #ffc95a33; }
	@keyframes fadeup { from { opacity: 0; transform: translateY(8px); } }
	h1.edge { background: linear-gradient(180deg, #fff6d8, #ffb347 55%, #b0561c); -webkit-background-clip: text; background-clip: text; }
	.legendary { display: inline-block; margin: 0 auto 10px; z-index: 2; text-align: center; padding: 8px 18px; border-radius: 99px; background: linear-gradient(90deg, #3a1d05ee, #6b3a0cee, #3a1d05ee); border: 1px solid #ffc36b; box-shadow: 0 0 40px #ff9a3a66; animation: legend 0.9s cubic-bezier(0.2, 1.6, 0.4, 1), shimmer 2s ease-in-out infinite 0.9s; white-space: nowrap; }
	.legendary b { display: block; letter-spacing: 0.3em; color: #ffd27a; font-size: 18px; }
	.legendary span { font-size: 12px; opacity: 0.85; }
	@keyframes legend { from { transform: scale(0.2) rotate(-8deg); opacity: 0; } }
	@keyframes shimmer { 50% { box-shadow: 0 0 70px #ffb34fa0; } }
	.hold { position: relative; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
	.hold .lbl { position: relative; z-index: 1; }
	.hold .meter { position: absolute; inset: 0; transform-origin: left; transform: scaleX(var(--charge, 0)); background: linear-gradient(90deg, #ffb347, #ff6a1a 70%, #ff3d00); opacity: 0.85; }
	.hold.holding { animation: tremble 0.08s infinite; box-shadow: 0 0 calc(20px + var(--charge) * 50px) #ff8a2a99, inset 0 1px 0 #fff8; }
	.hold.over { animation: tremble 0.04s infinite; filter: saturate(1.4); }
	h1.charge { transform: scale(calc(0.9 + var(--c, 0) * 0.2)); }
	.hint { margin: 6px 0 0; text-align: center; font-size: 11px; opacity: 0.55; }
	@keyframes tremble { 25% { transform: translate(1px, -1px); } 75% { transform: translate(-1px, 1px); } }
	details { margin-top: 10px; font-size: 13px; } summary { cursor: pointer; opacity: 0.8; }
	details ul { padding-left: 18px; margin: 8px 0 0; line-height: 1.5; opacity: 0.85; }
	.warn { color: #ff8a8a; font-size: 12px; }
	@media (max-width: 480px) { .stats { grid-template-columns: repeat(2, 1fr); } .badges { display: none; } }
	@keyframes pulse { 50% { opacity: 0.5; } }
	@keyframes blink { 50% { opacity: 0.1; } }
	@keyframes pop { from { transform: scale(0.4); opacity: 0; } }
	.reduced *, .reduced { animation: none !important; transition: none !important; }
</style>
