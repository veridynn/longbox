<script lang="ts">
	import { BookOpen, LogOut } from '@lucide/svelte';

	type Props = {
		signedIn: boolean;
		onSignOut: () => void;
	};

	let { signedIn, onSignOut }: Props = $props();
</script>

<header
	class="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-center md:justify-between"
>
	<div class="flex items-center gap-3">
		<div class="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
			<BookOpen class="size-5" />
		</div>
		<div>
			<h1 class="text-2xl font-semibold tracking-normal">Longbox</h1>
			<p class="text-sm text-muted-foreground">Search ComicVine and build your Library.</p>
		</div>
	</div>

	{#if signedIn}
		<button
			type="button"
			class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
			onclick={onSignOut}
		>
			<LogOut class="size-4" />
			Sign out
		</button>
	{/if}
</header>
