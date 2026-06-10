<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';
	import { flushSync } from 'svelte';
	import { characterNames, formatDate, groupedCredits } from '$lib/comics/format';
	import type { LibraryIssue, LibraryItem } from '$lib/comics/types';
	import {
		getIssueTransitionPreview,
		isActiveIssueTransition,
		issueTransition,
		issueViewTransitionName,
		primeIssueTransition
	} from '$lib/comics/view-transitions.svelte';

	type Props = {
		errorMessage: string | null;
		isLoading: boolean;
		items: LibraryItem[];
	};

	let { errorMessage, isLoading, items }: Props = $props();
	const transitionPreview = $derived(
		issueTransition.direction === 'issue-back' && issueTransition.issueId
			? getIssueTransitionPreview(issueTransition.issueId)
			: null
	);
	const visibleItems = $derived(
		transitionPreview
			? items.filter((item) => item.userIssue?.issue?.id !== transitionPreview.issueId)
			: items
	);
	const visibleIssueCount = $derived(
		visibleItems.length + (transitionPreview ? 1 : 0)
	);

	function prepareIssueTransition(issue: LibraryIssue, listPosition?: number) {
		flushSync(() => primeIssueTransition(issue, { listPosition }));
	}
</script>

<section class="overflow-hidden rounded-lg border border-border bg-card">
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<h2 class="font-semibold">Library</h2>
		<span class="text-sm text-muted-foreground">{visibleIssueCount} issues</span>
	</div>

	{#if isLoading && !transitionPreview}
		<div class="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
			<LoaderCircle class="mr-2 size-4 animate-spin" />
			Loading issues
		</div>
	{:else if errorMessage}
		<p class="px-4 py-6 text-sm text-destructive">{errorMessage}</p>
	{:else if items.length || transitionPreview}
		<ul class="flex flex-col divide-y divide-border">
			{#if transitionPreview}
				<li style:order={transitionPreview.listPosition ?? -1}>
					<div
						class="grid gap-4 p-4 text-foreground sm:grid-cols-[6rem_minmax(0,1fr)]"
						aria-hidden="true"
					>
						<img
							class="h-36 w-24 rounded-md border border-border object-cover"
							src={transitionPreview.coverImageUrl ?? '/robots.txt'}
							alt=""
							style:view-transition-name={issueViewTransitionName(
								transitionPreview.issueId,
								'cover'
							)}
							style:view-transition-class="issue-cover"
						/>
						<div class="min-w-0">
							<h3 class="text-base font-semibold">{transitionPreview.title}</h3>
							<p class="mt-1 text-sm text-muted-foreground">Loading library position</p>
						</div>
					</div>
				</li>
			{/if}
			{#each visibleItems as item (item.id)}
				{@const issue = item.userIssue?.issue}
				{#if issue}
					<li style:order={item.position}>
						<a
							class="group grid gap-4 p-4 text-foreground no-underline transition-colors hover:bg-muted/40 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[6rem_minmax(0,1fr)]"
							href={`/issues/${issue.id}`}
							onpointerdown={() => prepareIssueTransition(issue, item.position)}
							onclick={() => prepareIssueTransition(issue, item.position)}
						>
							<img
								class="h-36 w-24 rounded-md border border-border object-cover"
								src={issue.coverImageUrl ?? '/robots.txt'}
								alt=""
								style:view-transition-name={isActiveIssueTransition(issue.id)
									? issueViewTransitionName(issue.id, 'cover')
									: null}
								style:view-transition-class={isActiveIssueTransition(issue.id) ? 'issue-cover' : null}
							/>
							<div class="min-w-0">
								<div class="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h3 class="text-base font-semibold underline-offset-4 group-hover:underline">
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
						</a>
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
