<script lang="ts">
	import { onMount } from 'svelte';
	import { BookOpen, LogOut, Search } from '@lucide/svelte';

	type Props = {
		onOpenSearch: () => void;
		signedIn: boolean;
		onSignOut: () => void;
	};

	let { onOpenSearch, signedIn, onSignOut }: Props = $props();
	let shortcutModifier = $state('⌘');

	onMount(() => {
		if (!/(Mac|iPhone|iPad|iPod)/.test(navigator.platform)) {
			shortcutModifier = 'Ctrl';
		}
	});
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
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
				aria-label="Open comic search"
				onclick={onOpenSearch}
			>
				<Search class="size-4" />
				<span>Search</span>
				<span class="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
					<kbd
						class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium"
					>
						{shortcutModifier}
					</kbd>
					<kbd
						class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium"
					>
						K
					</kbd>
				</span>
			</button>
			<button
				type="button"
				class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
				onclick={onSignOut}
			>
				<LogOut class="size-4" />
				Sign out
			</button>
		</div>
	{/if}
</header>
