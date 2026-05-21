<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';
	import { characterNames, formatDate, groupedCredits } from '$lib/comics/format';
	import type { LibraryItem } from '$lib/comics/types';

	type Props = {
		errorMessage: string | null;
		isLoading: boolean;
		items: LibraryItem[];
	};

	let { errorMessage, isLoading, items }: Props = $props();
</script>

<section class="overflow-hidden rounded-lg border border-border bg-card">
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<h2 class="font-semibold">Library</h2>
		<span class="text-sm text-muted-foreground">{items.length} issues</span>
	</div>

	{#if isLoading}
		<div class="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
			<LoaderCircle class="mr-2 size-4 animate-spin" />
			Loading issues
		</div>
	{:else if errorMessage}
		<p class="px-4 py-6 text-sm text-destructive">{errorMessage}</p>
	{:else if items.length}
		<ul class="divide-y divide-border">
			{#each items as item (item.id)}
				{@const issue = item.userIssue?.issue}
				{#if issue}
					<li class="grid gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
						<img
							class="h-36 w-24 rounded-md border border-border object-cover"
							src={issue.coverImageUrl ?? '/robots.txt'}
							alt=""
						/>
						<div class="min-w-0">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h3 class="text-base font-semibold">
										{issue.volume?.name ?? 'Unknown volume'} #{issue.issueNumber}{issue.name
											? `: ${issue.name}`
											: ''}
									</h3>
									<p class="mt-1 text-sm text-muted-foreground">
										{issue.volume?.publisher?.name ?? 'Unknown publisher'} · {formatDate(
											issue.coverDate
										)}
									</p>
								</div>
							</div>

							{#if issue.summary}
								<p class="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
									{issue.summary}
								</p>
							{/if}

							<div class="mt-4 grid gap-3 md:grid-cols-2">
								<div>
									<p class="text-xs font-semibold text-muted-foreground uppercase">Characters</p>
									<p class="mt-1 text-sm leading-6">
										{characterNames(item).join(', ') || 'No character credits'}
									</p>
								</div>
								<div>
									<p class="text-xs font-semibold text-muted-foreground uppercase">Credits</p>
									<ul class="mt-1 space-y-1 text-sm leading-6">
										{#each groupedCredits(item) as credit (credit)}
											<li>{credit}</li>
										{:else}
											<li>No creator credits</li>
										{/each}
									</ul>
								</div>
							</div>
						</div>
					</li>
				{/if}
			{/each}
		</ul>
	{:else}
		<p class="px-4 py-12 text-center text-sm text-muted-foreground">
			Added ComicVine issues will appear here with publisher, volume, characters, and credits.
		</p>
	{/if}
</section>
