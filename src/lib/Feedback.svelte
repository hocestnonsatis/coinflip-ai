<script lang="ts">
	import type { Lang } from '#lib/i18n';
	import { FEEDBACK, feedbackLine, type Vote } from '#lib/i18n-feedback';

	let { lang }: { lang: Lang } = $props();
	const f = $derived(FEEDBACK[lang]);
	let vote = $state<Vote | null>(null);
	let idx = $state(0);
	const stop = (e: KeyboardEvent) => e.stopPropagation();
	function rate(v: Vote) {
		if (vote === v) return;
		vote = v;
		idx = Math.floor(Math.random() * f[v].length);
	}
</script>

<!-- keep Space/Enter on these buttons from triggering the page-wide hold-to-flip shortcut -->
<span class="fb" role="group" aria-label={f.label}>
	<button type="button" class:on={vote === 'up'} aria-pressed={vote === 'up'} aria-label={f.good} title={f.good} onkeydown={stop} onkeyup={stop} onclick={() => rate('up')}>👍</button>
	<button type="button" class:on={vote === 'down'} aria-pressed={vote === 'down'} aria-label={f.bad} title={f.bad} onkeydown={stop} onkeyup={stop} onclick={() => rate('down')}>👎</button>
</span>
<p class="fbmsg" role="status">{vote ? feedbackLine(lang, vote, idx) : ''}</p>

<style>
	.fb { display: inline-flex; gap: 4px; margin: 10px 0 0 6px; vertical-align: top; }
	.fb button { padding: 5px 9px; font-size: 13px; line-height: 1; color: inherit; background: #ffffff12; border: 1px solid #ffffff2a; border-radius: 99px; cursor: pointer; backdrop-filter: blur(8px); filter: grayscale(0.6); transition: background 0.2s, border-color 0.2s, filter 0.2s; }
	.fb button:hover { background: #ffffff1e; border-color: #ffc95a66; filter: none; }
	.fb button.on { background: #36e27e22; border-color: #36e27e88; filter: none; }
	.fbmsg { min-height: 1.3em; margin: 6px auto 0; max-width: 520px; padding: 0 12px; font-size: 12px; font-style: italic; opacity: 0.8; text-shadow: 0 1px 6px #000c; }
	.fbmsg:empty { min-height: 0; margin: 0; }
</style>
