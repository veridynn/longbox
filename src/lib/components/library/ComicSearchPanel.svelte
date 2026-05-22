<script lang="ts">
	import { tick } from 'svelte';
	import { Check, LoaderCircle, Plus, Search } from '@lucide/svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import { formatDate, issueTitle } from '$lib/comics/format';
	import type { SearchIssue } from '$lib/comics/types';

	type Props = {
		addError: string | null;
		addingIssueIds: number[];
		isInLibrary: (issue: SearchIssue) => boolean;
		isSearching: boolean;
		onAddIssue: (issue: SearchIssue) => void;
		onSearch: () => void;
		open: boolean;
		query: string;
		resultLimit: number;
		results: SearchIssue[];
		searchError: string | null;
	};

	let {
		addError,
		addingIssueIds,
		isInLibrary,
		isSearching,
		onAddIssue,
		onSearch,
		open = $bindable(),
		query = $bindable(),
		resultLimit,
		results,
		searchError
	}: Props = $props();

	let searchInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (open) {
			tick().then(() => searchInput?.focus());
		}
	});

	function handleSearchSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSearch();
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault();
			onSearch();
		}
	}
</script>

<Command.Dialog
	bind:open
	class="top-20 max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-2xl translate-y-0"
	description="Search ComicVine issues and add them to your library."
	title="Search ComicVine"
>
	<form class="border-b border-border p-2" onsubmit={handleSearchSubmit}>
		<label class="sr-only" for="comic-search-command">Search comics</label>
		<div class="relative">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				id="comic-search-command"
				bind:this={searchInput}
				bind:value={query}
				class="h-10 w-full rounded-md border border-input bg-input/30 pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
				placeholder="Search issues, volumes, or titles"
				onkeydown={handleSearchKeydown}
			/>
		</div>
		<div class="flex items-center justify-between gap-3 px-2 pt-2 pb-1">
			<p class="text-xs text-muted-foreground">Press Enter to search ComicVine</p>
			<button
				type="submit"
				class="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
				disabled={isSearching}
			>
				{#if isSearching}
					<LoaderCircle class="size-3.5 animate-spin" />
				{:else}
					<Search class="size-3.5" />
				{/if}
				Search
			</button>
		</div>
	</form>

	{#if searchError}
		<p class="mx-3 mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{searchError}
		</p>
	{/if}

	{#if addError}
		<p class="mx-3 mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{addError}
		</p>
	{/if}

	<div class="px-3 pt-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold">ComicVine results</h2>
			{#if results.length}
				<p class="text-xs text-muted-foreground">Showing up to {resultLimit} matches</p>
			{/if}
		</div>
	</div>

	<Command.List class="max-h-[min(28rem,calc(100dvh-16rem))]">
		{#if results.length}
			<ul class="divide-y divide-border">
				{#each results as issue (issue.id)}
					<li class="flex gap-3 px-3 py-3">
						<img
							class="h-28 w-20 shrink-0 rounded-md border border-border object-cover"
							src={issue.coverImageUrl ?? '/robots.txt'}
							alt=""
						/>
						<div class="min-w-0 flex-1">
							<h3 class="line-clamp-2 text-sm font-semibold">{issueTitle(issue)}</h3>
							<p class="mt-1 text-xs text-muted-foreground">
								{formatDate(issue.coverDate)}
							</p>
							{#if issue.siteDetailUrl}
								<a
									class="mt-2 inline-block text-xs font-medium text-foreground underline-offset-4 hover:underline"
									href={issue.siteDetailUrl}
									target="_blank"
									rel="noreferrer"
								>
									View on ComicVine
								</a>
							{/if}
						</div>
						<button
							type="button"
							class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
							aria-label={isInLibrary(issue)
								? `${issueTitle(issue)} is already in Library`
								: `Add ${issueTitle(issue)} to Library`}
							disabled={addingIssueIds.includes(issue.id) || isInLibrary(issue)}
							onclick={() => onAddIssue(issue)}
						>
							{#if addingIssueIds.includes(issue.id)}
								<LoaderCircle class="size-4 animate-spin" />
							{:else if isInLibrary(issue)}
								<Check class="size-4" />
								Owned
							{:else}
								<Plus class="size-4" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-4 py-12 text-center text-sm text-muted-foreground">
				Search for an exact issue to add it to your Library.
			</p>
		{/if}
	</Command.List>
</Command.Dialog>
