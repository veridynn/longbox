<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		actions?: Snippet;
		children: Snippet;
		title: string;
	};

	let { actions, children, title }: Props = $props();
	const headingId = $derived(`${title.toLowerCase().replaceAll(' ', '-')}-heading`);
</script>

<section aria-labelledby={headingId} class="grid gap-3">
	<div class="flex items-center justify-between gap-3">
		<h2 id={headingId} class="font-semibold">{title}</h2>
		{#if actions}
			{@render actions()}
		{/if}
	</div>

	{@render children()}
</section>
