<script lang="ts">
	import type { DragDropState } from '@thisux/sveltednd';
	import { draggable, droppable } from '@thisux/sveltednd';
	import {
		BookOpen,
		BookOpenCheck,
		Check,
		ChevronDown,
		CircleAlert,
		ClockArrowDown,
		ClockArrowUp,
		Grid2x2,
		GripVertical,
		Heart,
		List,
		LoaderCircle,
		Package,
		PackageCheck,
		ArrowDown10,
		ArrowUp01,
		Trash2
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { flushSync } from 'svelte';
	import { formatDate } from '$lib/comics/format';
	import type { CollectionIssue, CollectionItem, UserIssuePatch } from '$lib/comics/types';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { confirmDelete } from '$lib/components/ui/confirm-delete-dialog';
	import * as Popover from '$lib/components/ui/popover';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as StarRating from '$lib/components/ui/star-rating';
	import {
		isActiveIssueTransition,
		issueTransition,
		issueViewTransitionName,
		primeIssueTransition
	} from '$lib/comics/view-transitions.svelte';
	import {
		IssueSort,
		issueSortLabel,
		issueSortOptions,
		sortedIssueItems,
		type IssueSortKey
	} from './sort';
	import type { IssueListViewMode } from './view-mode';

	type Props = {
		controls?: Snippet;
		currentListId?: string | null;
		currentListName?: string | null;
		empty?: Snippet;
		errorMessage?: string | null;
		isLoading?: boolean;
		items: CollectionItem[];
		onRemoveListItem?: (itemId: string) => void | Promise<void>;
		onReorderItems?: (items: CollectionItem[]) => void | Promise<void>;
		onSortKeyChange: (sortKey: IssueSortKey) => void | Promise<void>;
		onUpdateUserIssue?: (userIssueId: string, patch: UserIssuePatch) => void | Promise<void>;
		onViewModeChange: (viewMode: IssueListViewMode) => void;
		removeFromList?: boolean;
		removingItemIds?: string[];
		sortKey: IssueSortKey;
		userSortable?: boolean;
		viewMode: IssueListViewMode;
	};

	let {
		controls,
		currentListId = null,
		currentListName = null,
		empty,
		errorMessage = null,
		isLoading = false,
		items,
		onRemoveListItem,
		onReorderItems,
		onSortKeyChange,
		onUpdateUserIssue,
		onViewModeChange,
		removeFromList = false,
		removingItemIds = [],
		sortKey,
		userSortable = false,
		viewMode
	}: Props = $props();
	let sortMenuOpen = $state(false);
	const activeSortKey = $derived(
		!userSortable && sortKey === IssueSort.Custom ? IssueSort.IssueNumberAsc : sortKey
	);
	const sortOptions = $derived(issueSortOptions(userSortable));
	const sortedItems = $derived(sortedIssueItems(items, activeSortKey));
	const canReorder = $derived(
		Boolean(userSortable && activeSortKey === IssueSort.Custom && onReorderItems)
	);
	const sortIconByKey = {
		[IssueSort.Custom]: GripVertical,
		[IssueSort.NewestAdded]: ClockArrowDown,
		[IssueSort.OldestAdded]: ClockArrowUp,
		[IssueSort.IssueNumberDesc]: ArrowDown10,
		[IssueSort.IssueNumberAsc]: ArrowUp01
	} satisfies Record<IssueSortKey, typeof GripVertical>;

	let listGridTemplate = $derived.by(() =>
		[
			canReorder ? '2.25rem' : null,
			'max-content',
			'max-content',
			'max-content',
			'max-content',
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

	function issueRating(item: CollectionItem) {
		return item.userIssue?.rating ?? 0;
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
		if (!sourceId || !Number.isInteger(targetIndex)) return sortedItems;

		const targetId = sortedItems[targetIndex]?.id;
		if (!targetId || sourceId === targetId) return sortedItems;

		const sourceIndex = sortedItems.findIndex((item) => item.id === sourceId);
		const nextTargetIndex = sortedItems.findIndex((item) => item.id === targetId);
		if (sourceIndex === -1 || nextTargetIndex === -1) return sortedItems;

		const reorderedItems = [...sortedItems];
		const [movedItem] = reorderedItems.splice(sourceIndex, 1);
		reorderedItems.splice(nextTargetIndex, 0, movedItem);
		return reorderedItems;
	}

	async function handleDrop(state: DragDropState<CollectionItem>) {
		if (!canReorder || !onReorderItems) return;

		const orderedItems = reorderedItemsForDrop(state);
		if (hasSameOrder(sortedItems, orderedItems)) return;

		await onReorderItems(orderedItems);
	}

	function changeSortKey(nextSortKey: IssueSortKey) {
		sortMenuOpen = false;
		if (nextSortKey !== activeSortKey) {
			void onSortKeyChange(nextSortKey);
		}
	}

	function confirmRemove(event: MouseEvent, item: CollectionItem) {
		if (event.shiftKey) {
			void onRemoveListItem?.(item.id);
			return;
		}

		confirmDelete({
			title: removeFromList ? 'Remove from list' : 'Delete issue',
			description: removeFromList
				? 'This action cannot be undone. The issue will be removed from this list, but it will remain in your collection.'
				: 'This action cannot be undone. The issue will be deleted from your collection and every list.',
			confirm: { text: removeFromList ? 'Remove' : 'Delete' },
			onConfirm: async () => onRemoveListItem?.(item.id)
		});
	}

	function prepareIssueTransition(issue: CollectionIssue) {
		flushSync(() =>
			primeIssueTransition(issue, {
				hasSharedCover: viewMode === 'gallery',
				sourceHref: `${location.pathname}${location.search}${location.hash}`,
				sourceLabel: currentListName ?? 'Collection'
			})
		);
	}
</script>

{#snippet sortIcon(key: IssueSortKey)}
	{@const Icon = sortIconByKey[key]}
	<Icon class="size-4 text-muted-foreground" aria-hidden="true" />
{/snippet}

<section class="min-w-0" data-issue-list-panel>
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<div class="flex items-center gap-2">
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
			<div class="h-7 w-px bg-border" aria-hidden="true"></div>
			<Popover.Root bind:open={sortMenuOpen}>
				<Popover.Trigger
					type="button"
					class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
					aria-label={`Sort issues: ${issueSortLabel(activeSortKey)}`}
				>
					{@render sortIcon(activeSortKey)}
					{issueSortLabel(activeSortKey)}
					<ChevronDown class="size-4 text-muted-foreground" />
				</Popover.Trigger>
				<Popover.Content class="w-max p-1.5" align="start">
					{#each sortOptions as option (option.value)}
						<button
							type="button"
							class="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted"
							aria-pressed={activeSortKey === option.value}
							onclick={() => changeSortKey(option.value)}
						>
							<span class="inline-flex items-center gap-2">
								{@render sortIcon(option.value)}
								{option.label}
							</span>
							{#if activeSortKey === option.value}
								<Check class="size-4" />
							{/if}
						</button>
					{/each}
				</Popover.Content>
			</Popover.Root>
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
		<Alert.Root class="m-4 w-auto" variant="destructive">
			<CircleAlert aria-hidden="true" />
			<Alert.Title>Couldn’t load issues</Alert.Title>
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{:else if !sortedItems.length && empty}
		{@render empty()}
	{:else if viewMode === 'gallery'}
		<ul
			class="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-3 md:grid-cols-4"
			style:view-transition-name={issueTransition.direction === 'issue-back'
				? 'issue-gallery'
				: null}
		>
			{#each sortedItems as item (item.id)}
				{@const issue = item.userIssue?.issue}
				{#if issue}
					<li class="group relative">
						<a
							class="block overflow-hidden bg-muted text-foreground shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							href={`/issues/${issue.id}`}
							onpointerdown={() => prepareIssueTransition(issue)}
							onclick={() => prepareIssueTransition(issue)}
						>
							<img
								class="aspect-[2/3] w-full border border-border object-cover"
								src={issue.coverImageUrl ?? '/robots.txt'}
								alt=""
								data-issue-transition-cover={issue.id}
								style:view-transition-name={isActiveIssueTransition(issue.id)
									? issueViewTransitionName(issue.id, 'cover')
									: null}
								style:view-transition-class={isActiveIssueTransition(issue.id) ? 'issue-cover' : null}
							/>
							<div
								class="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 via-background/70 to-transparent p-3 pt-10"
								style:view-transition-name={issueTransition.direction === 'issue-back' &&
								isActiveIssueTransition(issue.id)
									? issueViewTransitionName(issue.id, 'card-content')
									: null}
								style:view-transition-class={issueTransition.direction === 'issue-back' &&
								isActiveIssueTransition(issue.id)
									? 'issue-card-content'
									: null}
							>
								<h3 class="line-clamp-2 text-sm font-semibold">
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
			<ul
				class="inline-grid w-max min-w-full text-sm"
				style:grid-template-columns={listGridTemplate}
				data-list-grid
			>
				{#each sortedItems as item, index (item.id)}
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
							{#if canReorder}
								<div
									class="sticky left-0 z-20 bg-background px-2 py-2"
									data-list-handle-cell
								>
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
							<div
								class="sticky z-10 border-r border-border bg-background px-3 py-2 font-medium whitespace-nowrap"
								style:left={canReorder ? '2.25rem' : '0px'}
								data-list-number-cell
							>
								<a
									class="underline-offset-4 hover:underline"
									href={`/issues/${issue.id}`}
									onpointerdown={() => prepareIssueTransition(issue)}
									onclick={() => prepareIssueTransition(issue)}
								>
									#{issue.issueNumber}
								</a>
							</div>
							<div class="max-w-56 px-3 py-2">
								<a
									class="line-clamp-2 underline-offset-4 hover:underline"
									href={`/issues/${issue.id}`}
									onpointerdown={() => prepareIssueTransition(issue)}
									onclick={() => prepareIssueTransition(issue)}
								>
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
							<div class="px-3 py-2">
								<StarRating.Root
									value={issueRating(item)}
									disabled={!canUpdateItem(item)}
									aria-label={`Rating for ${issueTitle(item)}`}
									onValueChange={(rating) => void updateUserIssue(item, { rating })}
								>
									{#snippet children({ items })}
										{#each items as ratingItem (ratingItem.index)}
											<StarRating.Star {...ratingItem} />
										{/each}
									{/snippet}
								</StarRating.Root>
							</div>
							<div
								class="sticky right-0 z-10 border-l border-border bg-background px-2 py-2"
								data-list-actions-cell
							>
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
										<Button
											aria-label={`${removeFromList ? 'Remove' : 'Delete'} ${issueTitle(item)}`}
											class="cursor-pointer"
											disabled={removingItemIds.includes(item.id)}
											onclick={(event) => confirmRemove(event, item)}
											size="icon"
											variant="destructive"
										>
											{#if removingItemIds.includes(item.id)}
												<Spinner />
											{:else}
												<Trash2 />
											{/if}
										</Button>
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
