<script lang="ts">
	import type { DragDropState } from '@thisux/sveltednd';
	import { draggable, droppable } from '@thisux/sveltednd';
	import {
		BookOpen,
		BookOpenCheck,
		Grid2x2,
		GripVertical,
		Heart,
		List,
		LoaderCircle,
		Package,
		PackageCheck,
		Star,
		Trash2
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { flushSync } from 'svelte';
	import { formatDate } from '$lib/comics/format';
	import type { CollectionIssue, CollectionItem, UserIssuePatch } from '$lib/comics/types';
	import {
		isActiveIssueTransition,
		issueViewTransitionName,
		primeIssueTransition
	} from '$lib/comics/view-transitions.svelte.ts';
	import type { IssueListViewMode } from './view-mode';

	type RatingStarTone = 'empty' | 'preview' | 'solid';

	type Props = {
		controls?: Snippet;
		currentListId?: string | null;
		empty?: Snippet;
		errorMessage?: string | null;
		isLoading?: boolean;
		items: CollectionItem[];
		onRemoveListItem?: (itemId: string) => void | Promise<void>;
		onReorderItems?: (items: CollectionItem[]) => void | Promise<void>;
		onUpdateUserIssue?: (userIssueId: string, patch: UserIssuePatch) => void | Promise<void>;
		onViewModeChange: (viewMode: IssueListViewMode) => void;
		removingItemIds?: string[];
		viewMode: IssueListViewMode;
	};

	let {
		controls,
		currentListId = null,
		empty,
		errorMessage = null,
		isLoading = false,
		items,
		onRemoveListItem,
		onReorderItems,
		onUpdateUserIssue,
		onViewModeChange,
		removingItemIds = [],
		viewMode
	}: Props = $props();
	let previewRatingByItemId = $state<Record<string, number>>({});

	let listGridTemplate = $derived.by(() =>
		[
			onReorderItems ? '2.25rem' : null,
			'max-content',
			'minmax(10rem, max-content)',
			'minmax(8rem, max-content)',
			'minmax(7rem, max-content)',
			'minmax(1rem, 1fr)',
			'max-content',
			'max-content'
		]
			.filter((column): column is string => Boolean(column))
			.join(' ')
	);

	function modeButtonClass(mode: IssueListViewMode) {
		return `relative z-10 inline-flex size-8 items-center justify-center rounded-md transition-colors ${
			viewMode === mode ? 'text-neutral-950' : 'text-muted-foreground hover:text-foreground'
		}`;
	}

	function issueTitle(item: CollectionItem) {
		const issue = item.userIssue?.issue;
		if (!issue) return 'Unknown issue';

		const issueName = issue.name ? `: ${issue.name}` : '';
		return `${issue.volume?.name ?? 'Unknown volume'} #${issue.issueNumber}${issueName}`;
	}

	function issueName(issue: CollectionIssue) {
		return issue.name?.trim() || 'Untitled';
	}

	function linkedList(value: { id: string; name: string } | Array<{ id: string; name: string }> | null | undefined) {
		const record = Array.isArray(value) ? value[0] : value;
		return record?.id && record.name ? record : null;
	}

	function listLinks(item: CollectionItem) {
		const links = (item.userIssue?.listItems ?? [])
			.map((listItem) => linkedList(listItem.list))
			.filter((list): list is { id: string; name: string } => Boolean(list))
			.filter((list) => list.id !== currentListId);
		const seen = new Set<string>();

		return links.filter((list) => {
			if (seen.has(list.id)) return false;
			seen.add(list.id);
			return true;
		});
	}

	function canUpdateItem(item: CollectionItem) {
		return Boolean(onUpdateUserIssue && item.userIssue?.id);
	}

	async function updateUserIssue(item: CollectionItem, patch: UserIssuePatch) {
		const userIssueId = item.userIssue?.id;
		if (!canUpdateItem(item) || !userIssueId) return;

		await onUpdateUserIssue?.(userIssueId, patch);
	}

	function statusButtonClass(active: boolean) {
		return `inline-flex size-8 items-center justify-center rounded-md transition ${
			active ? 'text-foreground' : 'text-muted-foreground'
		} ${onUpdateUserIssue ? 'cursor-pointer hover:bg-muted' : 'cursor-default'}`;
	}

	function starButtonClass(tone: RatingStarTone) {
		return `inline-flex size-6 items-center justify-center rounded-md transition ${
			tone === 'empty' ? 'text-muted-foreground' : 'text-amber-500'
		} ${onUpdateUserIssue ? 'cursor-pointer hover:bg-muted' : 'cursor-default'}`;
	}

	function starIconClass(tone: RatingStarTone) {
		if (tone === 'solid') return 'size-4 fill-current opacity-100';
		if (tone === 'preview') return 'size-4 fill-current opacity-45';
		return 'size-4 opacity-100';
	}

	function previewRating(item: CollectionItem) {
		return previewRatingByItemId[item.id] ?? null;
	}

	function savedRating(item: CollectionItem) {
		return item.userIssue?.rating ?? 0;
	}

	function ratingStarTone(item: CollectionItem, rating: number): RatingStarTone {
		const saved = savedRating(item);
		const preview = previewRating(item);

		if (preview === null || preview === saved) {
			return rating <= saved ? 'solid' : 'empty';
		}

		if (preview > saved) {
			if (rating <= saved) return 'solid';
			if (rating <= preview) return 'preview';
			return 'empty';
		}

		if (rating <= preview) return 'solid';
		if (rating <= saved) return 'preview';
		return 'empty';
	}

	function setPreviewRating(itemId: string, rating: number) {
		previewRatingByItemId = { ...previewRatingByItemId, [itemId]: rating };
	}

	function clearPreviewRating(itemId: string) {
		const { [itemId]: _removed, ...nextPreviewRatings } = previewRatingByItemId;
		previewRatingByItemId = nextPreviewRatings;
	}

	function previewRatingIfEditable(item: CollectionItem, rating: number) {
		if (canUpdateItem(item)) {
			setPreviewRating(item.id, rating);
		}
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

	$effect(() => {
		const itemIds = new Set(items.map((item) => item.id));
		const nextPreviewRatings = Object.fromEntries(
			Object.entries(previewRatingByItemId).filter(([itemId]) => itemIds.has(itemId))
		);

		if (Object.keys(nextPreviewRatings).length !== Object.keys(previewRatingByItemId).length) {
			previewRatingByItemId = nextPreviewRatings;
		}
	});
</script>

<section>
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<div class="relative grid grid-cols-2 rounded-lg bg-muted p-1" aria-label="View mode">
			<div
				class={`absolute left-1 top-1 size-8 rounded-md bg-white shadow-sm transition-transform duration-200 ease-out ${
					viewMode === 'list' ? 'translate-x-8' : 'translate-x-0'
				}`}
				aria-hidden="true"
			></div>
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

		<div class="flex items-center">
			{#if controls}
				{@render controls()}
			{/if}
		</div>
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
					</li>
				{/if}
			{/each}
		</ul>
	{:else}
		<div class="overflow-x-auto">
			<ul class="inline-grid min-w-full text-sm" style:grid-template-columns={listGridTemplate}>
				{#each items as item, index (item.id)}
					{@const issue = item.userIssue?.issue}
					{#if issue}
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
									dragOverClass:
										'outline outline-2 outline-dashed outline-primary/60 outline-offset-[-2px]'
								}
							}}
							class="group col-span-full grid grid-cols-subgrid items-center border-b border-border bg-background transition"
						>
							{#if onReorderItems}
								<div class="px-2 py-2">
									<button
										type="button"
										class="inline-flex size-8 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
										aria-label={`Drag ${issueTitle(item)}`}
										data-list-drag-handle={item.id}
									>
										<GripVertical class="size-4" />
									</button>
								</div>
							{/if}
							<div class="px-3 py-2 font-medium whitespace-nowrap">
								<a
									class="underline-offset-4 hover:underline"
									href={`/issues/${issue.id}`}
									onpointerdown={() => prepareIssueTransition(issue, item.position)}
									onclick={() => prepareIssueTransition(issue, item.position)}
								>
									#{issue.issueNumber}
								</a>
							</div>
							<div
								class="max-w-56 px-3 py-2"
								style:view-transition-name={issueViewTransitionName(issue.id, 'title')}
							>
								<a class="line-clamp-2 underline-offset-4 hover:underline" href={`/issues/${issue.id}`}>
									{issueName(issue)}
								</a>
							</div>
							<div class="max-w-48 px-3 py-2 text-muted-foreground">
								<span class="line-clamp-2">{issue.volume?.name ?? 'Unknown volume'}</span>
							</div>
							<div class="max-w-56 px-3 py-2">
								{#if listLinks(item).length}
									<div class="flex flex-wrap gap-1">
										{#each listLinks(item) as list (list.id)}
											<a class="rounded-md bg-muted px-2 py-1 text-xs underline-offset-4 hover:underline" href={`/list/${list.id}`}>
												{list.name}
											</a>
										{/each}
									</div>
								{/if}
							</div>
							<div></div>
							<div class="px-3 py-2 whitespace-nowrap">
								<div
									class="flex items-center gap-0.5"
									role="group"
									aria-label={`Rating for ${issueTitle(item)}`}
									onpointerleave={() => clearPreviewRating(item.id)}
								>
									{#each [1, 2, 3, 4, 5] as rating (rating)}
										{@const tone = ratingStarTone(item, rating)}
										<button
											type="button"
											class={starButtonClass(tone)}
											data-rating-tone={tone}
											disabled={!canUpdateItem(item)}
											aria-label={item.userIssue?.rating === rating
												? `Clear ${rating} star rating`
												: `Set rating to ${rating} ${rating === 1 ? 'star' : 'stars'}`}
											onpointerenter={() => previewRatingIfEditable(item, rating)}
											onclick={() =>
												void updateUserIssue(item, {
													rating: item.userIssue?.rating === rating ? null : rating
												})}
										>
											<Star class={starIconClass(tone)} />
										</button>
									{/each}
								</div>
							</div>
							<div class="px-2 py-2">
								<div class="flex items-center gap-0.5">
									<button
										type="button"
										class={statusButtonClass(item.userIssue?.owned === true)}
										disabled={!canUpdateItem(item)}
										aria-label={item.userIssue?.owned ? 'Mark as not owned' : 'Mark as owned'}
										aria-pressed={item.userIssue?.owned === true}
										onclick={() =>
											void updateUserIssue(item, { owned: item.userIssue?.owned !== true })}
									>
										{#if item.userIssue?.owned}
											<PackageCheck class="size-4" />
										{:else}
											<Package class="size-4" />
										{/if}
									</button>
									<button
										type="button"
										class={statusButtonClass(item.userIssue?.readStatus === 'read')}
										disabled={!canUpdateItem(item)}
										aria-label={item.userIssue?.readStatus === 'read' ? 'Mark as unread' : 'Mark as read'}
										aria-pressed={item.userIssue?.readStatus === 'read'}
										onclick={() =>
											void updateUserIssue(item, {
												readStatus: item.userIssue?.readStatus === 'read' ? 'unread' : 'read'
											})}
									>
										{#if item.userIssue?.readStatus === 'read'}
											<BookOpenCheck class="size-4" />
										{:else}
											<BookOpen class="size-4" />
										{/if}
									</button>
									<button
										type="button"
										class={statusButtonClass(item.userIssue?.favorite === true)}
										disabled={!canUpdateItem(item)}
										aria-label={item.userIssue?.favorite ? 'Remove favorite' : 'Mark as favorite'}
										aria-pressed={item.userIssue?.favorite === true}
										onclick={() =>
											void updateUserIssue(item, { favorite: item.userIssue?.favorite !== true })}
									>
										<Heart class={`size-4 ${item.userIssue?.favorite ? 'fill-current' : ''}`} />
									</button>
									{#if onRemoveListItem}
										<button
											type="button"
											class="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-70"
											aria-label={`Remove ${issueTitle(item)}`}
											disabled={removingItemIds.includes(item.id)}
											onclick={() => void onRemoveListItem(item.id)}
										>
											{#if removingItemIds.includes(item.id)}
												<LoaderCircle class="size-4 animate-spin" />
											{:else}
												<Trash2 class="size-4" />
											{/if}
										</button>
									{/if}
								</div>
							</div>
						</li>
					{/if}
				{/each}
			</ul>
		</div>
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
