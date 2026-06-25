<script lang="ts">
	import { GripVertical, LoaderCircle, Trash2 } from '@lucide/svelte';
	import { formatDate } from '$lib/comics/format';
	import type { LibraryItem } from '$lib/comics/types';
	import { issueViewTransitionName } from '$lib/comics/view-transitions.svelte.ts';

	type Props = {
		item: LibraryItem;
		onRemoveListItem: (itemId: string) => void | Promise<void>;
		removingItemIds?: string[];
	};

	let { item, onRemoveListItem, removingItemIds = [] }: Props = $props();

	let issue = $derived(item.userIssue?.issue);

	function issueTitle(item: LibraryItem) {
		const issue = item.userIssue?.issue;
		if (!issue) return 'Unknown issue';

		const issueName = issue.name ? `: ${issue.name}` : '';
		return `${issue.volume?.name ?? 'Unknown volume'} #${issue.issueNumber}${issueName}`;
	}
</script>

{#if issue}
	<button
		type="button"
		class="flex touch-none cursor-grab items-center self-stretch px-2 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
		aria-label={`Drag ${issueTitle(item)}`}
		data-list-drag-handle={item.id}
	>
		<GripVertical class="size-4" />
	</button>

	<img
		class="my-4 h-36 w-24 border border-border object-cover"
		src={issue.coverImageUrl ?? '/robots.txt'}
		alt=""
		style:view-transition-name={issueViewTransitionName(issue.id, 'cover')}
	/>

	<div class="my-4 min-w-0">
		<h3
			class="text-base font-semibold"
			style:view-transition-name={issueViewTransitionName(issue.id, 'title')}
		>
			<a class="underline-offset-4 hover:underline" href={`/issues/${issue.id}`}>
				{issueTitle(item)}
			</a>
		</h3>
		<p class="mt-1 text-sm text-muted-foreground">
			{issue.volume?.publisher?.name ?? 'Unknown publisher'} · {formatDate(issue.coverDate)}
		</p>
		{#if issue.summary}
			<p class="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
				{issue.summary}
			</p>
		{/if}
	</div>

	<button
		type="button"
		class="my-4 inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-md px-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-70"
		disabled={removingItemIds.includes(item.id)}
		onclick={() => void onRemoveListItem(item.id)}
	>
		{#if removingItemIds.includes(item.id)}
			<LoaderCircle class="size-4 animate-spin" />
		{:else}
			<Trash2 class="size-4" />
		{/if}
		Remove
	</button>
{/if}
