<script lang="ts">
	// 🔊/🔇 switch for the game HUDs; M toggles too. The choice is remembered (localStorage) across games and visits.
	import { onMount } from 'svelte';
	import { isMuted, toggleMuted, onMuted, installUnlock } from '#lib/sound';
	import { SOUND } from '#lib/i18n-sound';
	import type { Lang } from '#lib/i18n';
	let { lang }: { lang: Lang } = $props();
	let muted = $state(false);
	const label = $derived(muted ? SOUND[lang].unmute : SOUND[lang].mute);
	onMount(() => { muted = isMuted(); installUnlock(); return onMuted((m) => (muted = m)); });
	function onKey(e: KeyboardEvent) {
		if (e.key !== 'm' && e.key !== 'M') return;
		if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
		const el = e.target as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
		toggleMuted();
	}
</script>

<svelte:window onkeydown={onKey} />
<button type="button" class="snd" aria-label={label} title={label} aria-pressed={muted} data-muted={muted ? '1' : '0'}
	onclick={(e) => { toggleMuted(); (e.currentTarget as HTMLButtonElement).blur(); }}>{muted ? '🔇' : '🔊'}</button>

<style>
	.snd { font: inherit; font-size: 14px; line-height: 1; color: #eae6da; background: #14141f; border: 1px solid #ffffff2a; border-radius: 99px; padding: 5px 9px; cursor: pointer; }
	.snd:hover { border-color: #ffffff55; }
	.snd:focus-visible { outline: 2px solid #ffcf5a; outline-offset: 2px; }
</style>
