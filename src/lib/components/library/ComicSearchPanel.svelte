<script lang="ts">
	import { Check, LoaderCircle, Plus, Search } from '@lucide/svelte';
	import { formatDate, issueTitle } from '$lib/comics/format';
	import type { SearchIssue } from '$lib/comics/types';

	type Props = {
		addError: string | null;
		addingIssueIds: number[];
		isInLibrary: (issue: SearchIssue) => boolean;
		isSearching: boolean;
		onAddIssue: (issue: SearchIssue) => void;
		onSearch: () => void;
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
		query = $bindable(),
		resultLimit,
		results,
		searchError
	}: Props = $props();
</script>

<section class="flex flex-col gap-4">
	<form class="flex gap-2" onsubmit={(event) => (event.preventDefault(), onSearch())}>
		<label class="sr-only" for="comic-search">Search comics</label>
		<div class="relative flex-1">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				id="comic-search"
				bind:value={query}
				class="h-11 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
				placeholder="Search issues, volumes, or titles"
			/>
		</div>
		<button
			type="submit"
			class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
			disabled={isSearching}
		>
			{#if isSearching}
				<LoaderCircle class="size-4 animate-spin" />
			{:else}
				<Search class="size-4" />
			{/if}
			Search
		</button>
	</form>

	{#if searchError}
		<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{searchError}
		</p>
	{/if}

	{#if addError}
		<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{addError}
		</p>
	{/if}

	<div class="overflow-hidden rounded-lg border border-border bg-card">
		<div class="border-b border-border px-4 py-3">
			<h2 class="font-semibold">ComicVine results</h2>
			{#if results.length}
				<p class="mt-1 text-xs text-muted-foreground">Showing up to {resultLimit} matches</p>
			{/if}
		</div>

		{#if results.length}
			<ul class="divide-y divide-border">
				{#each results as issue (issue.id)}
					<li class="flex gap-3 p-3">
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
	</div>
</section>
