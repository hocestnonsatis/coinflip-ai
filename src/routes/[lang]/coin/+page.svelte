<script lang="ts">
	import App from '../../../lib/CoinApp.svelte';
	let { data } = $props();
</script>

<App {data} />
