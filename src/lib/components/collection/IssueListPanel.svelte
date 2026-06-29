<script module lang="ts">
	export type IssueListViewMode = 'gallery' | 'list';
</script>

<script lang="ts">
	import type { DragDropState } from '@thisux/sveltednd';
	import { draggable, droppable } from '@thisux/sveltednd';
	import { Grid2x2, List, LoaderCircle, Trash2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import { flushSync } from 'svelte';
	import { formatDate } from '$lib/comics/format';
	import type { CollectionIssue, CollectionItem } from '$lib/comics/types';
	import {
		isActiveIssueTransition,
		issueViewTransitionName,
		primeIssueTransition
	} from '$lib/comics/view-transitions.svelte.ts';
	import SortableListIssueRow from './SortableListIssueRow.svelte';

	type Props = {
		controls?: Snippet;
		empty?: Snippet;
		errorMessage?: string | null;
		isLoading?: boolean;
		items: CollectionItem[];
		onRemoveListItem?: (itemId: string) => void | Promise<void>;
		onReorderItems?: (items: CollectionItem[]) => void | Promise<void>;
		onViewModeChange: (viewMode: IssueListViewMode) => void;
		removingItemIds?: string[];
		viewMode: IssueListViewMode;
	};

	let {
		controls,
		empty,
		errorMessage = null,
		isLoading = false,
		items,
		onRemoveListItem,
		onReorderItems,
		onViewModeChange,
		removingItemIds = [],
		viewMode
	}: Props = $props();

	function modeButtonClass(mode: IssueListViewMode) {
		return `inline-flex size-9 items-center justify-center rounded-md text-sm transition hover:bg-muted ${
			viewMode === mode ? 'bg-muted text-foreground' : 'text-muted-foreground'
		}`;
	}

	function issueTitle(item: CollectionItem) {
		const issue = item.userIssue?.issue;
		if (!issue) return 'Unknown issue';

		const issueName = issue.name ? `: ${issue.name}` : '';
		return `${issue.volume?.name ?? 'Unknown volume'} #${issue.issueNumber}${issueName}`;
	}

	function hasSameOrder(firstItems: CollectionItem[], secondItems: CollectionItem[]) {
		return (
			firstItems.length === secondItems.length &&
			firstItems.every((item, index) => item.id === secondItems[index]?.id)
		);
	}

	function reorderedItemsForDrop(state: DragDropState<CollectionItem>) {
		const sourceId = state.draggedItem?.id;
		const targetIndex = Number(state.targetContainer);
		if (!sourceId || !Number.isInteger(targetIndex)) return items;

		const targetId = items[targetIndex]?.id;
		if (!targetId || sourceId === targetId) return items;

		const sourceIndex = items.findIndex((item) => item.id === sourceId);
		const nextTargetIndex = items.findIndex((item) => item.id === targetId);
		if (sourceIndex === -1 || nextTargetIndex === -1) return items;

		const reorderedItems = [...items];
		const [movedItem] = reorderedItems.splice(sourceIndex, 1);
		reorderedItems.splice(nextTargetIndex, 0, movedItem);
		return reorderedItems;
	}

	async function handleDrop(state: DragDropState<CollectionItem>) {
		if (!onReorderItems) return;

		const orderedItems = reorderedItemsForDrop(state);
		if (hasSameOrder(items, orderedItems)) return;

		await onReorderItems(orderedItems);
	}

	function prepareIssueTransition(issue: CollectionIssue, listPosition?: number) {
		flushSync(() => primeIssueTransition(issue, { listPosition }));
	}
</script>

<section>
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<div class="flex items-center gap-1" aria-label="View mode">
			<button
				type="button"
				class={modeButtonClass('gallery')}
				aria-label="Gallery view"
				aria-pressed={viewMode === 'gallery'}
				onclick={() => onViewModeChange('gallery')}
			>
				<Grid2x2 class="size-4" />
			</button>
			<button
				type="button"
				class={modeButtonClass('list')}
				aria-label="List view"
				aria-pressed={viewMode === 'list'}
				onclick={() => onViewModeChange('list')}
			>
				<List class="size-4" />
			</button>
		</div>

		{#if controls}
			{@render controls()}
		{/if}
	</div>

	{#if isLoading}
		<div class="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
			<LoaderCircle class="mr-2 size-4 animate-spin" />
			Loading issues
		</div>
	{:else if errorMessage}
		<p class="px-4 py-6 text-sm text-destructive">{errorMessage}</p>
	{:else if !items.length && empty}
		{@render empty()}
	{:else if viewMode === 'gallery'}
		<ul class="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-3 md:grid-cols-4">
			{#each items as item (item.id)}
				{@const issue = item.userIssue?.issue}
				{#if issue}
					<li class="group relative">
						<a
							class="block overflow-hidden bg-muted text-foreground shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							href={`/issues/${issue.id}`}
							onpointerdown={() => prepareIssueTransition(issue, item.position)}
							onclick={() => prepareIssueTransition(issue, item.position)}
						>
							<img
								class="aspect-[2/3] w-full border border-border object-cover"
								src={issue.coverImageUrl ?? '/robots.txt'}
								alt=""
								style:view-transition-name={isActiveIssueTransition(issue.id)
									? issueViewTransitionName(issue.id, 'cover')
									: null}
								style:view-transition-class={isActiveIssueTransition(issue.id) ? 'issue-cover' : null}
							/>
							<div
								class="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 via-background/70 to-transparent p-3 pt-10"
							>
								<h3
									class="line-clamp-2 text-sm font-semibold"
									style:view-transition-name={isActiveIssueTransition(issue.id)
										? issueViewTransitionName(issue.id, 'title')
										: null}
								>
									{issueTitle(item)}
								</h3>
								<p class="mt-1 line-clamp-1 text-xs text-muted-foreground">
									{issue.volume?.publisher?.name ?? 'Unknown publisher'} · {formatDate(issue.coverDate)}
								</p>
							</div>
						</a>

						{#if onRemoveListItem}
							<button
								type="button"
								class="absolute right-2 top-2 inline-flex size-8 items-center justify-center bg-background/90 text-destructive opacity-0 shadow-sm transition hover:bg-destructive/10 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
								aria-label={`Remove ${issueTitle(item)}`}
								disabled={removingItemIds.includes(item.id)}
								onclick={() => void onRemoveListItem(item.id)}
							>
								<Trash2 class="size-4" />
							</button>
						{/if}
					</li>
				{/if}
			{/each}
		</ul>
	{:else}
		<ul class="divide-y divide-border">
			{#each items as item, index (item.id)}
				<li
					use:draggable={{
						container: 'issue-list-panel',
						dragData: item,
						handle: '[data-list-drag-handle]',
						attributes: { draggingClass: 'opacity-80' }
					}}
					use:droppable={{
						container: String(index),
						direction: 'vertical',
						callbacks: { onDrop: handleDrop },
						attributes: {
							dragOverClass: onReorderItems
								? 'outline outline-2 outline-dashed outline-primary/60 outline-offset-[-2px]'
								: ''
						}
					}}
					animate:flip={{ duration: 160 }}
					class={`grid gap-4 bg-background transition ${
						onReorderItems
							? 'sm:grid-cols-[auto_6rem_minmax(0,1fr)_auto]'
							: 'px-4 sm:grid-cols-[6rem_minmax(0,1fr)]'
					}`}
				>
					<SortableListIssueRow
						canReorder={Boolean(onReorderItems)}
						{item}
						{onRemoveListItem}
						{removingItemIds}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	:global(.drop-before)::before,
	:global(.drop-after)::after,
	:global(.drop-left)::before,
	:global(.drop-right)::after {
		display: none !important;
	}
</style>
